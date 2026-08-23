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
export function upsertCreator(
  profile: SocialProfile,
  escrowKind: EscrowKind,
  escrowPubkey: string,
): CreatorRow {
  const db = getDb();
  const handleLower = profile.handle.toLowerCase();

  db.prepare(
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
  ).run(
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
  );

  const row = getCreator(profile.platform, profile.handle);
  if (!row) throw new Error("Failed to persist creator");
  return row;
}

export function getCreator(platform: Platform, handle: string): CreatorRow | null {
  return (getDb()
    .prepare("SELECT * FROM creators WHERE platform = ? AND handle_lower = ?")
    .get(platform, handle.toLowerCase()) ?? null) as CreatorRow | null;
}

export function getCreatorById(id: number): CreatorRow | null {
  return (getDb()
    .prepare("SELECT * FROM creators WHERE id = ?")
    .get(id) ?? null) as CreatorRow | null;
}

export function insertCoin(coin: Omit<CoinRow, "created_at">): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO coins (
         mint, creator_id, name, symbol, description, metadata_uri,
         image_url, launcher, signature, dev_buy_lamports, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
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
    );
}

export function getCoin(mint: string): CoinWithCreator | null {
  return (getDb()
    .prepare(`${COIN_JOIN} WHERE c.mint = ?`)
    .get(mint) ?? null) as CoinWithCreator | null;
}

export function listCoins(limit = 50, offset = 0): CoinWithCreator[] {
  return getDb()
    .prepare(`${COIN_JOIN} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`)
    .all(limit, offset) as unknown as CoinWithCreator[];
}

export function listCoinsByCreator(creatorId: number): CoinWithCreator[] {
  return getDb()
    .prepare(`${COIN_JOIN} WHERE c.creator_id = ? ORDER BY c.created_at DESC`)
    .all(creatorId) as unknown as CoinWithCreator[];
}

export function countCoins(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM coins").get() as { n: number };
  return row.n;
}

export function countCreators(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM creators").get() as { n: number };
  return row.n;
}

export function setVerificationCode(creatorId: number, code: string): void {
  getDb()
    .prepare(
      "UPDATE creators SET verification_code = ?, verification_started_at = ? WHERE id = ?",
    )
    .run(code, Date.now(), creatorId);
}

export function markVerified(creatorId: number, payoutWallet: string): void {
  getDb()
    .prepare(
      `UPDATE creators
         SET verified_at = ?, payout_wallet = ?, verification_code = NULL,
             verification_started_at = NULL
       WHERE id = ?`,
    )
    .run(Date.now(), payoutWallet, creatorId);
}

export function insertPayout(payout: Omit<PayoutRow, "id" | "created_at">): void {
  getDb()
    .prepare(
      `INSERT INTO payouts (creator_id, amount_lamports, destination, signature, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      payout.creator_id,
      payout.amount_lamports,
      payout.destination,
      payout.signature,
      Date.now(),
    );
}

export function listPayouts(creatorId: number): PayoutRow[] {
  return getDb()
    .prepare("SELECT * FROM payouts WHERE creator_id = ? ORDER BY created_at DESC")
    .all(creatorId) as unknown as PayoutRow[];
}
