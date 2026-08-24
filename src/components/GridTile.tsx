import Link from "next/link";

import { CoinMedia } from "@/components/CoinMedia";

import { formatSol, PLATFORM_GLYPH } from "@/components/ui";
import type { Platform } from "@/lib/social/types";

/**
 * Square media tile for the explore and profile grids.
 *
 * The caption stays visible rather than waiting for hover: a coin's artwork is
 * rarely self-explanatory the way a photograph is, and touch has no hover to
 * reveal it with.
 */
export function GridTile({
  mint,
  name,
  symbol,
  imageUrl,
  platform,
  handle,
  feeLamports,
  showHandle = true,
  showFees = true,
}: {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  platform: Platform;
  handle: string;
  feeLamports: number;
  showHandle?: boolean;
  /** Off on a creator's own profile, where every tile shares one escrow total. */
  showFees?: boolean;
}) {
  return (
    <Link
      href={`/coin/${mint}`}
      className="group relative block aspect-square overflow-hidden rounded-xl bg-[var(--color-sunk)]"
    >
      <div className="absolute inset-0">
        <CoinMedia
          src={imageUrl}
          alt={name}
          symbol={symbol}
          className="transition duration-200 group-hover:scale-[1.03]"
        />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[var(--scrim-strong)] via-[var(--scrim)] to-transparent p-3">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-[var(--color-muted)]">${symbol}</span>
          {showHandle && (
            <span className="truncate text-[11px] text-[var(--color-muted)]">
              {PLATFORM_GLYPH[platform]} @{handle}
            </span>
          )}
        </div>
        {showFees && feeLamports > 0 && (
          <div className="tnum mt-1 font-mono text-[11px] text-[var(--color-money)]">
            {formatSol(feeLamports)} SOL to @{handle}
          </div>
        )}
      </div>
    </Link>
  );
}
