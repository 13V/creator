import { ExploreGrid } from "@/components/ExploreGrid";
import { EmptyState } from "@/components/ui";
import { listCoinsWithFees } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  const coins = await listCoinsWithFees(200);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Every coin launched here</h1>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Each one has creator fees accruing to the creator it names.
        </p>
      </div>

      {coins.length === 0 ? (
        <EmptyState
          title="No coins yet"
          body="Launch the first one from the home page."
        />
      ) : (
        <ExploreGrid coins={coins} />
      )}
    </div>
  );
}
