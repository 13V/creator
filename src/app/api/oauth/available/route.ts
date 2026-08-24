import { handleError, ok } from "@/lib/api";
import { oauthAvailable } from "@/lib/oauth/server";
import { PLATFORMS, type Platform } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which platforms can actually complete a sign-in on this deployment.
 *
 * The claim page asks before rendering a Connect button: offering one that
 * dead-ends on a missing client id is worse than not offering it.
 */
export async function GET() {
  try {
    const available = {} as Record<Platform, boolean>;
    for (const platform of PLATFORMS) {
      available[platform] = oauthAvailable(platform);
    }
    return ok({ available });
  } catch (error) {
    return handleError(error);
  }
}
