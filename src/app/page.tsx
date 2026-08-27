import Link from "next/link";

import { LaunchCard, type BoardEntry } from "@/components/LaunchCard";
import { Ticker } from "@/components/Ticker";
import { EmptyState, StorageBanner, formatSol } from "@/components/ui";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";
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

  const { data: coins, storageError } = await listBoard(160);
  const graduated = coins.filter((coin) => coin.graduated);
  const climbing = order(coins.filter((coin) => !coin.graduated), sort);
  const waiting = coins.reduce((sum, coin) => sum + coin.feeLamports, 0);

  return (
    <div className="mx-auto grid grid-cols-1 w-full max-w-[1400px] gap-5">
      <StorageBanner error={storageError} />

      <Ticker coins={coins.slice(0, 14)} />

      <section className="hero-slab flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
        <div className="min-w-0">
          <span className="sticker tilt stamp mb-3.5 inline-flex" style={{ animationDelay: "120ms" }}>
            90% to the creator · always
          </span>

          <h1
            className="display rise text-[clamp(2.25rem,1.5rem+2.6vw,3.35rem)]"
            style={{ animationDelay: "60ms" }}
          >
            Launch a coin for anyone.
            <br />
            <em>They get paid, not you.</em>
          </h1>

          <p
            className="rise mt-3.5 max-w-[31rem] text-[15px] leading-[1.62] text-white/85 [text-wrap:pretty]"
            style={{ animationDelay: "180ms" }}
          >
            Every trade sends {formatShare(creatorShareBps())} of the creator fee
            to a wallet held for the creator it names.{" "}
            <span className="tnum font-semibold text-[var(--color-money-lite,#2bea86)]">
              {formatSol(waiting)} SOL
            </span>{" "}
            is waiting to be claimed right now.
          </p>
        </div>

        <Link
          href="/launch"
          className="btn-cream rise flex shrink-0 items-center gap-2 px-[26px] py-3.5 text-sm"
          style={{ animationDelay: "280ms" }}
        >
          <PlusIcon />
          Launch a coin
        </Link>
      </section>

      {graduated.length > 0 && (
        <section className="section-mint">
          <SectionHead
            title="Graduated"
            count={graduated.length}
            blurb="Their bonding curve filled, and they migrated to the AMM."
          />
          <Grid coins={graduated.slice(0, 10)} />
        </section>
      )}

      <section className="section-butter">
        <SectionHead
          title="Still climbing"
          count={climbing.length}
          blurb="Still on the curve, climbing toward graduation."
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

        {climbing.length === 0 && !storageError ? (
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
        <h2 className="section-title">{title}</h2>
        <span className="count-pill tnum bg-[var(--color-panel-2)] text-[var(--color-muted)]">
          {count}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{blurb}</p>
    </div>
  );
}

function Grid({ coins }: { coins: BoardEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {coins.map((coin, i) => (
        <LaunchCard key={coin.mint} coin={coin} index={i} />
      ))}
    </div>
  );
}
