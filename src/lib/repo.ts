import "server-only";

import { getDb, type CoinRow, type CreatorRow, type PayoutRow } from "./db";
import type { EscrowKind, Platform, SocialProfile } from "./social/types";

export type { CoinRow, CreatorRow, PayoutRow };

export interface CoinWithCreator extends CoinRow {
  platform: Platform;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  escrow_kind: EscrowKind;
  escrow_pubkey: string;
  verified_at: number | null;
}

export interface CreatorWithCount extends CreatorRow {
  coin_count: number;
}

const COIN_JOIN = `
  SELECT c.*, cr.platform, cr.handle, cr.display_name, cr.avatar_url,
         cr.escrow_kind, cr.escrow_pubkey, cr.verified_at
  FROM coins c
  JOIN creators cr ON cr.id = c.creator_id
`;

/**
 * Inserts or refreshes a creator record.
 *
 * Profile fields are refreshed on every launch so avatars and follower counts
 * do not rot, but escrow columns are only written on insert: an escrow address
 * that changed under an already-launched coin would orphan its fees.
 */
export async function upsertCreator(
  profile: SocialProfile,
  escrowKind: EscrowKind,
  escrowPubkey: string,
): Promise<CreatorRow> {
  const db = await getDb();
  const handleLower = profile.handle.toLowerCase();

  await db.run(
    `INSERT INTO creators (
       platform, handle, handle_lower, platform_user_id, display_name,
       avatar_url, bio, followers, escrow_kind, escrow_pubkey, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (platform, handle_lower) DO UPDATE SET
       handle           = excluded.handle,
       platform_user_id = COALESCE(excluded.platform_user_id, creators.platform_user_id),
       display_name     = COALESCE(excluded.display_name, creators.display_name),
       avatar_url       = COALESCE(excluded.avatar_url, creators.avatar_url),
       bio              = COALESCE(excluded.bio, creators.bio),
       followers        = COALESCE(excluded.followers, creators.followers)`,
    [
      profile.platform,
      profile.handle,
      handleLower,
      profile.platformUserId,
      profile.displayName,
      profile.avatarUrl,
      profile.bio,
      profile.followers,
      escrowKind,
      escrowPubkey,
      Date.now(),
    ],
  );

  const row = await getCreator(profile.platform, profile.handle);
  if (!row) throw new Error("Failed to persist creator");
  return row;
}

export async function getCreator(
  platform: Platform,
  handle: string,
): Promise<CreatorRow | null> {
  const db = await getDb();
  return db.get<CreatorRow>(
    "SELECT * FROM creators WHERE platform = ? AND handle_lower = ?",
    [platform, handle.toLowerCase()],
  );
}

export async function getCreatorById(id: number): Promise<CreatorRow | null> {
  const db = await getDb();
  return db.get<CreatorRow>("SELECT * FROM creators WHERE id = ?", [id]);
}

export async function insertCoin(coin: Omit<CoinRow, "created_at">): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO coins (
       mint, creator_id, name, symbol, description, metadata_uri,
       image_url, launcher, signature, dev_buy_lamports, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (mint) DO NOTHING`,
    [
      coin.mint,
      coin.creator_id,
      coin.name,
      coin.symbol,
      coin.description,
      coin.metadata_uri,
      coin.image_url,
      coin.launcher,
      coin.signature,
      coin.dev_buy_lamports,
      Date.now(),
    ],
  );
}

export async function getCoin(mint: string): Promise<CoinWithCreator | null> {
  const db = await getDb();
  return db.get<CoinWithCreator>(`${COIN_JOIN} WHERE c.mint = ?`, [mint]);
}

export async function listCoins(limit = 50, offset = 0): Promise<CoinWithCreator[]> {
  const db = await getDb();
  return db.all<CoinWithCreator>(
    `${COIN_JOIN} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

export async function listCoinsByCreator(creatorId: number): Promise<CoinWithCreator[]> {
  const db = await getDb();
  return db.all<CoinWithCreator>(
    `${COIN_JOIN} WHERE c.creator_id = ? ORDER BY c.created_at DESC`,
    [creatorId],
  );
}

export async function countCoins(): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM coins");
  return Number(row?.n ?? 0);
}

export async function countCreators(): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM creators");
  return Number(row?.n ?? 0);
}

/** Creators that have at least one coin, for the leaderboard and directory. */
export async function listCreatorsWithCounts(limit = 100): Promise<CreatorWithCount[]> {
  const db = await getDb();
  return db.all<CreatorWithCount>(
    `SELECT cr.*, COUNT(c.mint) AS coin_count
       FROM creators cr
       JOIN coins c ON c.creator_id = cr.id
      GROUP BY cr.id
      ORDER BY coin_count DESC
      LIMIT ?`,
    [limit],
  );
}

export interface VerificationRow {
  creator_id: number;
  wallet: string;
  code: string;
  started_at: number;
}

/**
 * Issues a code for one creator *and* one destination wallet.
 *
 * Scoped to the pair rather than to the creator: the code is published on a
 * public profile, so binding it to the wallet that requested it is what stops
 * a bystander from reading it and claiming to an address of their own.
 */
export async function setVerificationCode(
  creatorId: number,
  wallet: string,
  code: string,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO verifications (creator_id, wallet, code, started_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (creator_id, wallet)
     DO UPDATE SET code = excluded.code, started_at = excluded.started_at`,
    [creatorId, wallet, code, Date.now()],
  );
}

export async function getVerification(
  creatorId: number,
  wallet: string,
): Promise<VerificationRow | null> {
  const db = await getDb();
  return db.get<VerificationRow>(
    "SELECT * FROM verifications WHERE creator_id = ? AND wallet = ?",
    [creatorId, wallet],
  );
}

/** Clears every pending code for a creator once one of them has succeeded. */
export async function clearVerifications(creatorId: number): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM verifications WHERE creator_id = ?", [creatorId]);
}

export async function markVerified(creatorId: number, payoutWallet: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE creators
        SET verified_at = ?, payout_wallet = ?, verification_code = NULL,
            verification_started_at = NULL
      WHERE id = ?`,
    [Date.now(), payoutWallet, creatorId],
  );
  await clearVerifications(creatorId);
}

export async function insertPayout(
  payout: Omit<PayoutRow, "id" | "created_at">,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO payouts (creator_id, amount_lamports, destination, signature, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (signature) DO NOTHING`,
    [
      payout.creator_id,
      payout.amount_lamports,
      payout.destination,
      payout.signature,
      Date.now(),
    ],
  );
}

export async function listPayouts(creatorId: number): Promise<PayoutRow[]> {
  const db = await getDb();
  return db.all<PayoutRow>(
    "SELECT * FROM payouts WHERE creator_id = ? ORDER BY created_at DESC",
    [creatorId],
  );
}
