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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-[clamp(2.25rem,1.5rem+2.6vw,3.35rem)]">
            Launch a coin for anyone.
            <br />
            <em>They get paid, not you.</em>
          </h1>
          <p className="mt-3.5 max-w-[31rem] text-[15px] leading-[1.62] text-[var(--color-muted)] [text-wrap:pretty]">
            Every trade routes {formatShare(creatorShareBps())} of creator fees to
            a wallet only that creator can open.{" "}
            <span className="tnum font-semibold text-[var(--color-money)]">
              {formatSol(waiting)} SOL
            </span>{" "}
            is waiting to be claimed right now.
          </p>
        </div>

        <Link
          href="/launch"
          className="btn-primary flex shrink-0 items-center gap-2 px-[26px] py-3.5 text-sm"
        >
          <PlusIcon />
          Launch a coin
        </Link>
      </div>

      {graduated.length > 0 && (
        <section className="section-lime iridescent">
          <SectionHead
            title="Graduated"
            count={graduated.length}
            blurb="Coins whose bonding curve filled and migrated to the AMM."
          />
          <Grid coins={graduated.slice(0, 10)} />
        </section>
      )}

      <section className="section-shell iridescent">
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
        <span className="count-pill tnum bg-[rgb(56_66_92_/_0.08)] text-[var(--color-muted)]">
          {count}
        </span>
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
