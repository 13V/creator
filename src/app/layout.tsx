import type { Metadata } from "next";

import { BottomTabs, MobileTopBar, Sidebar } from "@/components/AppShell";
import { SolanaProviders } from "@/components/WalletProvider";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "creator.fun — launch a coin, the creator gets paid",
    template: "%s — creator.fun",
  },
  description:
    "Launch a coin for any X, Instagram, or TikTok creator on pump.fun. " +
    "Every trade routes creator fees to a wallet only they can open.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
