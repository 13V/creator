import { randomBytes } from "node:crypto";

import type { Platform } from "../social/types";
import type { VerificationRow } from "../repo";

/**
 * The rules a claim has to satisfy before anyone looks at a profile.
 *
 * Split out and free of `server-only` for the same reason `planPayout` is: it
 * decides who gets paid, and that decision should be testable without a
 * network, a database, or a Next.js runtime around it.
 */

/** Codes expire so a stale one left in a bio cannot be replayed indefinitely. */
export const VERIFICATION_TTL_MS = 60 * 60 * 1000;

export function generateVerificationCode(): string {
  return `pcl-${randomBytes(5).toString("hex")}`;
}

/**
 * Where a creator should put the verification code.
 *
 * Bio is preferred, but TikTok's public oEmbed exposes only the display name,
 * so that platform is told to use the name instead of a field we cannot read.
 */
export function verificationInstructions(platform: Platform): string {
  switch (platform) {
    case "tiktok":
      return "Add the code to your TikTok display name (not the bio — TikTok's public API does not expose bios).";
    case "instagram":
      return "Add the code anywhere in your Instagram bio, or to your display name.";
    case "reddit":
      return "Add the code anywhere in your Reddit profile description, or to your display name.";
    case "x":
      return "Add the code anywhere in your X bio, or to your display name.";
  }
}

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: string; retryable: boolean };

/**
 * Whether a pending verification is one we should even check a profile for.
 *
 * This is the whole security boundary of the claim. The code is published on a
 * public profile, so anybody can read it — which means the code alone can
 * never be what authorises a payout. `pending` is looked up by creator *and
 * destination wallet*, so a code only ever releases funds to the wallet that
 * asked for it. Matching on the handle alone would hand the escrow to whoever
 * spotted the code in a bio first.
 */
export function checkPending(
  pending: VerificationRow | null,
  now = Date.now(),
): VerificationResult {
  if (!pending) {
    return {
      ok: false,
      reason:
        "No verification is in progress for that wallet. Start a claim with " +
        "the wallet you want paid, then post the code it gives you.",
      // Not retryable: waiting changes nothing, the wallet is simply not the
      // one the code was issued for.
      retryable: false,
    };
  }

  if (now - pending.started_at > VERIFICATION_TTL_MS) {
    return {
      ok: false,
      reason: "This verification code has expired. Start again for a new one.",
      retryable: false,
    };
  }

  return { ok: true };
}

/** Whether the code appears somewhere only the account owner can edit. */
export function codeIsPresent(
  pending: VerificationRow,
  fields: { bio?: string | null; displayName?: string | null },
): boolean {
  const haystack = `${fields.bio ?? ""}\n${fields.displayName ?? ""}`.toLowerCase();
  return haystack.includes(pending.code.toLowerCase());
}
