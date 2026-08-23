import { z } from "zod";

/**
 * Server-side configuration. Parsed lazily so that a missing optional secret
 * only breaks the feature that needs it, never the whole app.
 */
const serverSchema = z.object({
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

  DATABASE_PATH: z.string().default("./data/launchpad.db"),

  /** Guards the payout endpoint for managed escrows. */
  ADMIN_TOKEN: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

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
