import "server-only";

import { PublicKey, type AccountInfo } from "@solana/web3.js";
import {
  PUMP_SDK,
  bondingCurveMarketCap,
  bondingCurvePda,
  bondingCurveV2Pda,
  type Global,
} from "@pump-fun/pump-sdk";

import { getConnection, getOnlineSdk } from "./connection";

const CHUNK = 100;

export interface MarketData {
  /**
   * Market cap in lamports of the quote asset (SOL), or null when the curve
   * cannot price it — a graduated coin has drained its virtual reserves and
   * trades on the AMM instead.
   */
  marketCapLamports: number | null;
  /** How far along the bonding curve is, 0–1. */
  progress: number;
  /** True once the curve has filled and liquidity has migrated. */
  graduated: boolean;
}

/**
 * Reads market cap and bonding-curve progress for many coins at once.
 *
 * These are the two numbers a launchpad lives on, and both come straight off
 * the curve account, so a whole board costs one batched call rather than a
 * request per coin. Coins launched before and after `create_v2` live at
 * different PDAs, so both are probed.
 */
export async function getMarketData(
  mints: string[],
): Promise<Map<string, MarketData>> {
  const out = new Map<string, MarketData>();
  if (mints.length === 0) return out;

  const keys: PublicKey[] = [];
  for (const mint of mints) {
    const key = new PublicKey(mint);
    keys.push(bondingCurvePda(key), bondingCurveV2Pda(key));
  }

  const connection = getConnection();
  const infos: (AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += CHUNK) {
    infos.push(...(await connection.getMultipleAccountsInfo(keys.slice(i, i + CHUNK))));
  }

  let global: Global;
  try {
    global = await getOnlineSdk().fetchGlobal();
  } catch {
    return out;
  }
  const initialReserves = global.initialRealTokenReserves.toNumber();

  for (let i = 0; i < mints.length; i += 1) {
    const candidates = [infos[i * 2], infos[i * 2 + 1]];

    for (const info of candidates) {
      if (!info) continue;
      const curve = PUMP_SDK.decodeBondingCurveNullable(info);
      if (!curve) continue;

      // Pricing a completed curve divides by zero reserves and throws, which
      // would take the whole board's market data down with it.
      let marketCapLamports: number | null = null;
      if (!curve.complete && !curve.virtualTokenReserves.isZero()) {
        try {
          marketCapLamports = bondingCurveMarketCap({
            mintSupply: curve.tokenTotalSupply,
            virtualQuoteReserves: curve.virtualQuoteReserves,
            virtualTokenReserves: curve.virtualTokenReserves,
          }).toNumber();
        } catch {
          marketCapLamports = null;
        }
      }

      // Progress is how much of the sellable supply has left the curve.
      const sold = initialReserves - curve.realTokenReserves.toNumber();
      const progress = curve.complete
        ? 1
        : Math.min(1, Math.max(0, initialReserves > 0 ? sold / initialReserves : 0));

      out.set(mints[i], { marketCapLamports, progress, graduated: curve.complete });
      break;
    }
  }

  return out;
}
