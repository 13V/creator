import "server-only";

import { PublicKey } from "@solana/web3.js";
import {
  PUMP_SDK,
  bondingCurvePda,
  bondingCurveV2Pda,
  type BondingCurve,
} from "@pump-fun/pump-sdk";

import { getConnection } from "./connection";

/**
 * Reads a coin's bonding curve, trying both the legacy and v2 PDAs.
 *
 * Which one a coin uses depends on whether `create_v2` was enabled when it
 * launched, and we index coins launched under both.
 */
export async function fetchBondingCurve(
  mint: PublicKey,
): Promise<BondingCurve | null> {
  const connection = getConnection();
  const candidates = [bondingCurvePda(mint), bondingCurveV2Pda(mint)];
  const infos = await connection.getMultipleAccountsInfo(candidates);

  for (const info of infos) {
    if (!info) continue;
    const curve = PUMP_SDK.decodeBondingCurveNullable(info);
    if (curve) return curve;
  }
  return null;
}

export function pumpFunUrl(mint: string): string {
  return `https://pump.fun/coin/${mint}`;
}

export function solscanUrl(kind: "tx" | "account", value: string): string {
  return `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${value}`;
}
