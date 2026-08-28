const DEFAULT_TIMEOUT_MS = 8_000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: { "user-agent": BROWSER_UA, ...(rest.headers ?? {}) },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Why a lookup came back empty.
 *
 * `fetchJson` returns null for a dead network, a 401, a 429 and a malformed
 * body alike, which is the right shape for callers — they all degrade the same
 * way — but it makes an upstream that has quietly stopped working impossible
 * to tell apart from one that is merely slow. Every profile on the board was
 * arriving unverified with no way to see whether the token was rejected or the
 * plan did not cover the endpoint.
 *
 * So callers may pass a sink. Nothing is logged by default and the return
 * value is unchanged; the admin diagnostic is the only thing that reads it.
 */
export interface FetchFailure {
  status: number | null;
  detail: string;
}

/** Fetches JSON, returning null on any transport, status, or parse failure. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; onFailure?: (f: FetchFailure) => void } = {},
): Promise<T | null> {
  const { onFailure, ...rest } = init;
  try {
    const res = await fetchWithTimeout(url, rest);
    if (!res.ok) {
      // Bounded: an upstream error page can be a whole HTML document, and this
      // is only ever read by a human looking at a diagnostic.
      const body = await res.text().catch(() => "");
      onFailure?.({ status: res.status, detail: body.slice(0, 400) });
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    onFailure?.({ status: null, detail: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** A best-effort avatar that works without any API credentials. */
export function unavatarUrl(provider: string, handle: string): string {
  return `https://unavatar.io/${provider}/${encodeURIComponent(handle)}`;
}
