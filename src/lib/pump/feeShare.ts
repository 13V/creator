import { PublicKey } from "@solana/web3.js";

import type { EscrowKind } from "../social/types";

/**
 * Creator-fee splitting, using pump.fun's own fee-sharing program.
 *
 * pump.fun's `create` names a single `creator`, but a coin can then be migrated
 * onto a *sharing config*: a per-mint account holding up to ten shareholders
 * with basis-point shares. `distributeCreatorFees` pays them all, needs no
 * signature from anyone, and handles both the bonding-curve lamports and the
 * AMM's wrapped SOL. Once `revokeFeeSharingAuthority` is called the split can
 * never be edited again — including by us.
 *
 * No `server-only` import, so the arithmetic stays unit testable.
 */

/** pump.fun requires shares to total exactly this. */
export const TOTAL_BPS = 10_000;

/** pump.fun's own cap on the shareholder list. */
export const MAX_SHAREHOLDERS = 10;

export interface Shareholder {
  address: PublicKey;
  shareBps: number;
}

export class ShareSplitError extends Error {}

/**
 * Whether a coin launched against this escrow can have a sharing config at all.
 *
 * `createFeeSharingConfig` is signed by the coin's creator, so we can only set
 * a split for escrows whose key we hold. A `pump-social` escrow is a PDA of
 * pump.fun's own program — nobody can sign for it, which is exactly what makes
 * it non-custodial, and also what puts it out of reach here. Those coins pay
 * the creator 100% and the platform nothing.
 */
export function canSplitFees(kind: EscrowKind): boolean {
  return kind === "managed";
}

/**
 * The 90/10 split, as pump.fun wants it.
 *
 * The creator's share is computed as the remainder rather than as its own
 * percentage: pump.fun rejects anything that does not total exactly 10,000 bps,
 * and taking the platform's cut off the top means a rounding error can only
 * ever shrink our side, never break the launch or shortchange the creator.
 */
export function buildShareholders({
  creatorEscrow,
  platformWallet,
  platformBps,
}: {
  creatorEscrow: PublicKey;
  platformWallet: PublicKey | null;
  platformBps: number;
}): Shareholder[] {
  if (!Number.isInteger(platformBps) || platformBps < 0 || platformBps >= TOTAL_BPS) {
    throw new ShareSplitError(
      `Platform share must be a whole number of basis points below ${TOTAL_BPS}, got ${platformBps}`,
    );
  }

  // No wallet configured, or a zero cut: the creator simply takes everything.
  // A shareholder with 0 bps is rejected on-chain, so it must be left out.
  if (!platformWallet || platformBps === 0) {
    return [{ address: creatorEscrow, shareBps: TOTAL_BPS }];
  }

  if (platformWallet.equals(creatorEscrow)) {
    throw new ShareSplitError(
      "The platform wallet and the creator escrow are the same address; " +
        "pump.fun rejects duplicate shareholders",
    );
  }

  return [
    { address: creatorEscrow, shareBps: TOTAL_BPS - platformBps },
    { address: platformWallet, shareBps: platformBps },
  ];
}

/**
 * Re-checks a shareholder list against every rule pump.fun enforces, so a bad
 * split fails here with a readable message rather than as an opaque program
 * error inside a launch the user has already signed.
 */
export function assertValidShares(shareholders: Shareholder[]): void {
  if (shareholders.length === 0) {
    throw new ShareSplitError("A sharing config needs at least one shareholder");
  }
  if (shareholders.length > MAX_SHAREHOLDERS) {
    throw new ShareSplitError(
      `pump.fun allows at most ${MAX_SHAREHOLDERS} shareholders, got ${shareholders.length}`,
    );
  }

  const seen = new Set<string>();
  let total = 0;
  for (const { address, shareBps } of shareholders) {
    if (!Number.isInteger(shareBps) || shareBps <= 0) {
      throw new ShareSplitError(
        `Every shareholder needs a positive whole share, got ${shareBps} for ${address.toBase58()}`,
      );
    }
    const key = address.toBase58();
    if (seen.has(key)) {
      throw new ShareSplitError(`Duplicate shareholder ${key}`);
    }
    seen.add(key);
    total += shareBps;
  }

  if (total !== TOTAL_BPS) {
    throw new ShareSplitError(`Shares must total ${TOTAL_BPS} basis points, got ${total}`);
  }
}

/**
 * Where the platform's share is paid.
 *
 * Falls back to a wallet derived from the master seed when none is configured,
 * so a deployment that has an escrow seed always has a valid destination and
 * the split is never silently dropped. Kept here rather than inlined so the
 * launch path and the keeper agree on the answer.
 */
export function resolvePlatformWallet(
  configured: string | undefined,
  masterSeed: string | undefined,
  derive: (seed: string) => PublicKey,
): PublicKey | null {
  if (configured) {
    try {
      return new PublicKey(configured);
    } catch {
      // A malformed address must not silently become "no split": fall through
      // to the derived wallet rather than handing the creator 100% by accident.
    }
  }
  return masterSeed ? derive(masterSeed) : null;
}

/** Human-readable percentage, for UI copy and launch receipts. */
export function formatShare(shareBps: number): string {
  const percent = (shareBps / TOTAL_BPS) * 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
}

/**
 * The creator's share as configured, for copy that is not about one specific
 * coin. Reads the environment, so it is server-side only; a component holding
 * a resolved escrow should use that escrow's own share instead, since a
 * pump-social coin pays 100% regardless of this setting.
 */
export function creatorShareBps(): number {
  const platform = Number(process.env.PLATFORM_FEE_SHARE_BPS ?? 1_000);
  if (!Number.isFinite(platform) || platform < 0 || platform >= TOTAL_BPS) {
    return TOTAL_BPS - 1_000;
  }
  return TOTAL_BPS - Math.trunc(platform);
}
