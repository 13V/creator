import "server-only";

import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { ammCreatorVaultPda, creatorVaultPda, quoteAta } from "@pump-fun/pump-sdk";

import { getConnection } from "./connection";

/** getMultipleAccounts tops out at 100 addresses per call. */
const CHUNK = 100;

/** Offset of the u64 `amount` field in an SPL token account. */
const TOKEN_AMOUNT_OFFSET = 64;

/**
 * Reads unclaimed fee totals for many escrows at once.
 *
 * Every address involved — the bonding-curve vault, the AMM vault's wrapped-SOL
 * ATA, and the escrow wallet — is a PDA or ATA derivable offline, so an
 * arbitrary number of creators costs a couple of batched RPC calls instead of
 * three round trips each. Detail pages still use the SDK's own readers; this
 * exists so lists and the leaderboard stay cheap.
 */
export async function getFeeTotals(
  escrows: PublicKey[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (escrows.length === 0) return totals;

  const addresses: PublicKey[] = [];
  for (const escrow of escrows) {
    totals.set(escrow.toBase58(), 0);
    addresses.push(
      creatorVaultPda(escrow),
      quoteAta(ammCreatorVaultPda(escrow), NATIVE_MINT, TOKEN_PROGRAM_ID),
      escrow,
    );
  }

  const connection = getConnection();
  const infos: (AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < addresses.length; i += CHUNK) {
    infos.push(...(await connection.getMultipleAccountsInfo(addresses.slice(i, i + CHUNK))));
  }

  // Vault accounts share a handful of data lengths; look each rent floor up once.
  const rentByLength = new Map<number, number>();
  const rentFor = async (length: number): Promise<number> => {
    const cached = rentByLength.get(length);
    if (cached !== undefined) return cached;
    const rent = await connection.getMinimumBalanceForRentExemption(length);
    rentByLength.set(length, rent);
    return rent;
  };

  for (let i = 0; i < escrows.length; i += 1) {
    const key = escrows[i].toBase58();
    const [curve, ammAta, wallet] = infos.slice(i * 3, i * 3 + 3);

    let total = 0;

    // Bonding-curve vault: a system account whose rent floor is not claimable.
    if (curve) {
      const rent = await rentFor(curve.data.length);
      total += Math.max(0, curve.lamports - rent);
    }

    // AMM vault: wrapped SOL, so the claimable amount is the token balance.
    if (ammAta && ammAta.data.length >= TOKEN_AMOUNT_OFFSET + 8) {
      total += Number(ammAta.data.readBigUInt64LE(TOKEN_AMOUNT_OFFSET));
    }

    /*
     * Fees already collected but not yet swept out of the escrow itself.
     *
     * Its rent floor comes off first, the same as the curve vault above. The
     * escrow is funded to that floor at launch so it can create its fee
     * sharing config, and counting that float as earnings would put money on
     * the board — and on the leaderboard's headline total — that no creator
     * has actually made.
     */
    if (wallet) {
      const rent = await rentFor(wallet.data.length);
      total += Math.max(0, wallet.lamports - rent);
    }

    totals.set(key, total);
  }

  return totals;
}
