import "server-only";

import { PublicKey, type AddressLookupTableAccount } from "@solana/web3.js";

import { env } from "../env";
import { getConnection } from "./connection";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { at: number; tables: AddressLookupTableAccount[] } | null = null;

/**
 * Loads the address lookup table used to compress launch transactions.
 *
 * A create-plus-buy transaction references 26 accounts, which pushes it past
 * Solana's 1232-byte packet limit — every launch with an opening buy fails
 * without this. A lookup table replaces each shared account reference with a
 * single byte index, which buys back several hundred bytes.
 *
 * Deliberately soft: a missing or unreadable table degrades to compiling
 * without it, and the size check in `prepareLaunch` is what actually blocks a
 * transaction that will not fit.
 */
export async function getLookupTables(): Promise<AddressLookupTableAccount[]> {
  const configured = env().PUMP_LOOKUP_TABLE;
  if (!configured) return [];

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.tables;

  try {
    const result = await getConnection().getAddressLookupTable(new PublicKey(configured));
    const table = result.value;
    const tables = table ? [table] : [];
    cache = { at: Date.now(), tables };
    return tables;
  } catch {
    return [];
  }
}
