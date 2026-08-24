import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";

import { BottomTabs, MobileTopBar, Sidebar } from "@/components/AppShell";
import { SolanaProviders } from "@/components/WalletProvider";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";
import { platformList } from "@/lib/social/types";
import { resolveSiteUrl } from "@/lib/siteUrl";

import "./globals.css";

/*
 * One face, headlines included. A system stack that resolves differently on
 * every OS cannot hold the fine weight and tracking differences the glass
 * leans on, and a second display face for four headlines is a webfont a
 * visitor downloads to read one line.
 */
const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-face",
});

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: "creator.fun — launch a coin, the creator gets paid",
    template: "%s — creator.fun",
  },
  description:
    `Launch a coin for any ${platformList()} creator on pump.fun. ` +
    `Every trade routes ${formatShare(creatorShareBps())} of creator fees to ` +
    "a wallet only they can open.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        {/* Purely decorative: the moving colour that the glass refracts. */}
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>

        {/*
          One provider around the whole tree. Wrapping the rail and the content
          separately would give them independent wallet contexts, so a wallet
          connected in the nav would be invisible to the launch form.
        */}
        <SolanaProviders>
          <div className="flex">
            <Sidebar />

            <div className="min-w-0 flex-1">
              <MobileTopBar />
              {/* Bottom padding clears the floating mobile tab bar. */}
              <div className="px-4 pb-32 pt-5 md:px-10 md:pb-12 md:pt-8">{children}</div>
            </div>
          </div>

          <BottomTabs />
        </SolanaProviders>
      </body>
    </html>
  );
}
