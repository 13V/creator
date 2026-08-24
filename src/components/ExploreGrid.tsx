"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { LaunchCard, type BoardEntry } from "@/components/LaunchCard";
import { EmptyState } from "@/components/ui";
import { PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/social/types";

export type ExploreCoin = BoardEntry;

type Sort = "newest" | "mc" | "close" | "fees";

const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "mc", label: "Market cap" },
  { key: "close", label: "Near graduation" },
  { key: "fees", label: "Creator fees" },
];

export function ExploreGrid({ coins }: { coins: ExploreCoin[] }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");
  const search = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl-K focuses search, which is the shortcut every trading UI uses.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      .sort((a, b) => {
        if (sort === "fees") return b.feeLamports - a.feeLamports;
        if (sort === "mc") return (b.marketCapLamports ?? 0) - (a.marketCapLamports ?? 0);
        if (sort === "close") return b.progress - a.progress;
        return b.created_at - a.created_at;
      });
  }, [coins, query, platform, sort]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="relative">
        <input
          ref={search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search coins, tickers, creators"
          spellCheck={false}
          className="field pr-16"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[var(--glass-edge)] bg-[var(--wash)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-faint)]">
          ⌘K
        </kbd>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="segmented">
          <button type="button" data-active={platform === "all"} onClick={() => setPlatform("all")} className="segment">
            All
          </button>
          {PLATFORMS.map((option) => (
            <button
              key={option}
              type="button"
              data-active={platform === option}
              onClick={() => setPlatform(option)}
              className="segment"
            >
              {PLATFORM_LABELS[option]}
            </button>
          ))}
        </div>

        <div className="segmented">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              data-active={sort === option.key}
              onClick={() => setSort(option.key)}
              className="segment"
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="tnum ml-auto text-xs text-[var(--color-faint)]">
          {visible.length} of {coins.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing matches" body="Try a different search, or clear the filters." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map((coin) => (
            <LaunchCard key={coin.mint} coin={coin} />
          ))}
        </div>
      )}
    </div>
  );
}
