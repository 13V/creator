import Link from "next/link";

import { LaunchFlow } from "@/components/LaunchFlow";
import { CoinTile, EmptyState, LeaderRow, formatSol } from "@/components/ui";
import { getLeaderboard, listCoinsWithFees } from "@/lib/leaderboard";
import { countCoins, countCreators } from "@/lib/repo";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Paste a profile",
    body: "Any X, Instagram, or TikTok creator. We pull their name and picture so the coin actually looks like them.",
  },
  {
    title: "You sign, you pay",
    body: "The coin launches on pump.fun's bonding curve from your own wallet. Add an opening buy if you want in early.",
  },
  {
    title: "They get the fees",
    body: "pump.fun's create instruction takes a creator address separate from the signer. We point it at the creator's escrow — never at you.",
  },
  {
    title: "They claim, whenever",
    body: "Fees pile up on-chain whether or not the creator has ever heard of us. They show up, prove the account is theirs, and take it.",
  },
];

export default async function HomePage() {
  const [recent, leaders] = await Promise.all([
    listCoinsWithFees(6),
    getLeaderboard(5),
  ]);

  const coins = countCoins();
  const creators = countCreators();
  const waiting = leaders.reduce((sum, entry) => sum + entry.feeLamports, 0);

  return (
    <div className="grid gap-14">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-start lg:gap-12">
        <div className="pt-4">
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Launch a coin for any creator.
            <br />
            <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] bg-clip-text text-transparent">
              They get paid, not you.
            </span>
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--color-muted)]">
            Pick a creator, name the coin, sign with your wallet. It lives on
            pump.fun like any other coin — except every trade sends creator fees
            to a wallet only that creator can open.
          </p>

          {coins > 0 && (
            <div className="mt-7 flex flex-wrap gap-8">
              <HeroStat value={coins} label="coins launched" />
              <HeroStat value={creators} label="creators earning" />
              {waiting > 0 && (
                <HeroStat
                  value={`${formatSol(waiting)} SOL`}
                  label="waiting to be claimed"
                  accent
                />
              )}
            </div>
          )}
        </div>

        <LaunchFlow />
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Recently launched</h2>
            <Link
              href="/explore"
              className="text-sm text-[var(--color-muted)] underline-offset-2 hover:text-white hover:underline"
            >
              See all
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyState
              title="Nothing launched yet"
              body="Be the first — paste a creator's profile above and put their coin on-chain."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((coin) => (
                <CoinTile
                  key={coin.mint}
                  mint={coin.mint}
                  name={coin.name}
                  symbol={coin.symbol}
                  imageUrl={coin.image_url}
                  platform={coin.platform}
                  handle={coin.handle}
                  escrowKind={coin.escrow_kind}
                  feeLamports={coin.feeLamports}
                />
              ))}
            </div>
          )}
        </div>

        {leaders.length > 0 && (
          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Fees waiting</h2>
              <Link
                href="/leaderboard"
                className="text-sm text-[var(--color-muted)] underline-offset-2 hover:text-white hover:underline"
              >
                Full list
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
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="card p-5">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#1c1f2b] font-mono text-xs text-[var(--color-accent)]">
                {index + 1}
              </div>
              <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HeroStat({
  value,
  label,
  accent,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-2xl font-bold tabular-nums ${
          accent ? "text-[var(--color-accent)]" : ""
        }`}
      >
        {value}
      </div>
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
    </div>
  );
}
