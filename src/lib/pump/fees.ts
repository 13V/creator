import "server-only";

import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";

import { deriveManagedEscrow } from "../escrow/managed";
import type { Platform } from "../social/types";
import { getConnection, getOnlineSdk } from "./connection";

export interface FeeSnapshot {
  /** Unclaimed fees still sitting in pump.fun's creator vaults. */
  claimableLamports: number;
  /** Already-collected SOL resting in the escrow wallet itself. */
  walletLamports: number;
  totalLamports: number;
}

/** Reads everything owed to an escrow across the bonding curve and AMM vaults. */
export async function getFeeSnapshot(escrow: PublicKey): Promise<FeeSnapshot> {
  const [claimable, wallet] = await Promise.all([
    getOnlineSdk().getCreatorVaultBalanceBothPrograms(escrow),
    getConnection().getBalance(escrow),
  ]);

  const claimableLamports = claimable.toNumber();
  return {
    claimableLamports,
    walletLamports: wallet,
    totalLamports: claimableLamports + wallet,
  };
}

export interface ManagedPayout {
  transaction: string;
  lamports: number;
  escrow: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Builds the payout transaction for a managed (custodial) escrow.
 *
 * The claiming creator is the fee payer, so the launchpad never needs a funded
 * hot wallet, and the escrow only ever co-signs a transaction that moves its
 * balance to the verified creator. The escrow signature is applied here; the
 * creator adds theirs in their wallet.
 *
 * Only the escrow key can call `collect_creator_fee` for these vaults, so the
 * claimable balance cannot shrink between the read below and execution — the
 * transfer amount is therefore a safe lower bound.
 */
export async function buildManagedPayout(params: {
  platform: Platform;
  handle: string;
  destination: PublicKey;
  feePayer: PublicKey;
}): Promise<ManagedPayout> {
  const connection = getConnection();
  const online = getOnlineSdk();
  const escrow = deriveManagedEscrow(params.platform, params.handle);

  const snapshot = await getFeeSnapshot(escrow.publicKey);
  if (snapshot.totalLamports <= 0) {
    throw new PayoutError("There are no creator fees to claim yet.");
  }

  const instructions: TransactionInstruction[] = [
    ...(await online.collectCoinCreatorFeeInstructions(
      escrow.publicKey,
      params.feePayer,
    )),
    SystemProgram.transfer({
      fromPubkey: escrow.publicKey,
      toPubkey: params.destination,
      lamports: snapshot.totalLamports,
    }),
  ];

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: params.feePayer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);

  // Catch an unpayable payout here rather than after the creator signs it.
  const simulation = await connection.simulateTransaction(transaction, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  if (simulation.value.err) {
    throw new PayoutError(
      `Payout simulation failed: ${JSON.stringify(simulation.value.err)}`,
    );
  }

  transaction.sign([escrow]);

  return {
    transaction: Buffer.from(transaction.serialize()).toString("base64"),
    lamports: snapshot.totalLamports,
    escrow: escrow.publicKey.toBase58(),
    blockhash,
    lastValidBlockHeight,
  };
}

export class PayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutError";
  }
}
