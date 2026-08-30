import { isPlatform, type Platform, type SocialRef } from "./types";

const HANDLE_RULES: Record<Platform, { pattern: RegExp; max: number }> = {
  x: { pattern: /^[A-Za-z0-9_]{1,15}$/, max: 15 },
  instagram: { pattern: /^[A-Za-z0-9._]{1,30}$/, max: 30 },
  tiktok: { pattern: /^[A-Za-z0-9._]{2,24}$/, max: 24 },
  // Reddit allows hyphens and underscores but no dots.
  reddit: { pattern: /^[A-Za-z0-9_-]{3,20}$/, max: 20 },
};

const HOST_PLATFORMS: Record<string, Platform> = {
  "x.com": "x",
  "twitter.com": "x",
  "mobile.twitter.com": "x",
  "vxtwitter.com": "x",
  "fxtwitter.com": "x",
  "instagram.com": "instagram",
  "instagr.am": "instagram",
  "tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "reddit.com": "reddit",
  "old.reddit.com": "reddit",
  "new.reddit.com": "reddit",
  "np.reddit.com": "reddit",
  "redd.it": "reddit",
};

/**
 * Path segments that are site chrome rather than profiles. Launching a coin for
 * `x.com/settings` would silently escrow fees to a handle nobody can claim.
 */
const RESERVED: Record<Platform, Set<string>> = {
  x: new Set([
    "home", "explore", "notifications", "messages", "settings", "search",
    "compose", "i", "intent", "share", "login", "signup", "about", "tos",
    "privacy", "download", "hashtag", "status",
  ]),
  instagram: new Set([
    "explore", "accounts", "direct", "reels", "stories", "p", "tv", "about",
    "developer", "legal", "privacy", "terms", "session", "emails",
  ]),
  tiktok: new Set([
    "foryou", "following", "explore", "live", "upload", "search", "legal",
    "about", "tag", "music", "discover", "video", "login", "signup",
  ]),
  reddit: new Set([
    "r", "u", "user", "settings", "submit", "search", "message", "login",
    "register", "premium", "coins", "topics", "best", "hot", "new", "top",
    "rising", "controversial", "wiki", "about", "help", "notifications",
  ]),
};

function stripHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** Normalises a handle for comparison and storage keys. */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export function isValidHandle(platform: Platform, handle: string): boolean {
  const rule = HANDLE_RULES[platform];
  if (!rule) return false;
  const bare = handle.replace(/^@+/, "");
  if (!rule.pattern.test(bare)) return false;
  // Instagram and TikTok forbid leading/trailing dots and runs of dots.
  if (
    (platform === "instagram" || platform === "tiktok") &&
    (/^\./.test(bare) || /\.$/.test(bare) || /\.\./.test(bare))
  ) {
    return false;
  }
  return !RESERVED[platform].has(bare.toLowerCase());
}

/**
 * Accepts a profile URL, an `@handle`, or a `platform:handle` pair and returns
 * the platform + handle, or null when the input is not a usable profile.
 */
export function parseSocialInput(
  raw: string,
  hint?: Platform,
): SocialRef | null {
  const input = raw.trim();
  if (!input) return null;

  // `x:mrbeast` / `tiktok:@khaby.lame`
  const prefixed = /^([a-z]+)\s*:\s*@?([A-Za-z0-9._]+)$/i.exec(input);
  if (prefixed && isPlatform(prefixed[1].toLowerCase())) {
    const platform = prefixed[1].toLowerCase() as Platform;
    return finalize(platform, prefixed[2]);
  }

  const looksLikeUrl = /^(https?:)?\/\//i.test(input) || /^[\w.-]+\.[a-z]{2,}\//i.test(input);
  if (looksLikeUrl) {
    const withScheme = /^https?:/i.test(input) ? input : `https://${input.replace(/^\/+/, "")}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      return null;
    }

    const platform = HOST_PLATFORMS[stripHost(url.hostname)];
    if (!platform) return null;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    /*
     * Reddit profiles are `/user/<name>` or the `/u/<name>` shorthand. A bare
     * first segment is a subreddit listing or site chrome, not a person, so it
     * is refused rather than escrowed to a handle nobody can claim.
     */
    if (platform === "reddit") {
      const [first, second] = segments;
      if ((first !== "user" && first !== "u") || !second) return null;
      return finalize(platform, second);
    }

    // TikTok profiles are always `/@handle`; anything else is a video or page.
    if (platform === "tiktok") {
      const first = segments[0];
      if (!first.startsWith("@")) return null;
      return finalize(platform, first.slice(1));
    }

    return finalize(platform, segments[0]);
  }

  // `u/spez` is how Reddit handles are written everywhere on Reddit.
  const redditShorthand = /^\/?u\/([A-Za-z0-9_-]+)$/i.exec(input);
  if (redditShorthand) return finalize("reddit", redditShorthand[1]);

  // Bare handle needs a platform hint to be unambiguous.
  const bare = input.replace(/^@+/, "");
  if (hint && /^[A-Za-z0-9._-]+$/.test(bare)) {
    return finalize(hint, bare);
  }

  return null;
}

function finalize(platform: Platform, rawHandle: string): SocialRef | null {
  const handle = rawHandle.replace(/^@+/, "").split(/[?#]/)[0];
  if (!isValidHandle(platform, handle)) return null;
  return { platform, handle };
}

export function profileUrl(platform: Platform, handle: string): string {
  switch (platform) {
    case "x":
      return `https://x.com/${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "reddit":
      return `https://www.reddit.com/user/${handle}`;
  }
}
