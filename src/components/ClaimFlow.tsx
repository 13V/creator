"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

import { base64ToBytes } from "@/lib/base64";
import { isPlatform, PLATFORM_LABELS, PLATFORMS, type Platform } from "@/lib/social/types";
import { lamportsToSol } from "@/components/ui";

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
    escrow: string;
    blockhash: string;
    lastValidBlockHeight: number;
  };
  error?: string;
}

export function ClaimFlow() {
  const search = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [handle, setHandle] = useState("");
  const [start, setStart] = useState<StartResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ signature: string; lamports: number } | null>(null);

  // Deep link from a creator page: /claim?platform=tiktok&handle=khaby.lame
  useEffect(() => {
    const p = search.get("platform");
    const h = search.get("handle");
    if (p && isPlatform(p)) setPlatform(p);
    if (h) setHandle(h);
  }, [search]);

  const beginVerification = useCallback(async () => {
    if (!handle.trim()) return;
    setBusy(true);
    setError(null);
    setPaid(null);

    try {
      const res = await fetch("/api/claim/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, handle: handle.trim().replace(/^@+/, "") }),
      });
      const body = (await res.json()) as StartResponse;
      if (!res.ok) throw new Error(body.error ?? "Could not start verification.");
      setStart(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification.");
    } finally {
      setBusy(false);
    }
  }, [platform, handle]);

  const verifyAndClaim = useCallback(async () => {
    if (!publicKey || !signTransaction) return;
    setBusy(true);
    setError(null);

    try {
      setStatus("Checking your profile for the code…");
      const res = await fetch("/api/claim/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform,
          handle: handle.trim().replace(/^@+/, ""),
          wallet: publicKey.toBase58(),
        }),
      });
      const body = (await res.json()) as PayoutResponse;
      if (!res.ok) throw new Error(body.error ?? "Verification failed.");

      setStatus("Verified. Approve the payout in your wallet…");
      const tx = VersionedTransaction.deserialize(base64ToBytes(body.payout.transaction));
      const signed = await signTransaction(tx);

      setStatus("Sending…");
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        maxRetries: 3,
      });
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
          platform,
          handle: handle.trim().replace(/^@+/, ""),
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
  }, [platform, handle, publicKey, signTransaction, connection]);

  if (paid) {
    return (
      <div className="card grid gap-3 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#12291f] text-2xl">
          ✦
        </div>
        <h2 className="text-xl font-semibold">
          {lamportsToSol(paid.lamports)} SOL sent to your wallet
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          Fees keep accruing as people trade. Come back and claim again any time.
        </p>
        <a
          href={`https://solscan.io/tx/${paid.signature}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mx-auto mt-1 text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
        >
          View transaction
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="card grid gap-4 p-5">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Platform</span>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setPlatform(option);
                  setStart(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  platform === option
                    ? "border-[var(--color-accent-2)] bg-[#182042] text-white"
                    : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-white"
                }`}
              >
                {PLATFORM_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Your handle</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={handle}
              onChange={(event) => {
                setHandle(event.target.value);
                setStart(null);
              }}
              placeholder="yourhandle"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[#0b0c12] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent-2)]"
            />
            <button
              type="button"
              onClick={beginVerification}
              disabled={busy || !handle.trim()}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy && !start ? "Checking…" : "Start"}
            </button>
          </div>
        </label>

        {error && (
          <p className="rounded-lg border border-[#6b2b2b] bg-[#2a1414] px-3 py-2 text-sm text-[#ff9d9d]">
            {error}
          </p>
        )}
      </div>

      {start?.route === "pump.fun" && (
        <div className="card grid gap-3 p-5">
          <h2 className="text-sm font-semibold">Your fees are already non-custodial</h2>
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">{start.message}</p>
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noreferrer noopener"
            className="w-fit rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
          >
            Go to pump.fun
          </a>
        </div>
      )}

      {start?.route === "launchpad" && start.code && (
        <div className="card grid gap-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Step 1 — prove it&apos;s you</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
              {start.instructions} You can remove it once you have claimed.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-[#3a3d52] bg-[#0b0c12] px-4 py-3 text-center font-mono text-lg tracking-wide text-[var(--color-accent)]">
            {start.code}
          </div>

          <div>
            <h2 className="text-sm font-semibold">Step 2 — claim</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
              Connect the wallet you want paid to. It pays the network fee and
              receives the full escrow balance.
            </p>
          </div>

          {status && (
            <p className="rounded-lg border border-[var(--color-line)] bg-[#12141d] px-3 py-2 text-sm text-[var(--color-muted)]">
              {status}
            </p>
          )}

          <button
            type="button"
            onClick={verifyAndClaim}
            disabled={busy || !connected}
            className="rounded-xl bg-gradient-to-b from-[var(--color-accent)] to-[#46c98a] px-5 py-3.5 text-sm font-bold text-[#06210f] disabled:opacity-40"
          >
            {!connected ? "Connect a wallet first" : busy ? "Working…" : "Verify and claim"}
          </button>
        </div>
      )}
    </div>
  );
}
