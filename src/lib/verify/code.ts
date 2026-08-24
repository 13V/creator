import "server-only";

import { invalidateProfile, resolveProfile } from "../social/resolve";
import { PLATFORM_LABELS } from "../social/types";
import type { CreatorRow, VerificationRow } from "../repo";
import { checkPending, codeIsPresent, type VerificationResult } from "./policy";

export {
  VERIFICATION_TTL_MS,
  generateVerificationCode,
  verificationInstructions,
  type VerificationResult,
} from "./policy";

/**
 * Confirms the creator controls the handle by looking for their one-time code
 * in a field only the account owner can edit.
 *
 * `pending` is the verification issued for *this destination wallet*. The code
 * sits in a public bio, so matching it against the handle alone would let
 * whoever read it first claim the escrow to an address of their own — see
 * `checkPending`, which is where that rule lives and is tested.
 *
 * The upstream cache is dropped first, otherwise a profile fetched moments
 * before the creator edited their bio would keep failing for five minutes.
 */
export async function checkVerification(
  creator: CreatorRow,
  pending: VerificationRow | null,
): Promise<VerificationResult> {
  const gate = checkPending(pending);
  if (!gate.ok) return gate;

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

  if (!codeIsPresent(pending!, profile)) {
    return {
      ok: false,
      reason: `Could not find ${pending!.code} on the profile yet.`,
      retryable: true,
    };
  }

  return { ok: true };
}
