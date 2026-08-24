import Link from "next/link";

import { formatSol } from "@/components/ui";
import type { BoardEntry } from "@/components/LaunchCard";

/**
 * Scrolling strip of recent launches.
 *
 * The content is rendered twice so the track can translate exactly half its
 * width and loop without a visible seam. The edges are faded by the `ticker`
 * sheet's own mask rather than by overlays here — see globals.css.
 */
export function Ticker({ coins }: { coins: BoardEntry[] }) {
  if (coins.length === 0) return null;
  const run = [...coins, ...coins];

  return (
    <div className="ticker relative">
      <div className="marquee gap-6 pr-6">
        {run.map((coin, index) => (
          <Link
            key={`${coin.mint}-${index}`}
            href={`/coin/${coin.mint}`}
            aria-hidden={index >= coins.length}
            tabIndex={index >= coins.length ? -1 : undefined}
            className="flex shrink-0 items-center gap-2 px-1 text-xs"
          >
            <span className="font-mono font-semibold">${coin.symbol}</span>
            <span className="text-[var(--color-faint)]">@{coin.handle}</span>
            <span className="tnum font-mono text-[var(--color-money)]">
              {formatSol(coin.feeLamports)} SOL
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
