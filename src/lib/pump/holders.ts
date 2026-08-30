import "server-only";

import { PublicKey } from "@solana/web3.js";

import { getConnection } from "./connection";

export interface Holder {
  /** Wallet that owns the token account, when it could be resolved. */
  owner: string | null;
  /** Base units held. */
  amount: number;
  /** Share of the coin's circulating supply, 0–1. */
  share: number;
}

/** SPL token account layout: owner at 32, amount at 64. */
const OWNER_OFFSET = 32;
const AMOUNT_OFFSET = 64;

/**
 * Top holders of a coin.
 *
 * `getTokenLargestAccounts` returns token accounts rather than wallets, so the
 * owners are read in one follow-up batch. Shares are taken against the summed
 * supply reported by the RPC rather than the mint's nominal total, so a coin
 * mid-curve does not look like it is 99% unheld.
 */
export async function getTopHolders(mint: string, limit = 10): Promise<Holder[]> {
  const connection = getConnection();

  const largest = await connection.getTokenLargestAccounts(new PublicKey(mint));
  const accounts = largest.value.slice(0, limit);
  if (accounts.length === 0) return [];

  const supply = await connection.getTokenSupply(new PublicKey(mint));
  const total = Number(supply.value.amount) || 0;

  const infos = await connection.getMultipleAccountsInfo(
    accounts.map((account) => account.address),
  );

  return accounts.map((account, index) => {
    const data = infos[index]?.data;
    const owner =
      data && data.length >= AMOUNT_OFFSET
        ? new PublicKey(data.subarray(OWNER_OFFSET, OWNER_OFFSET + 32)).toBase58()
        : null;
    const amount = Number(account.amount);
    return { owner, amount, share: total > 0 ? amount / total : 0 };
  });
}
