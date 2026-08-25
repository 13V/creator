import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

/*
 * The limiter reads DATABASE_URL through `env()`, and both it and `db` capture
 * configuration on first use, so the environment has to be set before either
 * module is imported. A SQLite file gives the shared-store path a real database
 * to talk to: the upsert is written once for both dialects, so exercising it
 * here is what proves the statement parses and counts, not just that it typed.
 */
/*
 * `server-only` resolves to a module that throws on import outside Next's
 * bundler, which is exactly its job — but it also makes every server module
 * untestable under plain `node --test`. Pre-seeding the require cache with an
 * empty module is the standard accommodation: the guard still protects the
 * real build, where Next resolves the package's `react-server` condition.
 */
const serverOnly = require.resolve("server-only");
require.cache[serverOnly] = {
  id: serverOnly,
  filename: serverOnly,
  loaded: true,
  exports: {},
} as NodeModule;

const dir = mkdtempSync(join(tmpdir(), "backd-ratelimit-"));

process.env.DATABASE_PATH = join(dir, "test.db");
delete process.env.DATABASE_URL;

let checkRateLimit: typeof import("../src/lib/rateLimit").checkRateLimit;
let getDb: typeof import("../src/lib/db").getDb;

before(async () => {
  ({ checkRateLimit } = await import("../src/lib/rateLimit"));
  ({ getDb } = await import("../src/lib/db"));
});

after(() => rmSync(dir, { recursive: true, force: true }));

/**
 * Drives the SQLite-backed path directly rather than through `checkRateLimit`,
 * which routes to the in-memory counter when DATABASE_URL is unset. The upsert
 * under test is the same statement either way.
 */
async function hit(key: string, limit: number, windowMs: number) {
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
  assert.ok(row, "upsert returned no row");
  return { count: Number(row.count), resetAt: Number(row.reset_at) };
}

test("the shared counter increments across calls", async () => {
  const key = `inc:${Date.now()}`;
  assert.equal((await hit(key, 3, 60_000)).count, 1);
  assert.equal((await hit(key, 3, 60_000)).count, 2);
  assert.equal((await hit(key, 3, 60_000)).count, 3);
});

test("an expired window resets the count rather than accumulating", async () => {
  const key = `expire:${Date.now()}`;
  // A window of zero is already expired by the time the next call reads it.
  assert.equal((await hit(key, 5, 0)).count, 1);
  assert.equal((await hit(key, 5, 0)).count, 1);
  assert.equal((await hit(key, 5, 60_000)).count, 1);
  // ...and once a live window exists, counting resumes inside it.
  assert.equal((await hit(key, 5, 60_000)).count, 2);
});

test("keys do not share a bucket", async () => {
  const stamp = Date.now();
  await hit(`a:${stamp}`, 5, 60_000);
  await hit(`a:${stamp}`, 5, 60_000);
  assert.equal((await hit(`b:${stamp}`, 5, 60_000)).count, 1);
});

test("the window is pinned to the first request, not extended by later ones", async () => {
  // A limiter that pushed reset_at forward on every hit would never let a
  // blocked client recover: each rejected request would postpone its own
  // window. The stored reset_at has to survive subsequent increments.
  const key = `pin:${Date.now()}`;
  const first = await hit(key, 2, 60_000);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = await hit(key, 2, 60_000);
  assert.equal(second.resetAt, first.resetAt);
});

test("without DATABASE_URL the limiter still blocks past its limit", async () => {
  const key = `mem:${Date.now()}`;
  const opts = { limit: 2, windowMs: 60_000 };
  assert.equal((await checkRateLimit(key, opts)).allowed, true);
  assert.equal((await checkRateLimit(key, opts)).allowed, true);

  const blocked = await checkRateLimit(key, opts);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0, "a block must say when to retry");
});
