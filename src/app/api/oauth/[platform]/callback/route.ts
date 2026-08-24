import { NextResponse } from "next/server";

import { handleError } from "@/lib/api";
import { previewEscrow } from "@/lib/escrow";
import {
  credentialsFor,
  exchangeCode,
  fetchIdentity,
  providerFor,
  stateSecret,
} from "@/lib/oauth/server";
import { handleMatches } from "@/lib/oauth/providers";
import { decodeState } from "@/lib/oauth/state";
import { resolveSiteUrl } from "@/lib/siteUrl";
import { getCreator, markProved, upsertCreator } from "@/lib/repo";
import { resolveProfile } from "@/lib/social/resolve";
import { isPlatform } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends the creator back to the claim page with the outcome in the URL. */
function back(params: Record<string, string>): NextResponse {
  const url = new URL("/claim", resolveSiteUrl());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/**
 * Completes a sign-in and records that this handle belongs to this wallet.
 *
 * Three things have to hold, and any one of them failing means no proof:
 *
 *  1. The `state` verifies. It carries the destination wallet, so an
 *     unsigned or edited one would let somebody redirect a payout.
 *  2. The platform hands back an account when we spend the code.
 *  3. That account *is* the handle being claimed. Without this last check,
 *     signing in as anybody would prove ownership of everybody — the whole
 *     point of the flow.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const { platform } = await params;
    if (!isPlatform(platform)) return back({ error: "Unknown platform." });

    const url = new URL(request.url);

    // The creator declined, or the platform refused.
    const denied = url.searchParams.get("error");
    if (denied) {
      return back({ error: "Sign-in was cancelled." });
    }

    const code = url.searchParams.get("code");
    const rawState = url.searchParams.get("state");
    if (!code || !rawState) return back({ error: "That sign-in came back incomplete." });

    const decoded = decodeState(rawState, stateSecret());
    if (!decoded.ok) return back({ error: decoded.reason });

    const { handle, wallet, verifier } = decoded.state;
    if (decoded.state.platform !== platform) {
      return back({ error: "That sign-in came back for a different platform." });
    }

    const credentials = credentialsFor(platform);
    if (!credentials) return back({ error: "Sign-in is not configured." });

    const provider = providerFor(platform);
    const token = await exchangeCode(provider, credentials, { code, verifier });
    if (!token) return back({ error: "That platform would not complete the sign-in." });

    const identity = await fetchIdentity(provider, token);
    if (!identity) {
      return back({ error: "Could not read the account that signed in." });
    }

    /*
     * The account that signed in must be the one being claimed. Anyone can
     * sign in as themselves; only the owner of @handle can sign in as @handle.
     */
    if (!handleMatches(handle, identity.handle)) {
      return back({
        platform,
        handle,
        error:
          `You signed in as @${identity.handle}, but this claim is for ` +
          `@${handle}. Sign in with that account instead.`,
      });
    }

    // Use the handle as the platform spells it, not as it was typed.
    const profile = await resolveProfile(platform, identity.handle);
    const escrow = previewEscrow(profile);
    if (!escrow.available) {
      return back({ error: escrow.reason ?? "Escrow is not configured." });
    }

    const creator =
      (await getCreator(platform, identity.handle)) ??
      (await upsertCreator(profile, escrow.kind, escrow.pubkey));

    await markProved(creator.id, wallet, identity.id);

    return back({ platform, handle: identity.handle, proved: "1", wallet });
  } catch (error) {
    // A thrown error here still has to land the creator back on the page.
    console.error("oauth callback failed:", error);
    return handleError(error);
  }
}
