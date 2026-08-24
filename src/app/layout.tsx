import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { BottomTabs, MobileTopBar, Sidebar } from "@/components/AppShell";
import { SolanaProviders } from "@/components/WalletProvider";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";
import { resolveSiteUrl } from "@/lib/siteUrl";

import "./globals.css";

/*
 * One variable face across the app. Glass leans on very fine weight and
 * tracking differences to read as premium, and a system stack that resolves
 * differently on every OS cannot hold that.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: "creator.fun — launch a coin, the creator gets paid",
    template: "%s — creator.fun",
  },
  description:
    "Launch a coin for any X, Instagram, or TikTok creator on pump.fun. " +
    `Every trade routes ${formatShare(creatorShareBps())} of creator fees to ` +
    "a wallet only they can open.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
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
              {/* Bottom padding clears the mobile tab bar. */}
              <div className="px-4 pb-28 pt-5 md:px-8 md:pb-16 md:pt-8">{children}</div>
            </div>
          </div>

          <BottomTabs />
        </SolanaProviders>
      </body>
    </html>
  );
}
