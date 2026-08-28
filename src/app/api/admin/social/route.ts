import { handleError, ok } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { env } from "@/lib/env";
import { resolveX } from "@/lib/social/x";
import type { FetchFailure } from "@/lib/social/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Why the X lookup is not returning a real profile.
 *
 * Every profile on the board was arriving with `verifiedUpstream: false` — no
 * display name, no bio, no follower count, and no numeric id, which also
 * forces every X launch onto the managed escrow path instead of pump.fun's
 * native social vault. The resolver degrades to a fallback on any failure and
 * says nothing about which one, so from the outside a rejected token, an
 * endpoint the plan does not include, a rate limit and a suspended account all
 * look identical.
 *
 * The credential itself is never returned or logged — only its length and
 * first four characters, which is enough to tell "wrong value pasted" from
 * "value rejected" without putting the secret in a response body.
 */
export async function GET(request: Request) {
  try {
    if (!isAdmin(request)) {
      // Same shape as any other miss, so this endpoint does not confirm its
      // own existence to an unauthenticated caller.
      return new Response("Not found", { status: 404 });
    }

    const handle = new URL(request.url).searchParams.get("handle") ?? "naval";
    const token = env().X_BEARER_TOKEN;

    const failures: FetchFailure[] = [];
    const profile = await resolveX(handle, (f) => failures.push(f));

    return ok({
      handle,
      token: token
        ? { present: true, length: token.length, prefix: token.slice(0, 4) }
        : { present: false },
      verifiedUpstream: profile.verifiedUpstream,
      resolved: {
        displayName: profile.displayName,
        hasBio: Boolean(profile.bio),
        followers: profile.followers,
        platformUserId: profile.platformUserId,
        avatarUrl: profile.avatarUrl,
      },
      failures,
      hint:
        failures[0]?.status === 401
          ? "X rejected the credential. Regenerate the bearer token in the X developer portal."
          : failures[0]?.status === 403
            ? "The token is valid but this endpoint is not included in its access tier. GET /2/users/by/username requires a paid X API tier."
            : failures[0]?.status === 429
              ? "Rate limited by X. The free and basic tiers allow very few user lookups per window."
              : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
