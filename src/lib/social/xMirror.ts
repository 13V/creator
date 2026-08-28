import { fetchJson } from "./http";

/**
 * A free read of an X profile, for display only.
 *
 * X's own API moved to paid pay-per-use in February 2026, and without a
 * funded token `resolveX` can return nothing but the handle you typed and a
 * guessed avatar — so every creator on the board looked like a broken image
 * and an empty name. FxTwitter (the FixTweet project) proxies the same public
 * profile fields and needs no credential, which restores the display without
 * a bill.
 *
 * What it deliberately does NOT supply is the numeric user id. That id is the
 * key to pump.fun's native social fee vault — the wallet the creator alone can
 * withdraw from — so whatever provides it decides who can take real money out.
 * A community mirror is a fine source for a bio and an avatar and the wrong
 * source for that. When the official API is unfunded the id stays null and the
 * launch falls back to a managed escrow, exactly as it did before; see
 * `previewEscrow`.
 */
interface FxUser {
  id?: string;
  name?: string;
  screen_name?: string;
  description?: string;
  followers?: number;
  avatar_url?: string;
}

export interface MirrorProfile {
  displayName: string | null;
  bio: string | null;
  followers: number | null;
  avatarUrl: string | null;
}

export async function fetchXMirror(handle: string): Promise<MirrorProfile | null> {
  const body = await fetchJson<{ user?: FxUser }>(
    `https://api.fxtwitter.com/${encodeURIComponent(handle)}`,
    // Shorter than the default: this runs while someone is typing, and a slow
    // mirror should cost a bio, not the whole lookup.
    { timeoutMs: 4_000 },
  );

  const user = body?.user;
  if (!user) return null;

  return {
    displayName: user.name ?? null,
    // An account with no bio returns "", which is not the same as a failed
    // lookup and must not render as one.
    bio: user.description ? user.description : null,
    followers: typeof user.followers === "number" ? user.followers : null,
    // X serves several square crops of the same file; `_200x200` is the
    // largest that is always present, where `_400x400` 404s on some accounts.
    avatarUrl: user.avatar_url ? user.avatar_url.replace("_normal", "_200x200") : null,
  };
}
