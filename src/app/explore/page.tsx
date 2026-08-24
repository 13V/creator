import { ExploreGrid } from "@/components/ExploreGrid";
import { EmptyState, StorageBanner } from "@/components/ui";
import { listBoard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  const { data: coins, storageError } = await listBoard(200);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-5">
        <h1 className="display text-[clamp(1.9rem,1.4rem+1.7vw,2.6rem)]">
          Every coin on the pad.
        </h1>
        <p className="mt-2.5 max-w-[31rem] text-[15px] leading-[1.62] text-[var(--color-muted)] [text-wrap:pretty]">
          Search by creator or ticker, sort by what is climbing, and see what
          each one has put aside for the person it names.
        </p>
      </header>
      <StorageBanner error={storageError} />
      {coins.length === 0 && !storageError ? (
        <EmptyState title="No coins yet" body="Launch the first one." />
      ) : (
        <ExploreGrid coins={coins} />
      )}
    </div>
  );
}
