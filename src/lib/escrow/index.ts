import "server-only";

import type { PublicKey } from "@solana/web3.js";

import { Platform as PumpPlatform, socialFeePda } from "@pump-fun/pump-sdk";

import type { EscrowKind as EscrowKindType, SocialProfile } from "../social/types";
import { managedEscrowPubkey as managedEscrowPubkeyFor, managedStrategy } from "./managed";
import { pumpSocialStrategy } from "./pumpSocial";
import type { EscrowResolution } from "./types";
import { env } from "../env";
import { TOTAL_BPS, canSplitFees, resolvePlatformWallet } from "../pump/feeShare";
import { decodeMasterSeed, deriveTreasuryKeypair } from "./derive";

export { deriveManagedEscrow, managedEscrowPubkey } from "./managed";
export type { EscrowAccount, EscrowResolution } from "./types";

/**
 * Picks the escrow for a profile, preferring the non-custodial route.
 *
 * Order matters: pump.fun's native social vault needs nobody to be trusted, so
 * it wins whenever it is available (today: X, with a numeric id resolved via
 * the API). Everything else falls back to a launchpad-held key.
 */
export async function resolveEscrow(
  profile: SocialProfile,
  payer: PublicKey,
): Promise<EscrowResolution> {
  if (pumpSocialStrategy.supports(profile)) {
    const native = await pumpSocialStrategy.resolve(profile, payer);
    if (native.ok) return native;
  }

  if (managedStrategy.supports(profile)) {
    return managedStrategy.resolve(profile, payer);
  }

  return {
    ok: false,
    reason:
      profile.platform === "x"
        ? "X launches need either X_BEARER_TOKEN (non-custodial escrow) or " +
          "ESCROW_MASTER_SEED (managed escrow) configured."
        : "This platform needs ESCROW_MASTER_SEED configured to hold creator fees.",
  };
}

export interface EscrowPreview {
  kind: EscrowKindType;
  pubkey: string;
  custodyNote: string;
  claimRoute: "pump.fun" | "launchpad";
  available: boolean;
  reason?: string;
  /**
   * The creator's share of fees, in basis points.
   *
   * Not a constant: a pump.fun social vault cannot carry a sharing config,
   * because nobody can sign as its creator, so those coins pay the creator
   * everything. The launch screen has to show whichever applies.
   */
  creatorShareBps: number;
  platformShareBps: number;
}

/**
 * The split a given escrow kind can actually be given.
 *
 * Checks the destination as well as the percentage: with no platform wallet
 * resolvable, `buildShareholders` gives the creator everything, and a UI that
 * still advertised a cut would be quoting a split that never happens.
 */
function shareFor(kind: EscrowKindType): {
  creatorShareBps: number;
  platformShareBps: number;
} {
  const wallet = resolvePlatformWallet(
    env().PLATFORM_FEE_WALLET,
    env().ESCROW_MASTER_SEED,
    (seed) => deriveTreasuryKeypair(decodeMasterSeed(seed)).publicKey,
  );
  const platform = canSplitFees(kind) && wallet ? env().PLATFORM_FEE_SHARE_BPS : 0;
  return { creatorShareBps: TOTAL_BPS - platform, platformShareBps: platform };
}

/**
 * Describes the escrow a profile would get, without touching the RPC.
 *
 * Used by the resolve endpoint so the launch screen can tell the user up front
 * whether fees will be held non-custodially or in trust by this launchpad.
 */
export function previewEscrow(profile: SocialProfile): EscrowPreview {
  if (pumpSocialStrategy.supports(profile) && profile.platformUserId) {
    return {
      kind: "pump-social",
      pubkey: socialFeePda(profile.platformUserId, PumpPlatform.X).toBase58(),
      custodyNote:
        `Fees accrue to a pump.fun social vault derived from @${profile.handle}'s ` +
        "X account id. This launchpad holds no key and cannot withdraw.",
      claimRoute: "pump.fun",
      available: true,
      ...shareFor("pump-social"),
    };
  }

  if (managedStrategy.supports(profile)) {
    return {
      kind: "managed",
      pubkey: managedEscrowPubkeyFor(profile.platform, profile.handle).toBase58(),
      custodyNote:
        `Fees accrue to an escrow wallet held by this launchpad on behalf of ` +
        `@${profile.handle}. It is released once they verify the account.`,
      claimRoute: "launchpad",
      available: true,
      ...shareFor("managed"),
    };
  }

  return {
    kind: "managed",
    pubkey: "",
    custodyNote: "",
    claimRoute: "launchpad",
    available: false,
    reason:
      profile.platform === "x"
        ? "Set X_BEARER_TOKEN for non-custodial escrow, or ESCROW_MASTER_SEED for managed escrow."
        : "Set ESCROW_MASTER_SEED to hold creator fees for this platform.",
    creatorShareBps: TOTAL_BPS,
    platformShareBps: 0,
  };
}
