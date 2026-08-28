import { env } from "../env";
import { fetchJson, unavatarUrl, type FetchFailure } from "./http";
import { profileUrl } from "./parse";
import type { SocialProfile } from "./types";

interface XApiUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: { followers_count?: number };
}

/**
 * Resolves an X profile.
 *
 * The numeric `id` matters well beyond display: pump.fun's native social fee
 * vault is keyed on it, so without a bearer token we cannot use the
 * non-custodial escrow path at all. We still return a usable profile so the UI
 * can render, but `platformUserId` stays null and the caller downgrades to a
 * managed escrow.
 */
export async function resolveX(
  handle: string,
  onFailure?: (f: FetchFailure) => void,
): Promise<SocialProfile> {
  const fallback: SocialProfile = {
    platform: "x",
    handle,
    platformUserId: null,
    displayName: null,
    avatarUrl: unavatarUrl("x", handle),
    bio: null,
    followers: null,
    profileUrl: profileUrl("x", handle),
    verifiedUpstream: false,
  };

  const token = env().X_BEARER_TOKEN;
  if (!token) {
    onFailure?.({ status: null, detail: "X_BEARER_TOKEN is not set" });
    return fallback;
  }

  const fields = "profile_image_url,description,public_metrics";
  const body = await fetchJson<{ data?: XApiUser; errors?: unknown }>(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=${fields}`,
    { headers: { authorization: `Bearer ${token}` }, onFailure },
  );

  const user = body?.data;
  if (!user) {
    // A 200 with no `data` is X reporting a suspended, renamed or absent
    // account, which is a different problem from a rejected credential.
    if (body) onFailure?.({ status: 200, detail: "200 OK but no user in payload" });
    return fallback;
  }

  return {
    platform: "x",
    handle: user.username || handle,
    platformUserId: user.id,
    displayName: user.name ?? null,
    // `_normal` is 48px; `_400x400` is the largest square variant.
    avatarUrl: user.profile_image_url
      ? user.profile_image_url.replace("_normal", "_400x400")
      : unavatarUrl("x", handle),
    bio: user.description ?? null,
    followers: user.public_metrics?.followers_count ?? null,
    profileUrl: profileUrl("x", user.username || handle),
    verifiedUpstream: true,
  };
}
