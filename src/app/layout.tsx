import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";

import { BottomTabs, MobileTopBar, Sidebar, SiteFooter } from "@/components/AppShell";
import { Backdrop } from "@/components/Backdrop";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { SolanaProviders } from "@/components/WalletProvider";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";
import { platformList } from "@/lib/social/types";
import { resolveSiteUrl } from "@/lib/siteUrl";

import "./globals.css";

/*
 * Space Grotesk for words, Space Mono for figures.
 *
 * The two were drawn as one family, so the pairing is a relationship rather
 * than two faces that happen to co-exist. Grotesk is a grotesque with its
 * corners cut — the flat-sided o, the angled terminals — which reads young
 * without being a costume, and it holds up at both 10px in a table row and
 * 3.5rem in a headline. Instrument Sans, which this replaces, was perfectly
 * competent and completely anonymous.
 */
const sans = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-face",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: {
    default: "Backd — launch a coin, the creator gets paid",
    template: "%s — Backd",
  },
  description:
    `Launch a coin for any ${platformList()} creator on pump.fun. ` +
    `Every trade routes ${formatShare(creatorShareBps())} of creator fees to ` +
    "a wallet only they can open.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Applies the stored theme before the first paint. Anything later —
          an effect, a layout hook — renders one frame of the default theme
          first, and a full-page flash from near-black to cream is worse than
          no theme switch at all.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* Ground texture, under every route. */}
        <Backdrop />

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
              <div className="px-4 pb-32 pt-5 md:px-10 md:pb-12 md:pt-8">
                {children}
                <SiteFooter />
              </div>
            </div>
          </div>

          <BottomTabs />
        </SolanaProviders>
      </body>
    </html>
  );
}
