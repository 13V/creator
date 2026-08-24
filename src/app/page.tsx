import Link from "next/link";

import { LaunchCard, type BoardEntry } from "@/components/LaunchCard";
import { Ticker } from "@/components/Ticker";
import { EmptyState, formatSol } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { listBoard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type Sort = "new" | "top" | "close" | "mc";

const SORTS: { key: Sort; label: string }[] = [
  { key: "new", label: "Newest" },
  { key: "close", label: "Near graduation" },
  { key: "mc", label: "Market cap" },
  { key: "top", label: "Creator fees" },
];

function order(coins: BoardEntry[], sort: Sort): BoardEntry[] {
  return [...coins].sort((a, b) => {
    if (sort === "top") return b.feeLamports - a.feeLamports;
    if (sort === "close") return b.progress - a.progress;
    if (sort === "mc") return (b.marketCapLamports ?? 0) - (a.marketCapLamports ?? 0);
    return b.created_at - a.created_at;
  });
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: raw } = await searchParams;
  const sort = (SORTS.find((s) => s.key === raw)?.key ?? "new") as Sort;

  const coins = await listBoard(160);
  const graduated = coins.filter((coin) => coin.graduated);
  const climbing = order(coins.filter((coin) => !coin.graduated), sort);
  const waiting = coins.reduce((sum, coin) => sum + coin.feeLamports, 0);

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-5">
      <Ticker coins={coins.slice(0, 14)} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl sm:text-[2.4rem]">
            Launch a coin for anyone.
            <br />
            <span className="text-[var(--color-accent)]">They get paid, not you.</span>
          </h1>
          <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
            Every trade routes creator fees to a wallet only that creator can
            open. <span className="tnum font-semibold text-[var(--color-accent)]">
              {formatSol(waiting)} SOL
            </span>{" "}
            is waiting to be claimed right now.
          </p>
        </div>

        <Link href="/launch" className="btn-primary flex items-center gap-2 px-6 py-3.5 text-sm">
          <PlusIcon />
          Launch a coin
        </Link>
      </div>

      {graduated.length > 0 && (
        <section className="section-lime">
          <SectionHead
            title="Graduated"
            count={graduated.length}
            blurb="Coins whose bonding curve filled and migrated to the AMM."
          />
          <Grid coins={graduated.slice(0, 10)} />
        </section>
      )}

      <section className="section-shell">
        <SectionHead
          title="Still climbing"
          count={climbing.length}
          blurb="Coins working their way up the bonding curve toward graduation."
        />

        <div className="mb-4 -mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="segmented">
            {SORTS.map((option) => (
              <Link
                key={option.key}
                href={option.key === "new" ? "/" : `/?sort=${option.key}`}
                data-active={sort === option.key}
                className="segment"
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {climbing.length === 0 ? (
          <EmptyState
            title="Nothing climbing"
            body="Pick a creator and put their coin on-chain."
          />
        ) : (
          <Grid coins={climbing} />
        )}
      </section>
    </div>
  );
}

function SectionHead({
  title,
  count,
  blurb,
}: {
  title: string;
  count: number;
  blurb: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <span className="count-pill tnum bg-[#ffffff12] text-[var(--color-muted)]">{count}</span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{blurb}</p>
    </div>
  );
}

function Grid({ coins }: { coins: BoardEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {coins.map((coin) => (
        <LaunchCard key={coin.mint} coin={coin} />
      ))}
    </div>
  );
}
