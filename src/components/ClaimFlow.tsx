"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

import { formatSol } from "@/components/ui";
import { base64ToBytes } from "@/lib/base64";
import { isPlatform, PLATFORM_LABELS, type Platform } from "@/lib/social/types";

interface StartResponse {
  route: "pump.fun" | "launchpad";
  code?: string;
  instructions?: string;
  message?: string;
  escrowPubkey: string;
  error?: string;
}

interface PayoutResponse {
  verified: boolean;
  payout: {
    transaction: string;
    lamports: number;
    blockhash: string;
    lastValidBlockHeight: number;
  };
  error?: string;
}

/**
 * Each platform gets its own card, because the custody story genuinely differs
 * and flattening them into one form would hide that. X can reach pump.fun's
 * native vault, which nobody here can touch; the others are released by this
 * launchpad after a verification code proves the handle.
 */
const CARDS: {
  platform: Platform;
  title: string;
  blurb: string;
}[] = [
  {
    platform: "x",
    title: "X / Twitter creator",
    blurb:
      "Fees for X handles sit in pump.fun's own social vault, keyed to your account id. This launchpad holds no key to it — you unlock it by linking X on pump.fun.",
  },
  {
    platform: "tiktok",
    title: "TikTok creator",
    blurb:
      "Prove the account is yours with a one-time code, then the escrow pays out to any wallet you choose.",
  },
  {
    platform: "instagram",
    title: "Instagram creator",
    blurb:
      "Prove the account is yours with a one-time code, then the escrow pays out to any wallet you choose.",
  },
];

export function ClaimFlow() {
  const search = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [open, setOpen] = useState<Platform | null>(null);
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [start, setStart] = useState<StartResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ signature: string; lamports: number } | null>(null);

  // Deep link from a creator page: /claim?platform=tiktok&handle=khaby.lame
  useEffect(() => {
    const p = search.get("platform");
    const h = search.get("handle");
    if (p && isPlatform(p)) setOpen(p);
    if (p && h) setHandles((prev) => ({ ...prev, [p]: h }));
  }, [search]);

  const handleFor = (platform: Platform) => (handles[platform] ?? "").trim().replace(/^@+/, "");

  const begin = useCallback(
    async (platform: Platform) => {
      const handle = handleFor(platform);
      if (!handle) return;
      setBusy(true);
      setError(null);
      setPaid(null);
      setStart(null);
      setOpen(platform);

      try {
        const res = await fetch("/api/claim/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ platform, handle }),
        });
        const body = (await res.json()) as StartResponse;
        if (!res.ok) throw new Error(body.error ?? "Could not start a claim.");
        setStart(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start a claim.");
      } finally {
        setBusy(false);
      }
    },
    [handles],
  );

  const claim = useCallback(async () => {
    if (!publicKey || !signTransaction || !open) return;
    setBusy(true);
    setError(null);

    try {
      setStatus("Checking your profile for the code…");
      const res = await fetch("/api/claim/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: open,
          handle: handleFor(open),
          wallet: publicKey.toBase58(),
        }),
      });
      const body = (await res.json()) as PayoutResponse;
      if (!res.ok) throw new Error(body.error ?? "Verification failed.");

      setStatus("Verified. Approve the payout…");
      const tx = VersionedTransaction.deserialize(base64ToBytes(body.payout.transaction));
      const signed = await signTransaction(tx);

      setStatus("Sending…");
      const signature = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
      await connection.confirmTransaction(
        {
          signature,
          blockhash: body.payout.blockhash,
          lastValidBlockHeight: body.payout.lastValidBlockHeight,
        },
        "confirmed",
      );

      await fetch("/api/claim/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: open,
          handle: handleFor(open),
          signature,
          lamports: body.payout.lamports,
          destination: publicKey.toBase58(),
        }),
      });

      setPaid({ signature, lamports: body.payout.lamports });
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [open, handles, publicKey, signTransaction, connection]);

  if (paid) {
    return (
      <div className="card grid gap-3 p-9 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#1a2408] text-2xl text-[var(--color-money)]">
          ✦
        </div>
        <h2 className="display text-2xl">
          <span className="tnum">{formatSol(paid.lamports)}</span> SOL is yours
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          It landed in your wallet. Fees keep accruing as people trade — come
          back and claim again any time.
        </p>
        <a
          href={`https://solscan.io/tx/${paid.signature}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mx-auto mt-1 text-xs text-[var(--color-faint)] underline-offset-2 hover:underline"
        >
          View transaction
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {CARDS.map((card) => {
        const active = open === card.platform;
        return (
          <div key={card.platform} className="card p-6">
            <h2 className="text-base font-semibold">{card.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
              {card.blurb}
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={handles[card.platform] ?? ""}
                onChange={(e) =>
                  setHandles((prev) => ({ ...prev, [card.platform]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && begin(card.platform)}
                placeholder={`@your${card.platform === "x" ? "handle" : "username"}`}
                spellCheck={false}
                className="field sm:max-w-sm"
              />
              <button
                type="button"
                onClick={() => begin(card.platform)}
                disabled={busy || !handleFor(card.platform)}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {busy && active ? "Checking…" : "Continue"}
              </button>
            </div>

            {active && error && (
              <p className="mt-3 rounded-xl border border-[#6b2b2b] bg-[#2a1414] px-3.5 py-2.5 text-sm text-[#ff9d9d]">
                {error}
              </p>
            )}

            {active && start?.route === "pump.fun" && (
              <div className="mt-4 rounded-xl border border-[#3f5410] bg-[#1a2408] p-4">
                <p className="text-sm leading-relaxed text-[var(--color-money)]">{start.message}</p>
                <a
                  href="https://pump.fun"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-money mt-3 inline-block px-5 py-2.5 text-sm"
                >
                  Claim on pump.fun
                </a>
              </div>
            )}

            {active && start?.route === "launchpad" && start.code && (
              <div className="mt-4 grid gap-4 rounded-xl border border-[var(--color-line)] bg-[#0f0f15] p-4">
                <div>
                  <span className="eyebrow">Step 1 — prove it&apos;s you</span>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                    {start.instructions} Remove it once you have claimed.
                  </p>
                </div>

                <div className="rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[#0a0a0e] px-4 py-3 text-center font-mono text-lg tracking-wide text-[var(--color-accent)]">
                  {start.code}
                </div>

                <div>
                  <span className="eyebrow">Step 2 — claim</span>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                    Connect the wallet you want paid. It covers the network fee
                    and receives the whole escrow balance.
                  </p>
                </div>

                {status && (
                  <p className="rounded-lg border border-[var(--color-line)] bg-[#12121a] px-3 py-2 text-sm text-[var(--color-muted)]">
                    {status}
                  </p>
                )}

                <button
                  type="button"
                  onClick={claim}
                  disabled={busy || !connected}
                  className="btn-money px-6 py-3 text-sm"
                >
                  {!connected ? "Connect a wallet first" : busy ? "Working…" : "Verify and claim"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      <p className="px-1 text-xs leading-relaxed text-[var(--color-faint)]">
        {PLATFORM_LABELS.x} handles reach the non-custodial vault only when this
        deployment has an X API token configured; without one they fall back to
        the same code flow as everyone else.
      </p>
    </div>
  );
}
