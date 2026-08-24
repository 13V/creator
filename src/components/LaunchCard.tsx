import Link from "next/link";

import { CoinMedia } from "@/components/CoinMedia";
import { Avatar, PLATFORM_GLYPH, formatSol, shortAddress, timeAgo } from "@/components/ui";
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
export function LaunchCard({ coin }: { coin: BoardEntry }) {
  const percent = Math.round(coin.progress * 100);
  const fresh = Date.now() - coin.created_at < FRESH_MS;

  return (
    <Link
      href={`/coin/${coin.mint}`}
      className="group flex flex-col rounded-2xl border border-[var(--color-line)] bg-[#101015] p-2.5 transition hover:border-[var(--color-line-strong)]"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl">
        <CoinMedia
          src={coin.image_url}
          alt={coin.name}
          symbol={coin.symbol}
          className="transition duration-200 group-hover:scale-[1.03]"
        />
        {coin.graduated && (
          <span className="absolute left-2 top-2 rounded-full bg-[#0b1400e6] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)] backdrop-blur">
            Graduated
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-1 pb-0.5 pt-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-tight">{coin.name}</div>
          <div className="truncate font-mono text-xs text-[var(--color-muted)]">
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
          <span className="tnum text-lg font-bold text-[var(--color-accent)]">
            {formatSol(coin.feeLamports)}
          </span>
          <span className="text-xs text-[var(--color-muted)]">SOL to creator</span>
        </div>

        {coin.graduated ? (
          <div className="text-[11px] text-[var(--color-faint)]">
            Curve filled · now trading on the AMM
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
              <span className="tnum font-mono">{percent}%</span>
            </div>
          </div>
        )}

        <div className="mt-auto grid gap-2 border-t border-[var(--color-line)] pt-2.5">
          <div className="flex items-center gap-1.5">
            <Avatar src={coin.avatar_url} alt={coin.handle} size={16} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-muted)]">
              {PLATFORM_GLYPH[coin.platform]} @{coin.handle}
            </span>
          </div>

          <div className="flex items-baseline justify-between font-mono text-[10px] text-[var(--color-faint)]">
            <span>{shortAddress(coin.mint)}</span>
            <span className={fresh ? "text-[var(--color-accent)]" : undefined}>
              {timeAgo(coin.created_at)} ago
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
