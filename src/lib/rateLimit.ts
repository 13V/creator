import "server-only";

import { getDb } from "./db";
import { env } from "./env";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED = 10_000;

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter keyed by client IP.
 *
 * `launch/prepare` pins an image to IPFS and makes several RPC calls on every
 * request, so an unthrottled endpoint is both an abuse vector and a bill.
 *
 * The counter lives in the database whenever one is configured. A per-process
 * Map — which is what this was — bounds a single instance and nothing else, and
 * a serverless host answers a burst by starting more instances, so the limit
 * silently multiplies by the concurrency at exactly the moment it matters. The
 * in-memory path stays for local development against SQLite, and as the
 * fallback when a database round trip fails; see `checkRateLimit`.
 */
export async function checkRateLimit(
  key: string,
  limit: RateLimit,
): Promise<RateLimitResult> {
  if (!env().DATABASE_URL) return checkInMemory(key, limit);

  try {
    return await checkShared(key, limit);
  } catch {
    /*
     * Fall back rather than fail open or closed.
     *
     * Failing closed turns a database blip into a total outage of every
     * rate-limited route, which is most of the API. Failing open removes the
     * limiter for the duration. The per-process counter is weaker than the
     * shared one but strictly better than neither, and it needs nothing that
     * is currently broken.
     */
    return checkInMemory(key, limit);
  }
}

/**
 * One statement, so the read and the increment cannot interleave.
 *
 * Doing this as SELECT-then-UPDATE would let two concurrent requests both read
 * the same count and both write count + 1, which is how a limiter of 10 lets
 * through 19. The upsert resets the window in the same breath when the stored
 * one has expired, so no separate cleanup is needed to make the limit correct
 * — only to keep the table small.
 */
async function checkShared(
  key: string,
  { limit, windowMs }: RateLimit,
): Promise<RateLimitResult> {
  const db = await getDb();
  const now = Date.now();
  const resetAt = now + windowMs;

  const row = await db.get<{ count: number; reset_at: number }>(
    `INSERT INTO rate_limits (bucket_key, count, reset_at)
     VALUES (?, 1, ?)
     ON CONFLICT (bucket_key) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
    [key, resetAt, now, now, resetAt],
  );

  if (!row) throw new Error("rate limit upsert returned no row");

  void sweep(db, now);

  if (row.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((Number(row.reset_at) - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Expired rows are harmless but unbounded — every distinct IP that ever hit a
 * route leaves one behind. Swept on a small fraction of requests rather than on
 * a schedule, which keeps the cost proportional to traffic and needs no cron.
 * Deliberately not awaited: a slow delete must never delay the request that
 * happened to trigger it.
 */
const SWEEP_ODDS = 0.01;

async function sweep(
  db: Awaited<ReturnType<typeof getDb>>,
  now: number,
): Promise<void> {
  if (Math.random() >= SWEEP_ODDS) return;
  try {
    await db.run("DELETE FROM rate_limits WHERE reset_at <= ?", [now]);
  } catch {
    // A failed sweep costs disk, not correctness.
  }
}

function checkInMemory(
  key: string,
  { limit, windowMs }: RateLimit,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_TRACKED) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  // Still full of live buckets: drop the oldest so memory stays bounded.
  if (buckets.size >= MAX_TRACKED) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
}

/** Best-effort client identity, trusting the proxy headers a host sets. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
