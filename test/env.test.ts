import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const MODULE = "../src/lib/env";

const REAL_ENV = { ...process.env };

/** `env()` parses lazily and memoises, so each case needs a fresh module. */
function loadEnv(vars: Record<string, string>): typeof import("../src/lib/env") {
  process.env = { ...REAL_ENV, ...vars };
  delete require.cache[require.resolve(MODULE)];
  return require(MODULE);
}

afterEach(() => {
  process.env = { ...REAL_ENV };
  delete require.cache[require.resolve(MODULE)];
});

test("blank strings are treated as unset, not as invalid values", () => {
  // Exactly what Vercel hands us for variables left empty in the dashboard.
  const mod = loadEnv({
    ESCROW_MASTER_SEED: "",
    X_BEARER_TOKEN: "",
    PLATFORM_FEE_WALLET: "",
    PUMP_LOOKUP_TABLE: "",
    DATABASE_URL: "",
    ADMIN_TOKEN: "",
    SOLANA_RPC_URL: "",
    SOLANA_CLUSTER: "",
    DATABASE_PATH: "",
    PLATFORM_FEE_LAMPORTS: "",
  });

  const parsed = mod.env();
  assert.equal(parsed.ESCROW_MASTER_SEED, undefined);
  assert.equal(parsed.X_BEARER_TOKEN, undefined);
  assert.equal(parsed.PLATFORM_FEE_WALLET, undefined);
  assert.equal(parsed.PUMP_LOOKUP_TABLE, undefined);
  assert.equal(parsed.DATABASE_URL, undefined);
  assert.equal(parsed.ADMIN_TOKEN, undefined);

  // Blanks must fall through to the defaults rather than defeating them.
  assert.equal(parsed.SOLANA_RPC_URL, "https://api.mainnet-beta.solana.com");
  assert.equal(parsed.SOLANA_CLUSTER, "mainnet-beta");
  assert.equal(parsed.DATABASE_PATH, "./data/launchpad.db");
  assert.equal(parsed.PLATFORM_FEE_LAMPORTS, 0);

  assert.equal(mod.hasXCredentials(), false);
  assert.equal(mod.hasManagedEscrow(), false);
});

test("configured values still come through", () => {
  const mod = loadEnv({
    DATABASE_URL: "postgres://user:pw@host:5432/db",
    X_BEARER_TOKEN: "token",
    ESCROW_MASTER_SEED: "a".repeat(64),
  });

  const parsed = mod.env();
  assert.equal(parsed.DATABASE_URL, "postgres://user:pw@host:5432/db");
  assert.equal(mod.hasXCredentials(), true);
  assert.equal(mod.hasManagedEscrow(), true);
});

test("a genuinely malformed value is still rejected", () => {
  const mod = loadEnv({ SOLANA_RPC_URL: "not-a-url" });
  assert.throws(() => mod.env(), /SOLANA_RPC_URL/);
});
