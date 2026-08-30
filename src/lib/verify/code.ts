import "server-only";

import { hasUpstreamCredentials } from "../env";
import { invalidateProfile, resolveProfile } from "../social/resolve";
import { PLATFORM_LABELS } from "../social/types";
import type { CreatorRow, VerificationRow } from "../repo";
import {
  checkPending,
  codeIsPresent,
  provedBySignIn,
  type VerificationResult,
} from "./policy";

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

  /*
   * A sign-in is proof from the platform itself. There is nothing to look for
   * on the profile, and insisting on a live read anyway would break claiming
   * for exactly the platforms that refuse anonymous reads.
   */
  if (provedBySignIn(pending)) return { ok: true };

  invalidateProfile(creator.platform, creator.handle);
  const profile = await resolveProfile(creator.platform, creator.handle);

  if (!profile.verifiedUpstream) {
    /*
     * Two very different failures wore the same message. Without the
     * platform's credentials this read cannot succeed on any attempt, and
     * telling a creator with real money in escrow that it is "usually rate
     * limiting, try again in a few minutes" sends them into a loop that
     * never terminates. Say which one it is.
     */
    if (!hasUpstreamCredentials(creator.platform)) {
      return {
        ok: false,
        reason:
          `Backd cannot confirm ${PLATFORM_LABELS[creator.platform]} profiles on this ` +
          "deployment — the API access that requires is not configured, so retrying " +
          "will not help. Your fees are safe and still accruing; claiming opens as " +
          "soon as it is.",
        retryable: false,
      };
    }

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
