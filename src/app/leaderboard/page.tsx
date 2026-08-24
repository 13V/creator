import { EmptyState, LeaderRow, StorageBanner, formatSol } from "@/components/ui";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";
import { getLeaderboard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Earning" };

export default async function EarningPage() {
  const { data: entries, storageError } = await getLeaderboard(100);
  const totalWaiting = entries.reduce((sum, entry) => sum + entry.feeLamports, 0);
  const unclaimed = entries.filter((entry) => !entry.creator.verified_at).length;

  return (
    <div className="mx-auto grid w-full max-w-[1040px] grid-cols-1 gap-[18px]">
      <header>
        <h1 className="display text-[clamp(2.1rem,1.5rem+2vw,3rem)]">
          Fees are already piling up.
          <br />
          <em>Every one of them has a name on it.</em>
        </h1>
        <p className="mt-3.5 max-w-[33rem] text-[15px] leading-[1.62] text-[var(--color-muted)] [text-wrap:pretty]">
          {formatShare(creatorShareBps())} of each trade&rsquo;s creator fee is
          held for the creator the coin was launched for. These balances are read
          straight off the chain.
        </p>
      </header>

      <StorageBanner error={storageError} />

      {entries.length === 0 && !storageError ? (
        <EmptyState
          title="Nothing to rank yet"
          body="Once coins are launched, the creators earning the most from them show up here."
        />
      ) : (
        <>
          {/*
            The hero band the mockups lead with. One figure at the size of a
            headline, because it is the only number on this page that decides
            whether a creator reads the rest of it.
          */}
          <section className="section-lime flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <div className="eyebrow">Waiting to be claimed</div>
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className="tnum text-[clamp(2.5rem,1.8rem+2.4vw,3.5rem)] font-bold leading-none tracking-tight text-[var(--color-money)]">
                  {formatSol(totalWaiting)}
                </span>
                <span className="text-lg font-semibold text-[var(--color-muted)]">SOL</span>
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                across {entries.length} creator{entries.length === 1 ? "" : "s"}
                {unclaimed > 0 && ` · ${unclaimed} yet to claim`}
              </div>
            </div>

            <a href="/claim" className="btn-primary shrink-0 px-[26px] py-3.5 text-sm">
              Claim yours
            </a>
          </section>

          <section className="section-shell">
            <h2 className="section-title">Who is earning</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Ranked by SOL sitting in escrow right now. Trading volume is not part of it.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2">
              {entries.map((entry, index) => (
                <LeaderRow
                  key={entry.creator.id}
                  rank={index + 1}
                  platform={entry.creator.platform}
                  handle={entry.creator.handle}
                  displayName={entry.creator.display_name}
                  avatarUrl={entry.creator.avatar_url}
                  coinCount={entry.creator.coin_count}
                  feeLamports={entry.feeLamports}
                  claimed={Boolean(entry.creator.verified_at)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
