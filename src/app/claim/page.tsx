import { Suspense } from "react";

import { ClaimFlow } from "@/components/ClaimFlow";
import { Skeleton } from "@/components/ui";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";
import { platformList } from "@/lib/social/types";

export const metadata = { title: "Claim your fees" };

/*
 * Deliberately short, and every answer checked against what the code actually
 * does. A claim page is where someone decides whether this is a scam, and one
 * confident sentence about a feature that does not exist would be worse than
 * saying nothing at all.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Who launched it?",
    a: "Anyone can. The launcher pays the network fee to create the coin and cannot withdraw a lamport from your escrow.",
  },
  {
    q: "Do I owe anything?",
    a: "No. Claiming costs only the Solana network fee, and that comes out of the amount you are claiming.",
  },
  {
    q: "What if I never claim?",
    a: "Nothing is lost. Fees keep accruing on chain under your name and stay there until you come for them.",
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Prove the account is yours",
    body: "Sign in with the platform, or post a one-time code where only the account owner could put it. Nothing is stored beyond the fact that it checked out.",
  },
  {
    title: "Name the wallet",
    body: "The wallet you connect is the only address the escrow will ever pay. It is bound at the moment you start, so a code that leaks cannot redirect the money.",
  },
  {
    title: "Take the balance",
    body: "One transaction moves everything that has accrued. Later fees keep arriving on their own — this is not a claim you have to repeat.",
  },
];

export default function ClaimPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1040px] grid-cols-1 gap-[18px]">
      <header>
        <h1 className="display text-[clamp(2.1rem,1.5rem+2vw,3rem)]">
          Someone launched a coin
          <br />
          <em>in your name.</em>
        </h1>
        <p className="mt-3.5 max-w-[33rem] text-[15px] leading-[1.62] text-[var(--color-muted)] [text-wrap:pretty]">
          Find your handle to see what has been accruing. Prove the account is
          yours, point it at a wallet, and the escrow opens — no listing, no
          negotiation, nobody to ask.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <ClaimFlow />
        </Suspense>

        <aside className="grid grid-cols-1 gap-[18px]">
          <section className="section-shell iridescent">
            <h2 className="section-title">Three steps</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Takes about a minute. Nothing leaves the escrow until the last one.
            </p>

            <ol className="mt-4 grid grid-cols-1 gap-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[11px] font-bold text-[var(--color-accent-deep)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{step.title}</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="section-shell">
            <div className="eyebrow">Common questions</div>
            <dl className="mt-3 grid grid-cols-1 gap-3.5">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="text-sm font-semibold">{item.q}</dt>
                  <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-[var(--color-line)] pt-3.5 text-[12px] leading-relaxed text-[var(--color-faint)]">
              Coins can be launched for {platformList()} accounts, and{" "}
              {formatShare(creatorShareBps())} of every creator fee is held for
              the creator named on the coin.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
