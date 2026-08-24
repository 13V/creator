import { EmptyState, LeaderRow, Stat, StorageBanner, formatSol } from "@/components/ui";
import { getLeaderboard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const { data: entries, storageError } = await getLeaderboard(100);
  const totalWaiting = entries.reduce((sum, entry) => sum + entry.feeLamports, 0);
  const unclaimed = entries.filter((entry) => !entry.creator.verified_at).length;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Fees waiting to be claimed</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          Read straight from chain. Most of these creators have no idea this
          money exists yet — if you know one of them, tell them.
        </p>
      </div>

      <StorageBanner error={storageError} />

      {entries.length === 0 && !storageError ? (
        <EmptyState
          title="Nothing to rank yet"
          body="Once coins are launched, the creators earning the most from them show up here."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Total waiting" value={`${formatSol(totalWaiting)} SOL`} accent />
            <Stat label="Creators" value={entries.length} />
            <Stat label="Yet to claim" value={unclaimed} />
          </div>

          <div className="grid gap-2">
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
        </>
      )}
    </div>
  );
}
