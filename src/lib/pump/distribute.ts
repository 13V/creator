import "server-only";

import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  PUMP_SDK,
  ammCreatorVaultPda,
  creatorVaultPda,
  feeSharingConfigPda,
  hasCoinCreatorMigratedToSharingConfig,
  quoteAta,
} from "@pump-fun/pump-sdk";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { decodeMasterSeed, deriveTreasuryKeypair } from "../escrow/derive";
import { env } from "../env";
import { fetchBondingCurve } from "./coin";
import { getConnection } from "./connection";

/**
 * Pays out accrued creator fees for coins that carry a fee-sharing config.
 *
 * `distributeCreatorFees` takes no signer, so anyone can crank it — but that
 * also means nobody will unless something does it on a schedule. Fees sit in
 * the vault until then, which reads to a creator as "the launchpad isn't
 * paying me".
 *
 * The transaction fee is the only cost, and it is paid by the treasury wallet
 * rather than by anyone's escrow.
 */

export interface DistributeOutcome {
  mint: string;
  status: "paid" | "skipped" | "failed";
  detail: string;
  signature?: string;
}

/**
 * pump.fun refuses to distribute a vault below a minimum, so a transaction for
 * a quiet coin is a wasted signature and a wasted fee. Observed at 1,386,760
 * lamports; kept a little above that so a coin is not attempted the moment it
 * crosses and then found short by the time the transaction lands.
 */
const MIN_DISTRIBUTABLE_LAMPORTS = 1_500_000;

/** Offset of a token account's amount field, for reading a balance raw. */
const TOKEN_AMOUNT_OFFSET = 64;

/** Batched account reads have a practical ceiling per request. */
const CHUNK = 100;

/**
 * Picks out the coins actually worth a distribution transaction.
 *
 * Every address involved is derivable offline, so several hundred coins cost a
 * couple of batched reads rather than a round trip each. Without this the
 * keeper spends a transaction per coin per run and almost all of them fail on
 * the minimum — which burns the treasury and buries any real failure in noise.
 */
export async function findDistributable(mints: string[]): Promise<string[]> {
  if (mints.length === 0) return [];

  const connection = getConnection();
  const valid: { mint: string; key: PublicKey }[] = [];
  for (const raw of mints) {
    try {
      valid.push({ mint: raw, key: new PublicKey(raw) });
    } catch {
      // A malformed mint cannot have a vault; skip rather than fail the batch.
    }
  }

  // Fees accrue to the sharing config's vaults, not the escrow's: after
  // migration the config PDA *is* the coin's creator.
  const addresses: PublicKey[] = [];
  for (const { key } of valid) {
    const configAsCreator = feeSharingConfigPda(key);
    addresses.push(
      creatorVaultPda(configAsCreator),
      quoteAta(ammCreatorVaultPda(configAsCreator), NATIVE_MINT, TOKEN_PROGRAM_ID),
    );
  }

  const infos = [];
  for (let i = 0; i < addresses.length; i += CHUNK) {
    infos.push(
      ...(await connection.getMultipleAccountsInfo(addresses.slice(i, i + CHUNK))),
    );
  }

  const ready: string[] = [];
  for (let i = 0; i < valid.length; i += 1) {
    const [curve, ammAta] = infos.slice(i * 2, i * 2 + 2);
    let total = curve ? curve.lamports : 0;
    if (ammAta && ammAta.data.length >= TOKEN_AMOUNT_OFFSET + 8) {
      total += Number(ammAta.data.readBigUInt64LE(TOKEN_AMOUNT_OFFSET));
    }
    if (total >= MIN_DISTRIBUTABLE_LAMPORTS) ready.push(valid[i].mint);
  }

  return ready;
}

function keeper(): Keypair {
  const seed = env().ESCROW_MASTER_SEED;
  if (!seed) {
    throw new Error("ESCROW_MASTER_SEED is required to pay distribution fees");
  }
  return deriveTreasuryKeypair(decodeMasterSeed(seed));
}

export async function distributeOne(
  mint: PublicKey,
  payer: Keypair,
): Promise<DistributeOutcome> {
  const base = { mint: mint.toBase58() };
  const connection = getConnection();

  const curve = await fetchBondingCurve(mint);
  if (!curve) {
    return { ...base, status: "skipped", detail: "No bonding curve." };
  }

  // Only coins that were migrated have anything to distribute this way; the
  // rest pay their creator directly through the plain creator vault.
  if (
    !hasCoinCreatorMigratedToSharingConfig({ mint, creator: curve.creator })
  ) {
    return { ...base, status: "skipped", detail: "No fee-sharing config." };
  }

  const address = feeSharingConfigPda(mint);
  const info = await connection.getAccountInfo(address);
  if (!info) {
    return { ...base, status: "skipped", detail: "Sharing config is missing." };
  }
  const sharingConfig = PUMP_SDK.decodeSharingConfig(info);

  const instruction = await PUMP_SDK.distributeCreatorFees({
    mint,
    sharingConfig,
    sharingConfigAddress: address,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        instruction,
      ],
    }).compileToV0Message(),
  );
  transaction.sign([payer]);

  try {
    const signature = await connection.sendTransaction(transaction, {
      maxRetries: 3,
    });
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return { ...base, status: "paid", detail: "Distributed.", signature };
  } catch (error) {
    /*
     * The common failure is benign: pump.fun refuses to distribute below a
     * minimum, so a coin with almost no volume fails every run until it has
     * earned enough. That is not worth surfacing as a broken keeper.
     */
    const detail = error instanceof Error ? error.message : String(error);
    const belowMinimum = /minimum|NotEnough|insufficient/i.test(detail);
    return {
      ...base,
      status: belowMinimum ? "skipped" : "failed",
      detail: belowMinimum ? "Below the minimum distributable fee." : detail,
    };
  }
}

/** Cranks a batch of mints, one transaction each, never failing the batch. */
export async function distributeMany(
  mints: string[],
): Promise<DistributeOutcome[]> {
  const payer = keeper();
  const results: DistributeOutcome[] = [];

  for (const raw of mints) {
    let mint: PublicKey;
    try {
      mint = new PublicKey(raw);
    } catch {
      results.push({ mint: raw, status: "failed", detail: "Invalid mint." });
      continue;
    }
    try {
      results.push(await distributeOne(mint, payer));
    } catch (error) {
      results.push({
        mint: raw,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
