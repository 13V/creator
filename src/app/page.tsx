import Link from "next/link";

import { LaunchCard, type BoardEntry } from "@/components/LaunchCard";
import { demoBoardEnabled } from "@/lib/demoBoard";
import { EmptyState, StorageBanner, formatSol, formatUsd } from "@/components/ui";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";
import { PlusIcon } from "@/components/icons";
import { listBoard } from "@/lib/leaderboard";
import { getSolUsd } from "@/lib/solPrice";

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

  // Priced once for the whole board rather than per card, and never blocking
  // it: a failed lookup returns null and every figure falls back to SOL.
  const [{ data: coins, storageError }, solUsd] = await Promise.all([
    listBoard(160),
    getSolUsd(),
  ]);
  const graduated = coins.filter((coin) => coin.graduated);
  const climbing = order(coins.filter((coin) => !coin.graduated), sort);
  const waiting = coins.reduce((sum, coin) => sum + coin.feeLamports, 0);

  return (
    <div className="mx-auto grid grid-cols-1 w-full max-w-[1400px] gap-5">
      <StorageBanner error={storageError} />

      {demoBoardEnabled() && <DemoBanner />}

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
              {formatUsd(waiting, solUsd) ?? `${formatSol(waiting)} SOL`}
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
          <Grid coins={graduated.slice(0, 10)} solUsd={solUsd} />
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
          <Grid coins={climbing} solUsd={solUsd} />
        )}
      </section>
    </div>
  );
}

/**
 * Says out loud that none of this is real.
 *
 * A board of invented coins on a mainnet app is the worst thing to ship by
 * accident, so it announces itself rather than relying on whoever set the
 * environment variable remembering they did.
 */
function DemoBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-[var(--color-fg)] bg-[var(--color-caution)] px-4 py-2.5 text-[var(--color-caution-line)]">
      <span className="text-[13px] leading-none">{"\u{1F6A7}"}</span>
      <p className="text-[12.5px] font-semibold leading-tight">
        Demo board — every coin below is invented, for looking at the layout.
        Nothing here exists on chain.
      </p>
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

function Grid({ coins, solUsd }: { coins: BoardEntry[]; solUsd: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {coins.map((coin, i) => (
        <LaunchCard key={coin.mint} coin={coin} index={i} solUsd={solUsd} />
      ))}
    </div>
  );
}
