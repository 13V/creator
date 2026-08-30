import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Constant-time comparison of a request's bearer against one expected secret.
 *
 * An unset secret authorises nothing — it must close the door, not remove it,
 * which is why this returns false rather than true on `undefined`.
 */
function bearerMatches(request: Request, token: string | undefined): boolean {
  if (!token) return false;

  const offered = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${token}`;

  /*
   * Length is compared first because timingSafeEqual throws on a mismatch, and
   * separately because it is not itself secret — an attacker learning the
   * token's length learns nothing worth having, whereas a plain `===` would
   * leak its prefix one character at a time.
   */
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Whether a request carries the operator's bearer token.
 *
 * Shared by every route that spends money or reveals configuration, so there
 * is one door rather than a copy of the check per endpoint drifting apart.
 *
 * Never accepts a platform-set header such as `x-vercel-cron` on its own: that
 * header is set by the host rather than proven by it, so trusting its presence
 * would make these endpoints anyone's to call.
 */
export function isAdmin(request: Request): boolean {
  return bearerMatches(request, env().ADMIN_TOKEN);
}

/**
 * Whether a request may crank the scheduled payout job.
 *
 * Vercel signs a scheduled run with CRON_SECRET, and the operator triggers the
 * same route by hand with ADMIN_TOKEN, so both open this door. They were the
 * same string, which meant the hourly crank authorised by coincidence:
 * rotating ADMIN_TOKEN alone would have halted every creator payout silently,
 * because a cron that 401s looks exactly like a cron with nothing to do.
 *
 * Accepting either decouples them. It widens nothing — this route sends money
 * to creators' own escrows and to nobody else, and `distributeCreatorFees`
 * needs no signature in the first place, so an unauthorised caller getting in
 * would only be paying creators early at their own expense.
 */
export function isCronCaller(request: Request): boolean {
  const { ADMIN_TOKEN, CRON_SECRET } = env();
  // Not `||`: both are compared, so a wrong ADMIN_TOKEN cannot short-circuit
  // a correct CRON_SECRET.
  const admin = bearerMatches(request, ADMIN_TOKEN);
  const cron = bearerMatches(request, CRON_SECRET);
  return admin || cron;
}
