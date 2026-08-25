import "server-only";

import { hkdfSync } from "node:crypto";

import { decodeMasterSeed } from "../escrow/derive";
import { env } from "../env";
import { resolveSiteUrl } from "../siteUrl";
import type { Platform } from "../social/types";
import { PROVIDERS, type OAuthIdentity, type ProviderConfig } from "./providers";

/**
 * The server half of OAuth sign-in: credentials, the state secret, and the
 * two calls that turn a callback code into a name.
 */

const HKDF_INFO_OAUTH = "creator-launchpad/oauth-state/v1";

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Per-platform app credentials.
 *
 * Null when a platform has not been set up, which is not an error: the claim
 * page only offers sign-in for the platforms that can actually complete it.
 */
export function credentialsFor(platform: Platform): Credentials | null {
  const e = env();
  const pairs: Record<Platform, [string | undefined, string | undefined]> = {
    x: [e.X_OAUTH_CLIENT_ID, e.X_OAUTH_CLIENT_SECRET],
    reddit: [e.REDDIT_CLIENT_ID, e.REDDIT_CLIENT_SECRET],
    instagram: [e.INSTAGRAM_CLIENT_ID, e.INSTAGRAM_CLIENT_SECRET],
    tiktok: [e.TIKTOK_CLIENT_KEY, e.TIKTOK_CLIENT_SECRET],
  };
  const [clientId, clientSecret] = pairs[platform];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function oauthAvailable(platform: Platform): boolean {
  return credentialsFor(platform) !== null;
}

/**
 * Signing key for the `state` parameter, derived from the master seed under
 * its own label so sign-in adds no new secret to look after.
 */
export function stateSecret(): Buffer {
  const seed = env().ESCROW_MASTER_SEED;
  if (!seed) throw new Error("ESCROW_MASTER_SEED is required for OAuth sign-in");
  return Buffer.from(
    hkdfSync("sha256", decodeMasterSeed(seed), Buffer.alloc(0), HKDF_INFO_OAUTH, 32),
  );
}

/**
 * The callback address, which must match what is registered with each app
 * exactly — providers compare it as a string, not as a URL.
 */
export function redirectUri(platform: Platform): string {
  return new URL(`/api/oauth/${platform}/callback`, resolveSiteUrl()).toString();
}

export function providerFor(platform: Platform): ProviderConfig {
  return PROVIDERS[platform];
}

/** Exchanges the callback code for an access token. */
export async function exchangeCode(
  provider: ProviderConfig,
  credentials: Credentials,
  params: { code: string; verifier: string | null },
): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: redirectUri(provider.platform),
  });
  if (params.verifier) body.set("code_verifier", params.verifier);

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
    "user-agent": "web:backd:v1.0",
  };

  if (provider.basicAuth) {
    const pair = `${credentials.clientId}:${credentials.clientSecret}`;
    headers.authorization = `Basic ${Buffer.from(pair).toString("base64")}`;
    // X wants the client id in the body as well as the header.
    body.set("client_id", credentials.clientId);
  } else if (provider.platform === "tiktok") {
    body.set("client_key", credentials.clientId);
    body.set("client_secret", credentials.clientSecret);
  } else {
    body.set("client_id", credentials.clientId);
    body.set("client_secret", credentials.clientSecret);
  }

  try {
    const res = await fetch(provider.tokenUrl, { method: "POST", headers, body });
    if (!res.ok) {
      console.error(`${provider.platform} token exchange failed:`, res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (error) {
    console.error(`${provider.platform} token exchange threw:`, error);
    return null;
  }
}

/** Spends the token to learn which account signed in. */
export async function fetchIdentity(
  provider: ProviderConfig,
  token: string,
): Promise<OAuthIdentity | null> {
  try {
    const res = await fetch(provider.identityUrl, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": "web:backd:v1.0",
      },
    });
    if (!res.ok) {
      console.error(`${provider.platform} identity lookup failed:`, res.status);
      return null;
    }
    return provider.parseIdentity(await res.json());
  } catch (error) {
    console.error(`${provider.platform} identity lookup threw:`, error);
    return null;
  }
}
