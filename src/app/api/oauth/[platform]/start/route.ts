import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { fail, handleError, tooManyRequests } from "@/lib/api";
import { authorizeUrl } from "@/lib/oauth/providers";
import {
  challengeFor,
  encodeState,
  newNonce,
  newVerifier,
} from "@/lib/oauth/state";
import {
  credentialsFor,
  providerFor,
  redirectUri,
  stateSecret,
} from "@/lib/oauth/server";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { isValidHandle } from "@/lib/social/parse";
import { isPlatform, PLATFORM_LABELS } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends a creator to their platform to sign in.
 *
 * The wallet travels inside the signed `state`, not in a cookie or a session:
 * the callback has to know where to pay, and signing it is what stops anyone
 * swapping that address on the way back. Nothing is stored server-side, so
 * this works on a serverless deployment with no memory between the two legs.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const gate = checkRateLimit(`oauth-start:${clientKey(request)}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const { platform } = await params;
    if (!isPlatform(platform)) return fail("Unknown platform.", 404);

    const url = new URL(request.url);
    const handle = (url.searchParams.get("handle") ?? "").replace(/^@+/, "").trim();
    const wallet = url.searchParams.get("wallet") ?? "";

    if (!isValidHandle(platform, handle)) {
      return fail(`That is not a valid ${PLATFORM_LABELS[platform]} handle.`);
    }
    try {
      new PublicKey(wallet);
    } catch {
      return fail("Connect the wallet you want paid before signing in.");
    }

    const credentials = credentialsFor(platform);
    if (!credentials) {
      return fail(
        `${PLATFORM_LABELS[platform]} sign-in is not configured on this deployment.`,
        503,
      );
    }

    const provider = providerFor(platform);
    const verifier = provider.pkce ? newVerifier() : null;

    const state = encodeState(
      {
        platform,
        handle,
        wallet,
        verifier,
        nonce: newNonce(),
        issuedAt: Date.now(),
      },
      stateSecret(),
    );

    return NextResponse.redirect(
      authorizeUrl(provider, {
        clientId: credentials.clientId,
        redirectUri: redirectUri(platform),
        state,
        codeChallenge: verifier ? challengeFor(verifier) : undefined,
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
