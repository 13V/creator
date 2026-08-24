import Link from "next/link";

import { CoinTile, EmptyState, LeaderRow, PrimaryLink, formatSol } from "@/components/ui";
import { getLeaderboard, listCoinsWithFees } from "@/lib/leaderboard";
import { countCoins, countCreators } from "@/lib/repo";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Name a creator",
    body: "Any X, Instagram, or TikTok handle. We pull their name and picture, or you bring your own artwork.",
  },
  {
    title: "You sign and pay",
    body: "It launches on pump.fun's bonding curve from your wallet. Take an opening buy if you want in first.",
  },
  {
    title: "They earn, not you",
    body: "pump.fun's create instruction takes a creator address separate from the signer. We point it at their escrow.",
  },
  {
    title: "They claim, whenever",
    body: "Fees stack up on-chain whether or not they have heard of us. They turn up, prove the account, take it.",
  },
];

export default async function HomePage() {
  const [recent, leaders] = await Promise.all([listCoinsWithFees(6), getLeaderboard(5)]);
  const coins = countCoins();
  const creators = countCreators();
  const waiting = leaders.reduce((sum, entry) => sum + entry.feeLamports, 0);

  return (
    <div className="grid gap-16">
      <section className="pt-6">
        <span className="eyebrow">Creator coins on pump.fun</span>
        <h1 className="display mt-4 max-w-4xl text-[2.5rem] sm:text-[3.5rem]">
          Launch a coin for anyone.
          <br />
          <span className="text-[var(--color-accent)]">They get paid, not you.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--color-muted)]">
          Pick a creator, name the coin, sign with your wallet. It trades on
          pump.fun like any other coin — except every trade routes creator fees
          to a wallet only that creator can open.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <PrimaryLink href="/launch">Launch a coin ✦</PrimaryLink>
          <Link
            href="/claim"
            className="rounded-full border border-[var(--color-line-strong)] px-5 py-3 text-sm font-semibold transition hover:border-[var(--color-fg)]"
          >
            Claim your fees
          </Link>
        </div>

        {coins > 0 && (
          <div className="mt-10 flex flex-wrap gap-10">
            <HeroStat value={coins} label="coins launched" />
            <HeroStat value={creators} label="creators earning" />
            {waiting > 0 && (
              <HeroStat value={`${formatSol(waiting)} SOL`} label="waiting to be claimed" accent />
            )}
          </div>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <SectionHead title="Recently launched" href="/explore" cta="See all" />
          {recent.length === 0 ? (
            <EmptyState
              title="Nothing launched yet"
              body="Be the first — name a creator and put their coin on-chain."
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
            <SectionHead title="Fees waiting" href="/leaderboard" cta="Full list" />
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
        <h2 className="mb-5 text-lg font-semibold">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="card p-5">
              <div className="tnum grid h-7 w-7 place-items-center rounded-lg bg-[#1e1e26] font-mono text-xs text-[var(--color-accent)]">
                {index + 1}
              </div>
              <h3 className="mt-3.5 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHead({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Link
        href={href}
        className="text-sm text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-fg)] hover:underline"
      >
        {cta}
      </Link>
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
      <div className={`tnum text-2xl font-bold ${accent ? "text-[var(--color-money)]" : ""}`}>
        {value}
      </div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}
