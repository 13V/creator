import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Whether a request carries the operator's bearer token.
 *
 * Shared by every route that spends money or reveals configuration, so there
 * is one door rather than a copy of the check per endpoint drifting apart.
 *
 * Never accepts a platform-set header such as `x-vercel-cron` on its own: that
 * header is set by the host rather than proven by it, so trusting its presence
 * would make these endpoints anyone's to call. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` on scheduled runs, so a scheduled
 * invocation comes through this same door.
 *
 * With no ADMIN_TOKEN configured nothing is authorised — an unset secret must
 * close the door, not remove it.
 */
export function isAdmin(request: Request): boolean {
  const token = env().ADMIN_TOKEN;
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
