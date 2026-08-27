import Link from "next/link";

import { CoinMedia } from "@/components/CoinMedia";
import { coinTint } from "@/lib/coinArt";
import { Avatar, PlatformMark, formatSol, shortAddress, timeAgo } from "@/components/ui";
import type { EscrowKind, Platform } from "@/lib/social/types";

export interface BoardEntry {
  mint: string;
  name: string;
  symbol: string;
  image_url: string | null;
  platform: Platform;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  escrow_kind: EscrowKind;
  created_at: number;
  feeLamports: number;
  marketCapLamports: number | null;
  liquidityLamports: number;
  progress: number;
  graduated: boolean;
}

/** Anything launched in the last few minutes is worth pointing at. */
const FRESH_MS = 5 * 60 * 1000;

/**
 * One coin on the board.
 *
 * Carries what a launchpad is read for — market cap and how far the curve has
 * filled — plus the thing that makes this one different: what the creator it
 * names has waiting for them.
 */
/*
 * How long the entrance stagger runs before it stops adding delay.
 *
 * The board renders up to 160 coins. Multiplying every index would put the
 * last card six seconds after the first, long after the visitor has stopped
 * looking at an empty grid — so the queue is capped and everything past it
 * arrives together, which nobody sees because it is below the fold anyway.
 */
const STAGGER_MS = 38;
const STAGGER_CAP = 14;

export function LaunchCard({ coin, index = 0 }: { coin: BoardEntry; index?: number }) {
  const percent = Math.round(coin.progress * 100);
  const fresh = Date.now() - coin.created_at < FRESH_MS;

  return (
    <Link
      href={`/coin/${coin.mint}`}
      className="card lift rise group flex flex-col p-2"
      style={{
        /* Seeded from the mint, so a coin keeps its colour across renders and
           the grid reads as a set of things rather than one repeated card. */
        background: coinTint(coin.mint),
        animationDelay: `${Math.min(index, STAGGER_CAP) * STAGGER_MS}ms`,
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[var(--color-rule)] bg-[var(--color-sunk)]">
        <CoinMedia
          src={coin.image_url}
          alt={coin.name}
          seed={coin.mint}
          className="coin-art"
        />
        {coin.graduated && (
          <span className="sticker absolute left-1.5 top-1.5">Graduated</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-0.5 pb-0.5 pt-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight">{coin.name}</div>
          <div className="tnum truncate text-[11px] text-[var(--color-faint)]">
            ${coin.symbol}
          </div>
        </div>

        {/*
          Creator fees lead rather than market cap. It is the number this
          launchpad exists for, and unlike market cap it is accurate for every
          coin: a graduated coin migrates to Raydium, which this does not read,
          so its curve price is genuinely unknown rather than zero.
        */}
        <div className="flex items-baseline gap-1.5">
          <span className="tnum glow-money text-[15px] font-bold text-[var(--color-money)]">
            {formatSol(coin.feeLamports)}
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">SOL to creator</span>
        </div>

        {coin.graduated ? (
          <div className="text-[10px] text-[var(--color-faint)]">
            Curve filled · trading on the AMM
          </div>
        ) : (
          <div>
            <div className="curve-track">
              <div className="curve-fill" style={{ width: `${Math.max(percent, 1.5)}%` }} />
            </div>
            <div className="mt-1 flex items-baseline justify-between text-[10px] text-[var(--color-faint)]">
              <span>
                {coin.marketCapLamports === null
                  ? "to graduation"
                  : `${formatSol(coin.marketCapLamports)} SOL MC`}
              </span>
              <span className="tnum">{percent}%</span>
            </div>
          </div>
        )}

        <div className="mt-auto grid grid-cols-1 gap-1.5 border-t border-[var(--color-rule)] pt-2">
          <div className="flex items-center gap-1.5">
            <Avatar src={coin.avatar_url} alt={coin.handle} size={16} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-muted)]">
              <PlatformMark platform={coin.platform} /> @{coin.handle}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-[var(--color-faint)]">
            <span className="min-w-0 truncate">{shortAddress(coin.mint)}</span>
            <span
              className={`flex shrink-0 items-center gap-1.5 ${
                fresh ? "text-[var(--color-money)]" : ""
              }`}
            >
              {fresh && <span className="live-dot" />}
              {timeAgo(coin.created_at)} ago
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
