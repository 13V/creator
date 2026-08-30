import { env } from "../env";
import { fetchJson, fetchWithTimeout, unavatarUrl } from "./http";
import { profileUrl } from "./parse";
import type { SocialProfile } from "./types";

/**
 * Reddit profile lookups.
 *
 * Unlike TikTok, Reddit has no usable anonymous endpoint any more: every
 * unauthenticated request to `/user/<name>/about.json` returns 403 whatever
 * user agent it carries, from a browser string to their own documented bot
 * format. Measured against `www.reddit.com`, `old.reddit.com` and
 * `api.reddit.com` — all three.
 *
 * So this uses the free application-only OAuth flow. Without credentials a
 * Reddit handle still resolves well enough to launch a coin for, but comes
 * back `verifiedUpstream: false`, which makes claiming impossible — the claim
 * requires a live profile read to find the code. That is the right way round:
 * no credentials means nobody can prove ownership, rather than everybody.
 */

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";

/** Reddit asks for a descriptive agent and rate limits harder without one. */
const USER_AGENT = "web:backd:v1.0 (by /u/backd)";

interface RedditAbout {
  data?: {
    name?: string;
    icon_img?: string;
    total_karma?: number;
    subreddit?: {
      title?: string;
      public_description?: string;
      icon_img?: string;
    };
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * An application-only bearer token, reused until shortly before it expires.
 *
 * Tokens last an hour and every lookup would otherwise buy a new one, which
 * is both slow and the fastest way to get rate limited.
 */
async function accessToken(): Promise<string | null> {
  const id = env().REDDIT_CLIENT_ID;
  const secret = env().REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  try {
    const res = await fetchWithTimeout(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;

    // Retire it a minute early rather than racing the expiry.
    const ttl = Math.max(60, (body.expires_in ?? 3600) - 60);
    cachedToken = { value: body.access_token, expiresAt: Date.now() + ttl * 1000 };
    return cachedToken.value;
  } catch {
    return null;
  }
}

/** Reddit hands back HTML-escaped image URLs. */
function unescapeUrl(url: string | undefined): string | null {
  if (!url) return null;
  const clean = url.replace(/&amp;/g, "&").split("?")[0];
  return clean.startsWith("http") ? clean : null;
}

export async function resolveReddit(handle: string): Promise<SocialProfile> {
  const url = profileUrl("reddit", handle);
  const fallback: SocialProfile = {
    platform: "reddit",
    handle,
    platformUserId: null,
    displayName: null,
    avatarUrl: unavatarUrl("reddit", handle),
    bio: null,
    followers: null,
    profileUrl: url,
    verifiedUpstream: false,
  };

  const token = await accessToken();
  if (!token) return fallback;

  const data = await fetchJson<RedditAbout>(
    `${API}/user/${encodeURIComponent(handle)}/about`,
    { headers: { authorization: `Bearer ${token}`, "user-agent": USER_AGENT } },
  );

  const about = data?.data;
  if (!about?.name) return fallback;

  const sub = about.subreddit ?? {};
  return {
    platform: "reddit",
    handle: about.name,
    // `t2_…` ids exist but pump.fun's social vault is X-only, so nothing
    // downstream can use one. Left null rather than implying otherwise.
    platformUserId: null,
    displayName: sub.title || about.name,
    avatarUrl:
      unescapeUrl(about.icon_img) ??
      unescapeUrl(sub.icon_img) ??
      unavatarUrl("reddit", handle),
    // The profile description is the field a Reddit user can edit, so it is
    // where the verification code goes.
    bio: sub.public_description ?? null,
    followers: about.total_karma ?? null,
    profileUrl: url,
    verifiedUpstream: true,
  };
}
