import { fetchJson, unavatarUrl } from "./http";
import { profileUrl } from "./parse";
import type { SocialProfile } from "./types";

interface IgResponse {
  data?: {
    user?: {
      pk?: string;
      id?: string;
      full_name?: string;
      biography?: string;
      profile_pic_url_hd?: string;
      profile_pic_url?: string;
      edge_followed_by?: { count?: number };
    };
  };
}

/** Public web app id Instagram's own front-end sends; required or the call 403s. */
const IG_APP_ID = "936619743392459";

/**
 * Instagram has no public profile API. The web endpoint below works but is
 * aggressively rate limited per-IP and often demands a session, so a null
 * result here is expected rather than exceptional — we degrade to an avatar
 * proxy and let the launcher fill in the name by hand.
 */
export async function resolveInstagram(handle: string): Promise<SocialProfile> {
  const fallback: SocialProfile = {
    platform: "instagram",
    handle,
    platformUserId: null,
    displayName: null,
    avatarUrl: unavatarUrl("instagram", handle),
    bio: null,
    followers: null,
    profileUrl: profileUrl("instagram", handle),
    verifiedUpstream: false,
  };

  const body = await fetchJson<IgResponse>(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
    { headers: { "x-ig-app-id": IG_APP_ID } },
  );

  const user = body?.data?.user;
  if (!user) return fallback;

  return {
    platform: "instagram",
    handle,
    platformUserId: user.pk ?? user.id ?? null,
    displayName: user.full_name || null,
    avatarUrl: user.profile_pic_url_hd || user.profile_pic_url || fallback.avatarUrl,
    bio: user.biography || null,
    followers: user.edge_followed_by?.count ?? null,
    profileUrl: profileUrl("instagram", handle),
    verifiedUpstream: true,
  };
}
