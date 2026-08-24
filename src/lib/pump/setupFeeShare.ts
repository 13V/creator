import "server-only";

import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type Keypair,
} from "@solana/web3.js";

import {
  decodeMasterSeed,
  deriveEscrowKeypair,
  deriveTreasuryKeypair,
} from "../escrow/derive";
import { env } from "../env";
import type { EscrowKind, Platform } from "../social/types";
import { getConnection } from "./connection";
import { PUMP_SDK } from "@pump-fun/pump-sdk";

import {
  assertValidShares,
  buildShareholders,
  canSplitFees,
  resolvePlatformWallet,
  type Shareholder,
} from "./feeShare";

/**
 * Migrates a freshly launched coin onto a pump.fun fee-sharing config, so its
 * creator fees are split without this launchpad ever holding them.
 *
 * Runs after the launch confirms rather than inside it, for two reasons. The
 * config can only be created once the bonding curve exists, and the launch
 * transaction is already close enough to Solana's 1232-byte ceiling that
 * `create` plus an opening buy needs a lookup table to fit at all.
 *
 * The creator signs both instructions — `createFeeSharingConfig` passes the
 * creator as the payer, and it becomes the config's admin — which is why this
 * only works for escrows whose key we derive.
 */

export interface FeeShareResult {
  applied: boolean;
  /** Why no split was set, when `applied` is false. */
  reason?: string;
  signature?: string;
  shareholders?: { address: string; shareBps: number }[];
}

/** The platform's cut, in basis points. 1000 = 10%. */
export function platformShareBps(): number {
  return env().PLATFORM_FEE_SHARE_BPS;
}

export function platformWallet(): PublicKey | null {
  return resolvePlatformWallet(
    env().PLATFORM_FEE_WALLET,
    env().ESCROW_MASTER_SEED,
    (seed) => deriveTreasuryKeypair(decodeMasterSeed(seed)).publicKey,
  );
}

/**
 * Size of a pump.fun sharing config, pre-sized for its ten shareholder slots.
 *
 * Confirmed against mainnet: `getMinimumBalanceForRentExemption(1024)` returns
 * 8,017,920 lamports, exactly what the program asked for when an undersized
 * escrow failed with "insufficient lamports".
 */
export const SHARING_CONFIG_BYTES = 1024;

let cachedRent: number | null = null;

/**
 * What the launch must send the escrow so it can create its sharing config.
 *
 * Read from the chain rather than hardcoded, because a stale constant is what
 * broke this the first time. The escrow's balance is counted as unclaimed
 * creator fees everywhere in the UI, so overshooting here shows up on the
 * board as money the creator has not actually earned — hence a tight fee
 * buffer rather than a comfortable round number.
 */
export async function feeShareFundingLamports(): Promise<number> {
  const override = env().FEE_SHARE_RENT_LAMPORTS;
  if (override > 0) return override;

  if (cachedRent === null) {
    const connection = getConnection();
    /*
     * Two rents, not one. The escrow pays for the config account *and* has to
     * stay rent-exempt itself — it is the fee payer, and a transaction that
     * leaves its payer below the floor is rejected outright with "insufficient
     * funds for rent", which is not obviously about rent at all.
     */
    const [config, own] = await Promise.all([
      connection.getMinimumBalanceForRentExemption(SHARING_CONFIG_BYTES),
      connection.getMinimumBalanceForRentExemption(0),
    ]);
    cachedRent = config + own;
  }
  return cachedRent + FEE_BUFFER_LAMPORTS;
}

/** Covers the signature fee on the config transaction, with room to spare. */
const FEE_BUFFER_LAMPORTS = 100_000;

/** The escrow key doubles as the coin's creator, so it signs the migration. */
function escrowSigner(platform: Platform, handle: string): Keypair {
  const seed = env().ESCROW_MASTER_SEED;
  if (!seed) {
    throw new Error("ESCROW_MASTER_SEED is not configured");
  }
  return deriveEscrowKeypair(decodeMasterSeed(seed), platform, handle);
}

export async function applyFeeShare({
  mint,
  platform,
  handle,
  escrowKind,
}: {
  mint: PublicKey;
  platform: Platform;
  handle: string;
  escrowKind: EscrowKind;
}): Promise<FeeShareResult> {
  if (!canSplitFees(escrowKind)) {
    return {
      applied: false,
      reason:
        "This coin's creator is a pump.fun social vault, which nobody can sign " +
        "for — so its fees cannot be split and go to the creator in full.",
    };
  }

  const wallet = platformWallet();
  const bps = platformShareBps();
  if (!wallet || bps === 0) {
    return { applied: false, reason: "No platform fee share is configured." };
  }

  const connection = getConnection();
  const creator = escrowSigner(platform, handle);

  const shareholders = buildShareholders({
    creatorEscrow: creator.publicKey,
    platformWallet: wallet,
    platformBps: bps,
  });
  assertValidShares(shareholders);

  // Rent for the config account plus the transaction fee. The escrow is empty
  // at this point — it has earned nothing yet — so the launch funds it.
  const balance = await connection.getBalance(creator.publicKey);
  if (balance === 0) {
    return {
      applied: false,
      reason:
        "The creator escrow holds no SOL, so it cannot pay rent for the fee " +
        "sharing config.",
    };
  }

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    // `pool` is null until a coin graduates; this runs seconds after launch.
    await PUMP_SDK.createFeeSharingConfig({
      creator: creator.publicKey,
      mint,
      pool: null,
    }),
    /*
     * `currentShareholders` becomes the instruction's remaining accounts, so
     * the program can settle whoever is already owed before the split changes.
     * An empty list is rejected with NotEnoughRemainingAccounts — verified
     * against a local validator running the real program.
     *
     * `createFeeSharingConfig` initialises the config with the creator holding
     * all 10,000 bps, so the current list is known without reading it back and
     * both instructions fit in one atomic transaction.
     */
    await PUMP_SDK.updateFeeShares({
      authority: creator.publicKey,
      mint,
      currentShareholders: [creator.publicKey],
      newShareholders: shareholders,
    }),
  ];

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: creator.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(),
  );
  transaction.sign([creator]);

  const signature = await connection.sendTransaction(transaction, {
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return {
    applied: true,
    signature,
    shareholders: describe(shareholders),
  };
}

function describe(shareholders: Shareholder[]) {
  return shareholders.map((s) => ({
    address: s.address.toBase58(),
    shareBps: s.shareBps,
  }));
}
