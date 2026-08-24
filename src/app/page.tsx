import Link from "next/link";

import { PostCard } from "@/components/PostCard";
import { EmptyState, LeaderRow, formatSol } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { getLeaderboard, listCoinsWithFees } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

type Sort = "new" | "top";

const TABS: { key: Sort; label: string }[] = [
  { key: "new", label: "New" },
  { key: "top", label: "Top earning" },
];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: raw } = await searchParams;
  const sort: Sort = raw === "top" ? "top" : "new";

  const [coins, leaders] = await Promise.all([listCoinsWithFees(60), getLeaderboard(6)]);
  const posts =
    sort === "top" ? [...coins].sort((a, b) => b.feeLamports - a.feeLamports) : coins;
  const waiting = leaders.reduce((sum, entry) => sum + entry.feeLamports, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1080px] gap-8">
      <div className="mx-auto min-w-0 w-full max-w-[580px] xl:mx-0">
        <Composer />

        <div className="mb-4 mt-5 flex gap-1 border-b border-[var(--color-line)]">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === "new" ? "/" : "/?sort=top"}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm transition ${
                sort === tab.key
                  ? "border-[var(--color-accent)] font-semibold text-[var(--color-fg)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body="Be the first — pick a creator and put their coin on-chain."
          />
        ) : (
          <div className="grid gap-4">
            {posts.map((coin) => (
              <PostCard key={coin.mint} post={coin} />
            ))}
          </div>
        )}
      </div>

      <aside className="sticky top-8 hidden h-fit w-[300px] shrink-0 xl:block">
        {waiting > 0 && (
          <div className="card mb-4 p-4">
            <div className="eyebrow">Unclaimed right now</div>
            <div className="tnum mt-1.5 text-2xl font-bold text-[var(--color-money)]">
              {formatSol(waiting)} SOL
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">
              Sitting on-chain for creators who mostly have no idea it exists.
            </p>
          </div>
        )}

        {leaders.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Earning most</h2>
              <Link
                href="/leaderboard"
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:underline"
              >
                See all
              </Link>
            </div>
            <div className="grid gap-2">
              {leaders.map((entry, index) => (
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
          </div>
        )}

        <p className="mt-5 px-1 text-[11px] leading-relaxed text-[var(--color-faint)]">
          Coins launch on pump.fun&apos;s bonding curve. Launching one for someone
          is not an endorsement by them. Most memecoins go to zero.
        </p>
      </aside>
    </div>
  );
}

/** Feed-top prompt, the way a social app invites you to post. */
function Composer() {
  return (
    <Link
      href="/launch"
      className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[#101015] p-3.5 transition hover:border-[var(--color-line-strong)]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white">
        <PlusIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Which creator deserves a coin?</span>
        <span className="block truncate text-xs text-[var(--color-muted)]">
          Name them and they start earning — no account needed on their side
        </span>
      </span>
    </Link>
  );
}
