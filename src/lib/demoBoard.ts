import "server-only";

import type { BoardCoin } from "./leaderboard";

/**
 * A board full of coins that do not exist, for looking at the layout.
 *
 * This is a design tool, not a fixture: with an empty board the grid, the
 * sort tabs, the ticker and the entrance stagger all render into nothing, so
 * there is no way to judge them without data. It fills that gap without
 * writing anything to the database, so turning it off is deleting one
 * environment variable rather than cleaning up rows.
 *
 * It is deliberately loud about itself. This is a mainnet app that moves real
 * money, and a board of invented coins that looked real would be the single
 * worst thing to ship by accident — so the flag is off unless explicitly set,
 * the mints are visibly not base58 addresses, and the page renders a banner
 * whenever it is on. See `DemoBanner` in the board page.
 */
export function demoBoardEnabled(): boolean {
  return process.env.DEMO_BOARD === "1";
}

interface Seed {
  name: string;
  symbol: string;
  /*
   * Written out rather than derived from the symbol, because the card artwork
   * is seeded from the mint: `demo-<symbol>-not-a-real-mint` collapsed ten
   * coins onto five of the eight palettes and put the same gradient on two
   * cards side by side. These were picked so no two neighbours match.
   *
   * Not base58 either, so nothing can mistake one for a real mint or go
   * looking for it on chain.
   */
  mint: string;
  platform: BoardCoin["platform"];
  handle: string;
  display: string;
  fee: number;          // lamports waiting for the creator
  cap: number | null;   // market cap in lamports
  progress: number;     // 0..1 along the bonding curve
  ageMinutes: number;
}

const LAMPORTS = 1_000_000_000;

/*
 * Spread deliberately rather than randomly: one coin fresh enough to carry the
 * "new" dot, two graduated, a long tail near zero, and one runaway. A board
 * where every card holds a similar number tells you nothing about how the
 * layout copes with the ones that do not.
 */
const SEEDS: Seed[] = [
  { name: "Beast Coin", symbol: "BEAST", mint: "demo1beastnotarealmint", platform: "x", handle: "mrbeast", display: "MrBeast", fee: 4.182 * LAMPORTS, cap: 812 * LAMPORTS, progress: 1, ageMinutes: 2 },
  { name: "Z Token", symbol: "ZDY", mint: "demo2zdynotarealmint", platform: "instagram", handle: "zendaya", display: "Zendaya", fee: 1.907 * LAMPORTS, cap: 404 * LAMPORTS, progress: 1, ageMinutes: 190 },
  { name: "Khaby", symbol: "KHAB", mint: "demo1khabnotarealmint", platform: "tiktok", handle: "khaby.lame", display: "Khaby Lame", fee: 1.244 * LAMPORTS, cap: 96 * LAMPORTS, progress: 0.71, ageMinutes: 320 },
  { name: "Naval", symbol: "NVL", mint: "demo1nvlnotarealmint", platform: "x", handle: "naval", display: "Naval", fee: 0.663 * LAMPORTS, cap: 61 * LAMPORTS, progress: 0.54, ageMinutes: 700 },
  { name: "King James", symbol: "KING", mint: "demo1kingnotarealmint", platform: "instagram", handle: "kingjames", display: "LeBron James", fee: 0.401 * LAMPORTS, cap: 38 * LAMPORTS, progress: 0.36, ageMinutes: 1_180 },
  { name: "Bella", symbol: "POAR", mint: "demo1poarnotarealmint", platform: "tiktok", handle: "bellapoarch", display: "Bella Poarch", fee: 0.219 * LAMPORTS, cap: 24 * LAMPORTS, progress: 0.22, ageMinutes: 1_900 },
  { name: "Vitalik", symbol: "VIT", mint: "demo1vitnotarealmint", platform: "x", handle: "VitalikButerin", display: "Vitalik Buterin", fee: 0.118 * LAMPORTS, cap: 15 * LAMPORTS, progress: 0.14, ageMinutes: 2_600 },
  { name: "Wisdom", symbol: "WSDM", mint: "demo2wsdmnotarealmint", platform: "reddit", handle: "wisdomofsolomon", display: "u/wisdomofsolomon", fee: 0.061 * LAMPORTS, cap: 9 * LAMPORTS, progress: 0.08, ageMinutes: 3_400 },
  { name: "Gunk", symbol: "GUNK", mint: "demo1gunknotarealmint", platform: "reddit", handle: "gunkmaxxing", display: "u/gunkmaxxing", fee: 0.024 * LAMPORTS, cap: 5 * LAMPORTS, progress: 0.04, ageMinutes: 4_800 },
  { name: "Late Night", symbol: "LATE", mint: "demo2latenotarealmint", platform: "x", handle: "latenightgn", display: "Late Night", fee: 0, cap: 2 * LAMPORTS, progress: 0.01, ageMinutes: 6_100 },
];

/**
 * `now` is passed in rather than read here so a caller can render a stable
 * board; the ages are relative and would otherwise drift between the server
 * render and anything that recomputed them.
 */
export function demoBoard(now: number = Date.now()): BoardCoin[] {
  return SEEDS.map((seed, i) => ({
    mint: seed.mint,
    creator_id: i + 1,
    name: seed.name,
    symbol: seed.symbol,
    description: null,
    metadata_uri: "",
    image_url: null,
    launcher: "demo",
    signature: "demo",
    dev_buy_lamports: 0,
    created_at: now - seed.ageMinutes * 60_000,

    platform: seed.platform,
    handle: seed.handle,
    display_name: seed.display,
    avatar_url: null,
    // X is the only platform with a native pump.fun social vault; the rest are
    // escrows Backd holds the key to. Mirroring that here keeps the demo board
    // honest about which badge each card should be showing.
    escrow_kind: seed.platform === "x" ? "pump-social" : "managed",
    escrow_pubkey: `demo-escrow-${i}`,
    verified_at: null,

    feeLamports: seed.fee,
    marketCapLamports: seed.cap,
    liquidityLamports: Math.round((seed.cap ?? 0) * 0.14),
    progress: seed.progress,
    graduated: seed.progress >= 1,
  }));
}
