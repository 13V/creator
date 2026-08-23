import "server-only";

import { randomBytes } from "node:crypto";

import { invalidateProfile } from "../social/resolve";
import { resolveProfile } from "../social/resolve";
import { PLATFORM_LABELS, type Platform } from "../social/types";
import type { CreatorRow } from "../repo";

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
    case "x":
      return "Add the code anywhere in your X bio, or to your display name.";
  }
}

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: string; retryable: boolean };

/**
 * Confirms the creator controls the handle by looking for their one-time code
 * in a field only the account owner can edit.
 *
 * The upstream cache is dropped first, otherwise a profile fetched moments
 * before the creator edited their bio would keep failing for five minutes.
 */
export async function checkVerification(
  creator: CreatorRow,
): Promise<VerificationResult> {
  if (!creator.verification_code || !creator.verification_started_at) {
    return { ok: false, reason: "No verification is in progress.", retryable: false };
  }

  if (Date.now() - creator.verification_started_at > VERIFICATION_TTL_MS) {
    return {
      ok: false,
      reason: "This verification code has expired. Start again for a new one.",
      retryable: false,
    };
  }

  invalidateProfile(creator.platform, creator.handle);
  const profile = await resolveProfile(creator.platform, creator.handle);

  if (!profile.verifiedUpstream) {
    return {
      ok: false,
      reason:
        `Could not read the live ${PLATFORM_LABELS[creator.platform]} profile right now. ` +
        "This is usually upstream rate limiting — try again in a few minutes.",
      retryable: true,
    };
  }

  const haystack = `${profile.bio ?? ""}\n${profile.displayName ?? ""}`.toLowerCase();
  if (!haystack.includes(creator.verification_code.toLowerCase())) {
    return {
      ok: false,
      reason: `Could not find ${creator.verification_code} on the profile yet.`,
      retryable: true,
    };
  }

  return { ok: true };
}
