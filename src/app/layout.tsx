import type { Metadata } from "next";
import Link from "next/link";

import { ConnectButton } from "@/components/ConnectButton";
import { SolanaProviders } from "@/components/WalletProvider";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Creator Launchpad — launch a coin, the creator gets paid",
    template: "%s — Creator Launchpad",
  },
  description:
    "Launch a coin for any X, Instagram, or TikTok creator on pump.fun. " +
    "Every trade routes creator fees to a wallet only they can open.",
};

const NAV = [
  { href: "/launch", label: "Launch" },
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/claim", label: "Claim" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          One provider around the whole tree. Wrapping the header and the main
          content separately would give them independent wallet contexts, so a
          wallet connected in the header would be invisible to the page.
        */}
        <SolanaProviders>
          <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[#0a0a0cd9] backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-7 px-5">
              <Link href="/" className="flex shrink-0 items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-white">
                  ✦
                </span>
                <span className="font-semibold tracking-tight">
                  creator<span className="text-[var(--color-faint)]">.fun</span>
                </span>
              </Link>

              <nav className="hidden gap-1 md:flex">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] transition hover:bg-[#ffffff0a] hover:text-[var(--color-fg)]"
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
              hides the leaderboard, which is why most creators arrive at all.
            */}
            <nav className="flex gap-1 overflow-x-auto border-t border-[var(--color-line)] px-5 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--color-muted)] transition hover:bg-[#ffffff0a] hover:text-[var(--color-fg)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="mx-auto max-w-6xl px-5 pb-28 pt-12">{children}</main>
        </SolanaProviders>

        <footer className="border-t border-[var(--color-line)] px-5 py-9 text-center text-xs leading-relaxed text-[var(--color-faint)]">
          <p>
            Coins launch on pump.fun&apos;s bonding curve. Launching a coin for
            someone is not an endorsement by them.
          </p>
          <p className="mt-1">Nothing here is financial advice. Most memecoins go to zero.</p>
        </footer>
      </body>
    </html>
  );
}
