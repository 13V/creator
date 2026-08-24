export const PLATFORMS = ["x", "instagram", "tiktok", "reddit"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  reddit: "Reddit",
};

/** "X, Reddit, Instagram or TikTok" — so copy cannot go stale behind the list. */
export function platformList(conjunction = "or"): string {
  const names = PLATFORMS.map((p) => PLATFORM_LABELS[p]);
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${last}`;
}

/**
 * How creator fees are held for a coin.
 *
 * - `pump-social`: pump.fun's native social fee vault, a PDA derived from the
 *   creator's numeric social id. Nobody — including this launchpad — can move
 *   the funds; the creator claims them on pump.fun by linking their account.
 * - `managed`: a keypair this launchpad derives and custodies, used for
 *   platforms pump.fun has no native vault for. Held in trust until the
 *   creator verifies ownership of the handle, then swept to their wallet.
 */
export type EscrowKind = "pump-social" | "managed";

export interface SocialRef {
  platform: Platform;
  /** Handle as displayed, without a leading `@`. */
  handle: string;
}

export interface SocialProfile extends SocialRef {
  /** Numeric platform id. Only guaranteed for X, and only with an API token. */
  platformUserId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number | null;
  profileUrl: string;
  /** True when a live upstream lookup succeeded rather than being inferred. */
  verifiedUpstream: boolean;
}
