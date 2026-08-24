import { z } from "zod";

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

  /** Optional launchpad fee, collected as a SOL transfer inside the launch tx. */
  PLATFORM_FEE_WALLET: z.string().min(32).optional(),
  PLATFORM_FEE_LAMPORTS: z.coerce.number().int().min(0).default(0),

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

/** True when managed (custodial) escrows can be derived and swept. */
export function hasManagedEscrow(): boolean {
  return Boolean(env().ESCROW_MASTER_SEED);
}
