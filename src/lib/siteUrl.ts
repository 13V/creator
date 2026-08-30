/**
 * Resolves the canonical origin used for absolute URLs (metadataBase, OG image
 * links). No `server-only` import, so this stays unit testable.
 *
 * Every candidate is treated as untrusted. Hosting dashboards store a variable
 * you left blank as an empty string rather than dropping it, and `new URL("")`
 * throws hard enough to fail the entire production build.
 */

const FALLBACK = "http://localhost:3000";

/** Vercel exposes bare hostnames (`my-app.vercel.app`); a URL needs a scheme. */
function parse(candidate: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

export function resolveSiteUrl(
  candidates: readonly (string | undefined)[] = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ],
): URL {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    const url = parse(trimmed);
    if (url) return url;
  }
  return new URL(FALLBACK);
}
