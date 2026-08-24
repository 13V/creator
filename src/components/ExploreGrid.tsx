"use client";

import { useMemo, useState } from "react";

import { GridTile } from "@/components/GridTile";
import { EmptyState } from "@/components/ui";
import { PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/social/types";

export interface ExploreCoin {
  mint: string;
  name: string;
  symbol: string;
  image_url: string | null;
  platform: Platform;
  handle: string;
  feeLamports: number;
  created_at: number;
}

type Sort = "newest" | "fees";

export function ExploreGrid({ coins }: { coins: ExploreCoin[] }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return coins
      .filter((coin) => platform === "all" || coin.platform === platform)
      .filter(
        (coin) =>
          !needle ||
          coin.name.toLowerCase().includes(needle) ||
          coin.symbol.toLowerCase().includes(needle) ||
          coin.handle.toLowerCase().includes(needle),
      )
      .sort((a, b) =>
        sort === "fees" ? b.feeLamports - a.feeLamports : b.created_at - a.created_at,
      );
  }, [coins, query, platform, sort]);

  return (
    <div className="grid gap-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search coins, tickers, creators"
        spellCheck={false}
        className="field"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={platform === "all"} onClick={() => setPlatform("all")}>
          All
        </Chip>
        {PLATFORMS.map((option) => (
          <Chip key={option} active={platform === option} onClick={() => setPlatform(option)}>
            {PLATFORM_LABELS[option]}
          </Chip>
        ))}

        <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />

        <Chip active={sort === "newest"} onClick={() => setSort("newest")}>
          Newest
        </Chip>
        <Chip active={sort === "fees"} onClick={() => setSort("fees")}>
          Top earning
        </Chip>

        <span className="ml-auto text-xs text-[var(--color-faint)]">
          {visible.length} of {coins.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing matches" body="Try a different search, or clear the filters." />
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {visible.map((coin) => (
            <GridTile key={coin.mint} {...coin} imageUrl={coin.image_url} feeLamports={coin.feeLamports} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] font-semibold text-white"
          : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-fg)]"
      }`}
    >
      {children}
    </button>
  );
}
