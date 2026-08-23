import { fetchJson, unavatarUrl } from "./http";
import { profileUrl } from "./parse";
import type { SocialProfile } from "./types";

interface TikTokOEmbed {
  author_name?: string;
  author_unique_id?: string;
  thumbnail_url?: string;
  title?: string;
}

/**
 * TikTok exposes a public, unauthenticated oEmbed endpoint for creator
 * profiles, which is the only stable source that does not require scraping.
 * It gives us a display name and avatar but no follower count or numeric id.
 */
export async function resolveTikTok(handle: string): Promise<SocialProfile> {
  const url = profileUrl("tiktok", handle);

  const data = await fetchJson<TikTokOEmbed>(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  );

  if (!data?.author_name) {
    return {
      platform: "tiktok",
      handle,
      platformUserId: null,
      displayName: null,
      avatarUrl: unavatarUrl("tiktok", handle),
      bio: null,
      followers: null,
      profileUrl: url,
      verifiedUpstream: false,
    };
  }

  return {
    platform: "tiktok",
    handle: data.author_unique_id || handle,
    platformUserId: null,
    displayName: data.author_name,
    avatarUrl: data.thumbnail_url || unavatarUrl("tiktok", handle),
    bio: null,
    followers: null,
    profileUrl: url,
    verifiedUpstream: true,
  };
}
