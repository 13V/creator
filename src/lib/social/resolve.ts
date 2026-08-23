import { resolveInstagram } from "./instagram";
import { resolveTikTok } from "./tiktok";
import { resolveX } from "./x";
import type { Platform, SocialProfile } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;

const cache = new Map<string, { at: number; profile: SocialProfile }>();

/**
 * Resolves a profile from the upstream platform.
 *
 * Every provider is written to succeed with partial data rather than throw, so
 * a rate-limited upstream degrades the UI instead of blocking a launch.
 */
export async function resolveProfile(
  platform: Platform,
  handle: string,
): Promise<SocialProfile> {
  const key = `${platform}:${handle.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.profile;

  let profile: SocialProfile;
  switch (platform) {
    case "x":
      profile = await resolveX(handle);
      break;
    case "instagram":
      profile = await resolveInstagram(handle);
      break;
    case "tiktok":
      profile = await resolveTikTok(handle);
      break;
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), profile });
  return profile;
}

/** Drops a cached profile so the next read re-fetches (used by claim verification). */
export function invalidateProfile(platform: Platform, handle: string): void {
  cache.delete(`${platform}:${handle.toLowerCase()}`);
}
