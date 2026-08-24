import Link from "next/link";

import { formatSol } from "@/components/ui";
import type { BoardEntry } from "@/components/LaunchCard";

/**
 * Scrolling strip of recent launches.
 *
 * The content is rendered twice so the track can translate exactly half its
 * width and loop without a visible seam.
 */
export function Ticker({ coins }: { coins: BoardEntry[] }) {
  if (coins.length === 0) return null;
  const run = [...coins, ...coins];

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] py-2">
      <div className="marquee gap-6 pr-6">
        {run.map((coin, index) => (
          <Link
            key={`${coin.mint}-${index}`}
            href={`/coin/${coin.mint}`}
            aria-hidden={index >= coins.length}
            tabIndex={index >= coins.length ? -1 : undefined}
            className="flex shrink-0 items-center gap-2 text-xs"
          >
            <span className="font-mono font-semibold">${coin.symbol}</span>
            <span className="text-[var(--color-faint)]">@{coin.handle}</span>
            <span className="tnum font-mono text-[var(--color-money)]">
              {formatSol(coin.feeLamports)} SOL
            </span>
          </Link>
        ))}
      </div>
      {/* Fade the edges so items enter and leave rather than popping. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--color-panel)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--color-panel)] to-transparent" />
    </div>
  );
}
