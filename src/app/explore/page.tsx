import { ExploreGrid } from "@/components/ExploreGrid";
import { EmptyState } from "@/components/ui";
import { listBoard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  const coins = await listBoard(200);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <h1 className="mb-4 text-xl font-bold tracking-tight">Explore</h1>
      {coins.length === 0 ? (
        <EmptyState title="No coins yet" body="Launch the first one." />
      ) : (
        <ExploreGrid coins={coins} />
      )}
    </div>
  );
}
