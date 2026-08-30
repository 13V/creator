import { z } from "zod";

import type { Platform } from "./social/types";

/**
 * Hosting dashboards store a variable you left blank as an empty string rather
 * than dropping it, and both `.optional()` and `.default()` only fire on
 * `undefined`. Without this, a blank field in the Vercel UI is a hard
 * validation error instead of "not configured".
 */
function dropBlanks(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string" && val.trim() === "") continue;
    out[key] = val;
  }
  return out;
}

/**
 * Server-side configuration. Parsed lazily so that a missing optional secret
 * only breaks the feature that needs it, never the whole app.
 */
const serverShape = z.object({
  SOLANA_RPC_URL: z
    .string()
    .url()
    .default("https://api.mainnet-beta.solana.com"),
  SOLANA_CLUSTER: z.enum(["mainnet-beta", "devnet"]).default("mainnet-beta"),

  /**
   * 32+ bytes of entropy (hex or base64) used to derive managed escrow keys for
   * platforms pump.fun has no native social vault for (Instagram, TikTok).
   * Losing this seed means losing custody of every unclaimed managed escrow.
   */
  ESCROW_MASTER_SEED: z.string().min(32).optional(),

  /** Enables authoritative X handle -> numeric id lookups. */
  X_BEARER_TOKEN: z.string().min(1).optional(),

  /**
   * Reddit application-only OAuth. Without these a Reddit handle still
   * resolves well enough to launch a coin for, but no Reddit creator can ever
   * verify — every unauthenticated read of a Reddit profile returns 403,
   * whatever user agent it carries, so there is nothing to check a code
   * against. Create an app at https://www.reddit.com/prefs/apps ("script").
   */
  REDDIT_CLIENT_ID: z.string().min(1).optional(),
  REDDIT_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * OAuth sign-in credentials, one app per platform.
   *
   * A creator proves a handle is theirs by signing in, so these are what make
   * claiming possible at all. A platform without credentials simply is not
   * offered on the claim page — better than offering a button that cannot
   * finish. Reddit reuses the pair above.
   */
  X_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  X_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  INSTAGRAM_CLIENT_ID: z.string().min(1).optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().min(1).optional(),
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * Where the platform's share of creator fees is paid. Also the destination
   * for the optional flat launch fee below.
   */
  PLATFORM_FEE_WALLET: z.string().min(32).optional(),
  PLATFORM_FEE_LAMPORTS: z.coerce.number().int().min(0).default(0),

  /**
   * The platform's cut of a coin's creator fees, in basis points. 1000 = 10%,
   * leaving 90% to the creator. Enforced on-chain by a pump.fun fee-sharing
   * config, so neither side has to trust the other to forward anything.
   *
   * Capped below 10,000: a split that left the creator nothing would defeat
   * the point of the product.
   */
  PLATFORM_FEE_SHARE_BPS: z.coerce.number().int().min(0).max(9_000).default(1_000),

  /**
   * SOL the launch transaction sends to the creator's escrow so it can pay
   * rent for its fee-sharing config. The escrow has earned nothing at that
   * point, and the config is created in its name.
   *
   * Zero — the default — reads the real rent from the chain instead, which is
   * what this should do: an earlier hardcoded 5,000,000 was under the true
   * 8,017,920 and failed every launch with "insufficient lamports". Set a
   * value only to override that.
   *
   * Overshooting is not free either. The escrow's balance counts as unclaimed
   * creator fees throughout the UI, so surplus float shows up on the board as
   * money the creator has not earned.
   */
  FEE_SHARE_RENT_LAMPORTS: z.coerce.number().int().min(0).default(0),

  /**
   * Address lookup table used to keep launch transactions under Solana's
   * 1232-byte limit. Required for launches that include an opening buy.
   * Create one with `npm run setup:lookup-table`.
   */
  PUMP_LOOKUP_TABLE: z.string().min(32).max(44).optional(),

  /**
   * Postgres connection string. Required on any serverless host: their
   * filesystems are read-only outside /tmp, so the SQLite fallback cannot
   * persist there. Unset locally, SQLite is used instead.
   */
  DATABASE_URL: z.string().min(1).optional(),

  /** Local SQLite file, used only when DATABASE_URL is unset. */
  DATABASE_PATH: z.string().default("./data/launchpad.db"),

  /** Guards the payout endpoint for managed escrows. */
  ADMIN_TOKEN: z.string().min(16).optional(),

  /**
   * The bearer Vercel sends on scheduled runs, as
   * `Authorization: Bearer $CRON_SECRET`. Declared here because it was already
   * load-bearing while being invisible: the hourly payout crank only
   * authorised because this variable happened to hold the same string as
   * ADMIN_TOKEN, so rotating one would have stopped every creator payout with
   * no error anywhere except a 401 in a dashboard nobody reads. The cron route
   * now accepts either, and this makes the coupling something you can see.
   *
   * No minimum length, unlike ADMIN_TOKEN. `env()` is called on essentially
   * every request, so a failed constraint here would not disable the cron —
   * it would throw on every route and take the whole site down. That is a
   * catastrophic failure mode for a variable whose only job is guarding one
   * endpoint, and the length check buys nothing: `bearerMatches` compares in
   * constant time whatever it is given.
   */
  CRON_SECRET: z.string().min(1).optional(),
});

const serverSchema = z.preprocess(dropBlanks, serverShape);

export type ServerEnv = z.infer<typeof serverShape>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** True when we can mint authoritative X user ids (required for native escrow). */
export function hasXCredentials(): boolean {
  return Boolean(env().X_BEARER_TOKEN);
}

/**
 * Whether this deployment can confirm a profile with the platform itself.
 *
 * This is what the one-time-code claim flow rests on: the code goes in a
 * public bio, and proving the creator put it there means reading that bio
 * authoritatively. A mirror will not do — see `withMirror`, which leaves
 * `verifiedUpstream` false for exactly this reason.
 *
 * X and Reddit both refuse anonymous reads, so without their credentials the
 * code flow cannot ever succeed here — not "not right now", ever. Instagram
 * and TikTok read endpoints that need no credential, so for them a failure
 * really is transient and worth retrying.
 */
export function hasUpstreamCredentials(platform: Platform): boolean {
  const e = env();
  switch (platform) {
    case "x":
      return Boolean(e.X_BEARER_TOKEN);
    case "reddit":
      return Boolean(e.REDDIT_CLIENT_ID && e.REDDIT_CLIENT_SECRET);
    case "instagram":
    case "tiktok":
      return true;
  }
}

/** True when managed (custodial) escrows can be derived and swept. */
export function hasManagedEscrow(): boolean {
  return Boolean(env().ESCROW_MASTER_SEED);
}
