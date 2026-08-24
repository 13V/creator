import type { Platform } from "../social/types";

/**
 * Per-platform OAuth configuration.
 *
 * Kept declarative and free of `server-only` so the URL building and the
 * identity parsing can be tested without a network. Every provider here is
 * the authorization-code flow: the creator signs in at the platform and comes
 * back with a code we exchange for a token that names them.
 */

export interface OAuthIdentity {
  /** The handle as the platform spells it, without a leading `@`. */
  handle: string;
  /** Stable numeric or opaque id, where the platform gives one. */
  id: string | null;
}

export interface ProviderConfig {
  platform: Platform;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Whether the token exchange sends client credentials as a Basic header. */
  basicAuth: boolean;
  /** X and TikTok require PKCE; the others accept it but do not need it. */
  pkce: boolean;
  /** Extra parameters the provider needs on the authorize URL. */
  authorizeExtras?: Record<string, string>;
  /** Where the access token is spent to learn who signed in. */
  identityUrl: string;
  /** Pulls the handle out of that endpoint's response shape. */
  parseIdentity(body: unknown): OAuthIdentity | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pick(body: unknown, ...path: string[]): unknown {
  let node: unknown = body;
  for (const key of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

export const PROVIDERS: Record<Platform, ProviderConfig> = {
  x: {
    platform: "x",
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    // `users.read` alone is rejected; X requires `tweet.read` alongside it.
    scopes: ["users.read", "tweet.read"],
    basicAuth: true,
    pkce: true,
    identityUrl: "https://api.x.com/2/users/me",
    parseIdentity(body) {
      const handle = str(pick(body, "data", "username"));
      return handle ? { handle, id: str(pick(body, "data", "id")) } : null;
    },
  },

  reddit: {
    platform: "reddit",
    authorizeUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["identity"],
    basicAuth: true,
    pkce: false,
    // Without `duration=temporary` Reddit issues a refresh token we have no
    // use for and would then be storing for no reason.
    authorizeExtras: { duration: "temporary" },
    identityUrl: "https://oauth.reddit.com/api/v1/me",
    parseIdentity(body) {
      const handle = str(pick(body, "name"));
      return handle ? { handle, id: str(pick(body, "id")) } : null;
    },
  },

  instagram: {
    platform: "instagram",
    authorizeUrl: "https://www.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    /*
     * Basic Display was shut down at the end of 2024, so this is Instagram
     * Login on the Instagram API — which only covers Business and Creator
     * accounts. A personal account cannot complete this flow at all, which is
     * why the code fallback stays reachable for Instagram.
     */
    scopes: ["instagram_business_basic"],
    basicAuth: false,
    pkce: false,
    identityUrl: "https://graph.instagram.com/v21.0/me?fields=id,username",
    parseIdentity(body) {
      const handle = str(pick(body, "username"));
      return handle ? { handle, id: str(pick(body, "id")) } : null;
    },
  },

  tiktok: {
    platform: "tiktok",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    // `user.info.profile` is what carries the username; basic gives only a
    // display name, which is not a handle and cannot be matched against one.
    scopes: ["user.info.basic", "user.info.profile"],
    basicAuth: false,
    pkce: true,
    // TikTok names its client id `client_key` everywhere, including here.
    authorizeExtras: {},
    identityUrl: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,username",
    parseIdentity(body) {
      const handle = str(pick(body, "data", "user", "username"));
      return handle ? { handle, id: str(pick(body, "data", "user", "open_id")) } : null;
    },
  },
};

/** Builds the URL the creator is sent to in order to sign in. */
export function authorizeUrl(
  provider: ProviderConfig,
  params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge?: string;
  },
): string {
  const url = new URL(provider.authorizeUrl);
  const query = url.searchParams;

  // TikTok is the odd one out and calls it `client_key`.
  query.set(provider.platform === "tiktok" ? "client_key" : "client_id", params.clientId);
  query.set("redirect_uri", params.redirectUri);
  query.set("response_type", "code");
  query.set("scope", provider.scopes.join(provider.platform === "tiktok" ? "," : " "));
  query.set("state", params.state);

  if (provider.pkce && params.codeChallenge) {
    query.set("code_challenge", params.codeChallenge);
    query.set("code_challenge_method", "S256");
  }
  for (const [key, value] of Object.entries(provider.authorizeExtras ?? {})) {
    query.set(key, value);
  }

  return url.toString();
}

/**
 * Whether the account that signed in is the one being claimed.
 *
 * Case-insensitive because every one of these platforms treats handles that
 * way, and a creator typing `@MrBeast` must not be told they are somebody
 * else. Nothing else is normalised: a near-miss is a different account.
 */
export function handleMatches(claimed: string, authenticated: string): boolean {
  return (
    claimed.trim().replace(/^@+/, "").toLowerCase() ===
    authenticated.trim().replace(/^@+/, "").toLowerCase()
  );
}
