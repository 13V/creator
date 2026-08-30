import { handleError, ok } from "@/lib/api";
import { hasUpstreamCredentials, hasXCredentials } from "@/lib/env";
import { oauthAvailable } from "@/lib/oauth/server";
import { PLATFORMS, type Platform } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which platforms can actually complete a sign-in on this deployment, and
 * whether X launches can reach pump.fun's native vault.
 *
 * The claim page asks before rendering a Connect button: offering one that
 * dead-ends on a missing client id is worse than not offering it.
 *
 * `nativeX` is here for the same reason. The X card used to state flatly that
 * this launchpad holds no key to a claimer's fees, which is only true when the
 * coin got a native escrow — and that requires a funded X token to confirm the
 * account id. Unfunded, every X coin gets a managed escrow this launchpad
 * *does* hold the key to, and the card was telling creators the opposite.
 */
export async function GET() {
  try {
    const available = {} as Record<Platform, boolean>;
    const claimable = {} as Record<Platform, boolean>;
    for (const platform of PLATFORMS) {
      available[platform] = oauthAvailable(platform);
      /*
       * A claim finishes one of two ways: a sign-in, or a one-time code read
       * back off the live profile. With neither route open the card must not
       * offer a field to type into — the honest answer is "not yet", not
       * "try and find out".
       */
      claimable[platform] = available[platform] || hasUpstreamCredentials(platform);
    }
    return ok({ available, claimable, nativeX: hasXCredentials() });
  } catch (error) {
    return handleError(error);
  }
}
