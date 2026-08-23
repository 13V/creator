import { CoinTile, EmptyState } from "@/components/ui";
import { listCoins } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata = { title: "Explore — Creator Launchpad" };

export default function ExplorePage() {
  const coins = listCoins(100);

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coins.map((coin) => (
            <CoinTile
              key={coin.mint}
              mint={coin.mint}
              name={coin.name}
              symbol={coin.symbol}
              imageUrl={coin.image_url}
              platform={coin.platform}
              handle={coin.handle}
              escrowKind={coin.escrow_kind}
            />
          ))}
        </div>
      )}
    </div>
  );
}
