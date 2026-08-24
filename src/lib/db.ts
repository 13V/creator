import "server-only";

import { env } from "./env";
import type { EscrowKind, Platform } from "./social/types";

export interface CreatorRow {
  id: number;
  platform: Platform;
  handle: string;
  handle_lower: string;
  platform_user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers: number | null;
  escrow_kind: EscrowKind;
  escrow_pubkey: string;
  payout_wallet: string | null;
  verified_at: number | null;
  verification_code: string | null;
  verification_started_at: number | null;
  created_at: number;
}

export interface CoinRow {
  mint: string;
  creator_id: number;
  name: string;
  symbol: string;
  description: string | null;
  metadata_uri: string;
  image_url: string | null;
  launcher: string;
  signature: string;
  dev_buy_lamports: number;
  created_at: number;
}

export interface PayoutRow {
  id: number;
  creator_id: number;
  amount_lamports: number;
  destination: string;
  signature: string;
  created_at: number;
}

export type Dialect = "sqlite" | "postgres";

export interface Db {
  dialect: Dialect;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<void>;
}

/**
 * Statements are written once with `?` placeholders and translated per driver,
 * so the repository never has to know which database it is talking to.
 */
function toPositional(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/** Column type for the surrogate keys, which is the only real schema divergence. */
function schema(dialect: Dialect): string {
  const id =
    dialect === "postgres"
      ? "id SERIAL PRIMARY KEY"
      : "id INTEGER PRIMARY KEY AUTOINCREMENT";

  return `
    CREATE TABLE IF NOT EXISTS creators (
      ${id},
      platform                TEXT    NOT NULL,
      handle                  TEXT    NOT NULL,
      handle_lower            TEXT    NOT NULL,
      platform_user_id        TEXT,
      display_name            TEXT,
      avatar_url              TEXT,
      bio                     TEXT,
      followers               BIGINT,
      escrow_kind             TEXT    NOT NULL,
      escrow_pubkey           TEXT    NOT NULL,
      payout_wallet           TEXT,
      verified_at             BIGINT,
      verification_code       TEXT,
      verification_started_at BIGINT,
      created_at              BIGINT  NOT NULL,
      UNIQUE (platform, handle_lower)
    );

    CREATE TABLE IF NOT EXISTS coins (
      mint             TEXT    PRIMARY KEY,
      creator_id       INTEGER NOT NULL REFERENCES creators(id),
      name             TEXT    NOT NULL,
      symbol           TEXT    NOT NULL,
      description      TEXT,
      metadata_uri     TEXT    NOT NULL,
      image_url        TEXT,
      launcher         TEXT    NOT NULL,
      signature        TEXT    NOT NULL,
      dev_buy_lamports BIGINT  NOT NULL DEFAULT 0,
      created_at       BIGINT  NOT NULL
    );

    /*
     * One pending verification per creator *and destination wallet*.
     *
     * The code has to be public — the creator posts it on their profile — so
     * it cannot be the only thing a claim requires. Binding it to the wallet
     * that asked for it means seeing the code on a profile buys an attacker
     * nothing: their own code is the only one that would release funds to
     * them, and it is not the one the creator posted.
     *
     * Keyed per wallet rather than per creator so a stranger starting a claim
     * cannot overwrite the code a creator is midway through posting.
     */
    CREATE TABLE IF NOT EXISTS verifications (
      ${dialect === "postgres" ? "id SERIAL PRIMARY KEY" : "id INTEGER PRIMARY KEY AUTOINCREMENT"},
      creator_id  INTEGER NOT NULL REFERENCES creators(id),
      wallet      TEXT    NOT NULL,
      code        TEXT    NOT NULL,
      started_at  BIGINT  NOT NULL,
      -- Set when the creator proved the handle by signing in, which is the
      -- strong path. The code column is only consulted where sign-in is
      -- unavailable for that platform.
      proved_at   BIGINT,
      platform_user_id TEXT,
      UNIQUE (creator_id, wallet)
    );

    CREATE TABLE IF NOT EXISTS payouts (
      ${dialect === "postgres" ? "id SERIAL PRIMARY KEY" : "id INTEGER PRIMARY KEY AUTOINCREMENT"},
      creator_id       INTEGER NOT NULL REFERENCES creators(id),
      amount_lamports  BIGINT  NOT NULL,
      destination      TEXT    NOT NULL,
      signature        TEXT    NOT NULL,
      created_at       BIGINT  NOT NULL
    );

    /*
     * One row per payout transaction. Verifying that a signature really paid
     * the creator stops a forged record, but says nothing about a real one
     * being posted a hundred times to inflate the history the creator page
     * shows. An index rather than a table constraint so it also applies to a
     * database created before this existed.
     */
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_signature ON payouts (signature);

    CREATE INDEX IF NOT EXISTS idx_coins_created   ON coins (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_creator   ON coins (creator_id);
    CREATE INDEX IF NOT EXISTS idx_payouts_creator ON payouts (creator_id);
  `;
}

async function createPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    // Hosted Postgres almost always terminates TLS with its own certificate.
    ssl: url.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
    max: 3,
  });

  // BIGINT arrives as a string by default, which would break every arithmetic
  // comparison downstream. These columns hold millisecond timestamps and
  // lamports, both well inside Number's safe range.
  const { types } = await import("pg");
  types.setTypeParser(20, (value: string) => Number(value));

  await pool.query(schema("postgres"));

  return {
    dialect: "postgres",
    async all<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(toPositional(sql), params);
      return result.rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(toPositional(sql), params);
      return (result.rows[0] as T) ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      await pool.query(toPositional(sql), params);
    },
  };
}

async function createSqlite(path: string): Promise<Db> {
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdirSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");

  const file = resolve(process.cwd(), path);
  let handle;
  try {
    mkdirSync(dirname(file), { recursive: true });
    handle = new DatabaseSync(file);
  } catch (error) {
    // The overwhelmingly likely cause is a serverless host, where everything
    // outside /tmp is read-only. Say what to set rather than surfacing EROFS.
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new Error(
        `Cannot open the SQLite database at ${file} (${code}). This host has a ` +
          "read-only filesystem, so set DATABASE_URL to a Postgres connection " +
          "string instead — see the README.",
      );
    }
    throw error;
  }
  handle.exec("PRAGMA journal_mode = WAL");
  handle.exec("PRAGMA foreign_keys = ON");
  handle.exec(schema("sqlite"));

  // node:sqlite only binds primitives, so undefined and booleans are coerced.
  const bind = (params: unknown[]) =>
    params.map((value) => {
      if (value === undefined) return null;
      if (typeof value === "boolean") return value ? 1 : 0;
      return value as null | number | bigint | string | Uint8Array;
    });

  return {
    dialect: "sqlite",
    async all<T>(sql: string, params: unknown[] = []) {
      return handle.prepare(sql).all(...bind(params)) as unknown as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return (handle.prepare(sql).get(...bind(params)) as T) ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      handle.prepare(sql).run(...bind(params));
    },
  };
}

let connection: Promise<Db> | null = null;

/**
 * Opens the database, preferring Postgres when `DATABASE_URL` is set.
 *
 * Serverless hosts give each invocation a read-only filesystem outside /tmp,
 * and anything written to /tmp vanishes when the function ends — so a SQLite
 * file cannot be the store in production. SQLite stays the zero-setup default
 * for local development.
 */
export function getDb(): Promise<Db> {
  if (!connection) {
    const url = env().DATABASE_URL;
    connection = url ? createPostgres(url) : createSqlite(env().DATABASE_PATH);
    // A failed connection must not be cached, or every later request reuses it.
    connection.catch(() => {
      connection = null;
    });
  }
  return connection;
}
