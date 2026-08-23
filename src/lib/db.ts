import "server-only";

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const path = resolve(process.cwd(), env().DATABASE_PATH);
  mkdirSync(dirname(path), { recursive: true });

  const handle = new DatabaseSync(path);
  handle.exec("PRAGMA journal_mode = WAL");
  handle.exec("PRAGMA foreign_keys = ON");
  handle.exec(`
    CREATE TABLE IF NOT EXISTS creators (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      platform                TEXT    NOT NULL,
      handle                  TEXT    NOT NULL,
      handle_lower            TEXT    NOT NULL,
      platform_user_id        TEXT,
      display_name            TEXT,
      avatar_url              TEXT,
      bio                     TEXT,
      followers               INTEGER,
      escrow_kind             TEXT    NOT NULL,
      escrow_pubkey           TEXT    NOT NULL,
      payout_wallet           TEXT,
      verified_at             INTEGER,
      verification_code       TEXT,
      verification_started_at INTEGER,
      created_at              INTEGER NOT NULL,
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
      dev_buy_lamports INTEGER NOT NULL DEFAULT 0,
      created_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id       INTEGER NOT NULL REFERENCES creators(id),
      amount_lamports  INTEGER NOT NULL,
      destination      TEXT    NOT NULL,
      signature        TEXT    NOT NULL,
      created_at       INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_coins_created  ON coins (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_creator  ON coins (creator_id);
    CREATE INDEX IF NOT EXISTS idx_payouts_creator ON payouts (creator_id);
  `);

  db = handle;
  return db;
}
