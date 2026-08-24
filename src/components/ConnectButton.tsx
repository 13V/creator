"use client";

import dynamic from "next/dynamic";

/**
 * The wallet button reads `window` during render, so it must never be
 * server-rendered or hydration mismatches follow.
 */
export const ConnectButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-36 animate-pulse rounded-[10px] bg-[rgb(56_66_92_/_0.1)]" /> },
);
