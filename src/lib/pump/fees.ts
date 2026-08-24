import "server-only";

import type { PublicKey } from "@solana/web3.js";

import { deriveManagedEscrow } from "../escrow/managed";
import type { Platform } from "../social/types";
import { getConnection, getOnlineSdk } from "./connection";
import { buildPayoutTransaction, readFees, type FeeSnapshot } from "./payoutTx";

export { PayoutError } from "./payoutTx";
export type { FeeSnapshot } from "./payoutTx";

/** Reads everything owed to an escrow across the bonding curve and AMM vaults. */
export function getFeeSnapshot(escrow: PublicKey): Promise<FeeSnapshot> {
  return readFees(getConnection(), getOnlineSdk(), escrow);
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
 */
export async function buildManagedPayout(params: {
  platform: Platform;
  handle: string;
  destination: PublicKey;
  feePayer: PublicKey;
}): Promise<ManagedPayout> {
  const escrow = deriveManagedEscrow(params.platform, params.handle);

  const plan = await buildPayoutTransaction({
    connection: getConnection(),
    online: getOnlineSdk(),
    escrow: escrow.publicKey,
    destination: params.destination,
    feePayer: params.feePayer,
  });

  plan.transaction.sign([escrow]);

  return {
    transaction: Buffer.from(plan.transaction.serialize()).toString("base64"),
    lamports: plan.lamports,
    escrow: escrow.publicKey.toBase58(),
    blockhash: plan.blockhash,
    lastValidBlockHeight: plan.lastValidBlockHeight,
  };
}
