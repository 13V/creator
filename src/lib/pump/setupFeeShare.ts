import "server-only";

import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type Keypair,
} from "@solana/web3.js";

import { decodeMasterSeed, deriveEscrowKeypair } from "../escrow/derive";
import { env } from "../env";
import type { EscrowKind, Platform } from "../social/types";
import { getConnection } from "./connection";
import { PUMP_SDK } from "@pump-fun/pump-sdk";

import {
  assertValidShares,
  buildShareholders,
  canSplitFees,
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

function platformWallet(): PublicKey | null {
  const raw = env().PLATFORM_FEE_WALLET;
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

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
    await PUMP_SDK.updateFeeShares({
      authority: creator.publicKey,
      mint,
      currentShareholders: [],
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
