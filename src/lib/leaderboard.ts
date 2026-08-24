import "server-only";

import { PublicKey } from "@solana/web3.js";

import { getFeeTotals } from "./pump/feesBatch";
import { getMarketData, type MarketData } from "./pump/market";
import { listCoins, listCreatorsWithCounts, type CoinWithCreator, type CreatorWithCount } from "./repo";

export interface LeaderboardEntry {
  creator: CreatorWithCount;
  feeLamports: number;
}

/**
 * Creators ranked by fees waiting to be claimed.
 *
 * This is the loop that makes the product work: a creator who has never heard
 * of the launchpad finds out there is money sitting on-chain with their name
 * on it. Totals come from chain, so they are right even for coins launched
 * before this app indexed anything.
 */
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const creators = await listCreatorsWithCounts(200);
  if (creators.length === 0) return [];

  const totals = await getFeeTotals(
    creators.map((creator) => new PublicKey(creator.escrow_pubkey)),
  ).catch(() => new Map<string, number>());

  return creators
    .map((creator) => ({
      creator,
      feeLamports: totals.get(creator.escrow_pubkey) ?? 0,
    }))
    .sort((a, b) => b.feeLamports - a.feeLamports)
    .slice(0, limit);
}

export interface CoinWithFees extends CoinWithCreator {
  feeLamports: number;
}

/** Coin list decorated with each creator's live escrow balance. */
export async function listCoinsWithFees(limit = 100): Promise<CoinWithFees[]> {
  const coins = await listCoins(limit);
  if (coins.length === 0) return [];

  const unique = [...new Set(coins.map((coin) => coin.escrow_pubkey))];
  const totals = await getFeeTotals(unique.map((key) => new PublicKey(key))).catch(
    () => new Map<string, number>(),
  );

  return coins.map((coin) => ({
    ...coin,
    feeLamports: totals.get(coin.escrow_pubkey) ?? 0,
  }));
}

export interface BoardCoin extends CoinWithFees {
  marketCapLamports: number | null;
  liquidityLamports: number;
  progress: number;
  graduated: boolean;
}

/**
 * The launchpad board: every coin with its live market cap, curve progress and
 * the fees waiting for its creator.
 *
 * Fees and market data are fetched concurrently and each degrades to empty on
 * failure, so a flaky RPC costs a column rather than the whole page.
 */
export async function listBoard(limit = 100): Promise<BoardCoin[]> {
  const coins = await listCoinsWithFees(limit);
  if (coins.length === 0) return [];

  const market = await getMarketData(coins.map((coin) => coin.mint)).catch(
    () => new Map<string, MarketData>(),
  );

  return coins.map((coin) => {
    const data = market.get(coin.mint);
    return {
      ...coin,
      marketCapLamports: data?.marketCapLamports ?? null,
      liquidityLamports: data?.liquidityLamports ?? 0,
      progress: data?.progress ?? 0,
      graduated: data?.graduated ?? false,
    };
  });
}
