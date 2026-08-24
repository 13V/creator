import Link from "next/link";

import { CoinMedia } from "@/components/CoinMedia";
import { Avatar, PLATFORM_GLYPH, formatSol, timeAgo } from "@/components/ui";
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

/**
 * One coin on the board.
 *
 * Carries the two numbers a launchpad is read for — market cap and how far the
 * bonding curve has filled — plus the thing that makes this launchpad
 * different: what the named creator has waiting.
 */
export function LaunchCard({ coin }: { coin: BoardEntry }) {
  const percent = Math.round(coin.progress * 100);

  return (
    <Link
      href={`/coin/${coin.mint}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition hover:border-[var(--color-line-strong)]"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        <CoinMedia
          src={coin.image_url}
          alt={coin.name}
          symbol={coin.symbol}
          className="transition duration-200 group-hover:scale-[1.03]"
        />
        <span className="absolute left-2 top-2 rounded-md bg-[#07070ad9] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)] backdrop-blur">
          {timeAgo(coin.created_at)}
        </span>
        {coin.graduated && (
          <span className="absolute right-2 top-2 rounded-md bg-[var(--color-money)] px-1.5 py-0.5 text-[10px] font-bold text-[#04150d]">
            GRADUATED
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-bold tracking-tight">{coin.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-[var(--color-muted)]">
              ${coin.symbol}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Avatar src={coin.avatar_url} alt={coin.handle} size={16} />
            <span className="truncate text-[11px] text-[var(--color-muted)]">
              {PLATFORM_GLYPH[coin.platform]} @{coin.handle}
            </span>
          </div>
        </div>

        <div className="mt-auto grid gap-1.5">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-[var(--color-faint)]">MC</span>
            <span className="tnum font-mono font-semibold">
              {coin.marketCapLamports === null ? "—" : `${formatSol(coin.marketCapLamports)} SOL`}
            </span>
          </div>

          <div>
            <div className="curve-track">
              <div
                className="curve-fill"
                style={{ width: `${Math.max(percent, 1.5)}%` }}
              />
            </div>
            <div className="mt-1 flex items-baseline justify-between text-[10px]">
              <span className="text-[var(--color-faint)]">
                {coin.graduated ? "migrated" : "to graduation"}
              </span>
              <span className="tnum font-mono text-[var(--color-muted)]">{percent}%</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between rounded-lg bg-[#0d2519] px-2 py-1.5 text-[11px]">
            <span className="text-[#3fae83]">to @{coin.handle.slice(0, 12)}</span>
            <span className="tnum font-mono font-bold text-[var(--color-money)]">
              {formatSol(coin.feeLamports)} SOL
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
