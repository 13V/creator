"use client";

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

import "@solana/wallet-adapter-react-ui/styles.css";

const PUBLIC_MAINNET = "https://api.mainnet-beta.solana.com";

/**
 * `??` is not enough here: hosting dashboards store a field you left blank as
 * an empty string, and this component is prerendered, so an unusable endpoint
 * fails the production build rather than degrading at runtime.
 */
function rpcUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (!configured || !/^https?:\/\//i.test(configured)) return PUBLIC_MAINNET;
  return configured;
}

const RPC_URL = rpcUrl();

export function SolanaProviders({ children }: { children: ReactNode }) {
  // Imported from the individual adapter packages rather than the
  // `wallet-adapter-wallets` bundle: that bundle ships every adapter, which
  // drags in WalletConnect, viem, the Stellar SDK and Ledger USB bindings —
  // hundreds of packages and two unresolvable-import build warnings, for two
  // wallets. Wallet-standard discovery still finds anything else installed.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
