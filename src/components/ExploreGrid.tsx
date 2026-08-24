"use client";

import { useMemo, useState } from "react";

import { CoinTile, EmptyState } from "@/components/ui";
import { PLATFORMS, PLATFORM_LABELS, type EscrowKind, type Platform } from "@/lib/social/types";

export interface ExploreCoin {
  mint: string;
  name: string;
  symbol: string;
  image_url: string | null;
  platform: Platform;
  handle: string;
  escrow_kind: EscrowKind;
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
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, ticker, or handle"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[#0c0c11] px-4 py-2.5 text-sm outline-none transition placeholder:text-[#4c4c5a] focus:border-[var(--color-accent)]"
        />

        <div className="flex shrink-0 gap-1.5">
          {(["newest", "fees"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className={`rounded-lg border px-3 py-2 text-xs transition ${
                sort === option
                  ? "border-[var(--color-accent)] bg-[#2a1310] text-white"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-white"
              }`}
            >
              {option === "newest" ? "Newest" : "Most earned"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={platform === "all"} onClick={() => setPlatform("all")}>
          All
        </FilterChip>
        {PLATFORMS.map((option) => (
          <FilterChip
            key={option}
            active={platform === option}
            onClick={() => setPlatform(option)}
          >
            {PLATFORM_LABELS[option]}
          </FilterChip>
        ))}
        <span className="ml-auto self-center text-xs text-[var(--color-muted)]">
          {visible.length} of {coins.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try a different search, or clear the platform filter."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((coin) => (
            <CoinTile
              key={coin.mint}
              mint={coin.mint}
              name={coin.name}
              symbol={coin.symbol}
              imageUrl={coin.image_url}
              platform={coin.platform}
              handle={coin.handle}
              escrowKind={coin.escrow_kind}
              feeLamports={coin.feeLamports}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
      className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
        active
          ? "border-[var(--color-accent)] bg-[#2a1310] text-white"
          : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
