import Link from "next/link";

import { LaunchCard } from "@/components/LaunchCard";
import { Ticker } from "@/components/Ticker";
import { EmptyState, formatSol } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { listBoard } from "@/lib/leaderboard";
import { countCoins, countCreators } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Sort = "new" | "top" | "close";

const TABS: { key: Sort; label: string }[] = [
  { key: "new", label: "New" },
  { key: "top", label: "Top earning" },
  { key: "close", label: "Near graduation" },
];

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: raw } = await searchParams;
  const sort: Sort = raw === "top" ? "top" : raw === "close" ? "close" : "new";

  const coins = await listBoard(120);
  const ordered = [...coins].sort((a, b) => {
    if (sort === "top") return b.feeLamports - a.feeLamports;
    // Coins already migrated are done, so they sink below anything still climbing.
    if (sort === "close") {
      if (a.graduated !== b.graduated) return a.graduated ? 1 : -1;
      return b.progress - a.progress;
    }
    return b.created_at - a.created_at;
  });

  const waiting = coins.reduce((sum, coin) => sum + coin.feeLamports, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <Ticker coins={coins.slice(0, 14)} />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl sm:text-[2.5rem]">
            Launch a coin for anyone.
            <br />
            <span className="text-[var(--color-accent)]">They get paid, not you.</span>
          </h1>
          <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
            Every trade routes creator fees to a wallet only that creator can
            open. They never need an account here.
          </p>
        </div>

        <Link href="/launch" className="btn-primary flex items-center gap-2 px-6 py-3.5 text-sm">
          <PlusIcon />
          Launch a coin
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Stat label="coins" value={countCoins()} />
        <Stat label="creators earning" value={countCreators()} />
        <Stat label="SOL unclaimed" value={formatSol(waiting)} accent />
      </div>

      <div className="mt-6 flex gap-1 border-b border-[var(--color-line)]">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "new" ? "/" : `/?sort=${tab.key}`}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm transition ${
              sort === tab.key
                ? "border-[var(--color-accent)] font-semibold text-[var(--color-fg)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {ordered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Board's empty"
            body="Be the first — pick a creator and put their coin on-chain."
          />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {ordered.map((coin) => (
            <LaunchCard key={coin.mint} coin={coin} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2.5">
      <div className={`tnum text-lg font-bold ${accent ? "text-[var(--color-money)]" : ""}`}>
        {value}
      </div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}
