import Link from "next/link";

import { LaunchFlow } from "@/components/LaunchFlow";
import { CoinTile, EmptyState } from "@/components/ui";
import { countCoins, countCreators, listCoins } from "@/lib/repo";

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

export default function HomePage() {
  const recent = listCoins(6);
  const coins = countCoins();
  const creators = countCreators();

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

          {(coins > 0 || creators > 0) && (
            <div className="mt-7 flex gap-8">
              <div>
                <div className="text-2xl font-bold tabular-nums">{coins}</div>
                <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  coins launched
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{creators}</div>
                <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  creators with fees waiting
                </div>
              </div>
            </div>
          )}
        </div>

        <LaunchFlow />
      </section>

      <section>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              />
            ))}
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
