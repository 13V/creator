import type { Metadata } from "next";
import Link from "next/link";

import { ConnectButton } from "@/components/ConnectButton";
import { SolanaProviders } from "@/components/WalletProvider";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  // Required for share cards to resolve to absolute URLs.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Creator Launchpad — launch a coin, the creator gets paid",
    template: "%s — Creator Launchpad",
  },
  description:
    "Pick any X, Instagram, or TikTok creator and launch their coin on pump.fun. " +
    "Every trade routes creator fees to a wallet only they can claim.",
};

const NAV = [
  { href: "/", label: "Launch" },
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/claim", label: "Claim fees" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SolanaProviders>
          <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[#07070bd9] backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-sm font-black text-[#06210f]">
                  ◆
                </span>
                <span>
                  creator<span className="text-[var(--color-muted)]">.launch</span>
                </span>
              </Link>

              <nav className="hidden gap-1 md:flex">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] transition hover:bg-[#ffffff0a] hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="ml-auto shrink-0">
                <ConnectButton />
              </div>
            </div>

            {/*
              Below md the links move to their own scrollable row rather than a
              hamburger: four destinations fit, and a menu that needs opening
              hides the leaderboard, which is the reason most creators arrive.
            */}
            <nav className="flex gap-1 overflow-x-auto border-t border-[var(--color-line)] px-5 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--color-muted)] transition hover:bg-[#ffffff0a] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">{children}</main>

          <footer className="border-t border-[var(--color-line)] px-5 py-8 text-center text-xs leading-relaxed text-[var(--color-muted)]">
            <p>
              Coins launch on pump.fun&apos;s bonding curve. Launching a coin for
              someone is not an endorsement by them.
            </p>
            <p className="mt-1">
              Nothing here is financial advice. Most memecoins go to zero.
            </p>
          </footer>
        </SolanaProviders>
      </body>
    </html>
  );
}
