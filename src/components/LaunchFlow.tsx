"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

import { base64ToBytes } from "@/lib/base64";
import type { EscrowKind, Platform, SocialProfile } from "@/lib/social/types";
import { Avatar, Badge, EscrowBadge, PLATFORM_GLYPH } from "@/components/ui";

interface EscrowPreview {
  kind: EscrowKind;
  pubkey: string;
  custodyNote: string;
  claimRoute: "pump.fun" | "launchpad";
  available: boolean;
  reason?: string;
}

interface PreparedLaunch {
  transaction: string;
  mint: string;
  metadataUri: string;
  imageUri: string | null;
  escrowPubkey: string;
  escrowKind: EscrowKind;
  blockhash: string;
  lastValidBlockHeight: number;
  platformFeeLamports: number;
}

type Phase = "idle" | "resolving" | "ready" | "launching" | "done";

const PLATFORM_HINTS: { value: Platform; label: string }[] = [
  { value: "x", label: "X" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
];

export function LaunchFlow() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [input, setInput] = useState("");
  const [hint, setHint] = useState<Platform>("x");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [escrow, setEscrow] = useState<EscrowPreview | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [devBuySol, setDevBuySol] = useState("0");
  const [result, setResult] = useState<{ mint: string; signature: string } | null>(null);

  const devBuy = Number.parseFloat(devBuySol) || 0;
  const canLaunch =
    phase === "ready" &&
    connected &&
    !!profile &&
    !!escrow?.available &&
    name.trim().length > 0 &&
    /^[A-Za-z0-9]{1,10}$/.test(symbol.trim());

  const resolve = useCallback(async () => {
    if (!input.trim()) return;
    setPhase("resolving");
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, platform: hint }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not resolve that profile.");

      const found = body.profile as SocialProfile;
      setProfile(found);
      setEscrow(body.escrow as EscrowPreview);
      setName(found.displayName ?? found.handle);
      setSymbol(defaultTicker(found.handle));
      setDescription("");
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve that profile.");
      setPhase("idle");
    }
  }, [input, hint]);

  const launch = useCallback(async () => {
    if (!profile || !publicKey || !signTransaction) return;

    setPhase("launching");
    setError(null);

    try {
      setStatus("Uploading metadata and building the transaction…");
      const prepRes = await fetch("/api/launch/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: profile.platform,
          handle: profile.handle,
          payer: publicKey.toBase58(),
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          description: description.trim(),
          devBuySol: devBuy,
        }),
      });
      const prepared = (await prepRes.json()) as PreparedLaunch & { error?: string };
      if (!prepRes.ok) throw new Error(prepared.error ?? "Could not build the launch.");

      setStatus("Waiting for you to approve in your wallet…");
      const tx = VersionedTransaction.deserialize(base64ToBytes(prepared.transaction));
      const signed = await signTransaction(tx);

      setStatus("Sending to Solana…");
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        maxRetries: 3,
      });

      setStatus("Confirming…");
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: prepared.blockhash,
          lastValidBlockHeight: prepared.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error("The launch transaction failed on-chain.");
      }

      setStatus("Indexing…");
      await fetch("/api/launch/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signature,
          mint: prepared.mint,
          platform: profile.platform,
          handle: profile.handle,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          description: description.trim(),
          metadataUri: prepared.metadataUri,
          imageUrl: prepared.imageUri ?? profile.avatarUrl,
          launcher: publicKey.toBase58(),
          devBuyLamports: Math.round(devBuy * 1_000_000_000),
        }),
      });

      setResult({ mint: prepared.mint, signature });
      setStatus(null);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The launch failed.");
      setStatus(null);
      setPhase("ready");
    }
  }, [profile, publicKey, signTransaction, connection, name, symbol, description, devBuy]);

  if (phase === "done" && result && profile) {
    return <LaunchSuccess profile={profile} {...result} />;
  }

  return (
    <div className="grid gap-4">
      <div className="card p-5">
        <label htmlFor="profile" className="text-sm font-medium">
          Paste a creator&apos;s profile
        </label>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          An X, Instagram, or TikTok profile link — or a handle, with the platform picked below.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            id="profile"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && resolve()}
            placeholder="https://x.com/mrbeast"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[#0b0c12] px-4 py-3 text-sm outline-none transition placeholder:text-[#5a5e70] focus:border-[var(--color-accent-2)]"
          />
          <button
            type="button"
            onClick={resolve}
            disabled={phase === "resolving" || !input.trim()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e6e8f0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "resolving" ? "Looking up…" : "Find creator"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PLATFORM_HINTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setHint(option.value)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                hint === option.value
                  ? "border-[var(--color-accent-2)] bg-[#182042] text-white"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-white"
              }`}
            >
              {PLATFORM_GLYPH[option.value]} {option.label}
            </button>
          ))}
        </div>

        {error && phase !== "launching" && (
          <p className="mt-3 rounded-lg border border-[#6b2b2b] bg-[#2a1414] px-3 py-2 text-sm text-[#ff9d9d]">
            {error}
          </p>
        )}
      </div>

      {profile && escrow && phase !== "resolving" && (
        <>
          <CreatorPreview profile={profile} escrow={escrow} />

          <div className="card grid gap-4 p-5">
            <h2 className="text-sm font-semibold">Coin details</h2>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 32))}
                  className={inputClass}
                />
              </Field>
              <Field label="Ticker">
                <input
                  value={symbol}
                  onChange={(event) =>
                    setSymbol(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10))
                  }
                  className={`${inputClass} font-mono uppercase`}
                />
              </Field>
            </div>

            <Field label="Description" hint="Optional — we write one for you if blank.">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 500))}
                rows={3}
                className={`${inputClass} resize-y`}
              />
            </Field>

            <Field
              label="Your opening buy (SOL)"
              hint="Optional. Buys into the curve in the same transaction, at launch price."
            >
              <input
                value={devBuySol}
                inputMode="decimal"
                onChange={(event) =>
                  setDevBuySol(event.target.value.replace(/[^0-9.]/g, "").slice(0, 8))
                }
                className={`${inputClass} font-mono`}
              />
            </Field>

            {!escrow.available && (
              <p className="rounded-lg border border-[#6b5326] bg-[#2a2013] px-3 py-2 text-sm text-[var(--color-warn)]">
                {escrow.reason}
              </p>
            )}

            {error && (
              <p className="rounded-lg border border-[#6b2b2b] bg-[#2a1414] px-3 py-2 text-sm text-[#ff9d9d]">
                {error}
              </p>
            )}

            {status && (
              <p className="rounded-lg border border-[var(--color-line)] bg-[#12141d] px-3 py-2 text-sm text-[var(--color-muted)]">
                {status}
              </p>
            )}

            <button
              type="button"
              onClick={launch}
              disabled={!canLaunch}
              className="rounded-xl bg-gradient-to-b from-[var(--color-accent)] to-[#46c98a] px-5 py-3.5 text-sm font-bold text-[#06210f] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === "launching"
                ? "Launching…"
                : connected
                  ? `Launch $${symbol.toUpperCase() || "COIN"}`
                  : "Connect a wallet to launch"}
            </button>

            <p className="text-center text-xs text-[var(--color-muted)]">
              You pay network fees{devBuy > 0 ? ` and your ${devBuy} SOL opening buy` : ""}.
              Creator fees never come to you.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--color-line)] bg-[#0b0c12] px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#5a5e70] focus:border-[var(--color-accent-2)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-[var(--color-muted)]">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[#6b6f82]">{hint}</span>}
    </label>
  );
}

function CreatorPreview({
  profile,
  escrow,
}: {
  profile: SocialProfile;
  escrow: EscrowPreview;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-4 p-5">
      <Avatar src={profile.avatarUrl} alt={profile.handle} size={60} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {profile.displayName ?? `@${profile.handle}`}
          </span>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            {PLATFORM_GLYPH[profile.platform]} @{profile.handle}
          </a>
          {!profile.verifiedUpstream && <Badge tone="warn">Unverified lookup</Badge>}
        </div>

        {profile.followers != null && (
          <div className="mt-1 text-sm text-[var(--color-muted)]">
            {profile.followers.toLocaleString()} followers
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <EscrowBadge kind={escrow.kind} />
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
          {escrow.available ? escrow.custodyNote : escrow.reason}
        </p>
      </div>
    </div>
  );
}

function LaunchSuccess({
  profile,
  mint,
  signature,
}: {
  profile: SocialProfile;
  mint: string;
  signature: string;
}) {
  return (
    <div className="card grid gap-4 p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#12291f] text-2xl">
        ✦
      </div>
      <h2 className="text-xl font-semibold">
        Launched for @{profile.handle}
      </h2>
      <p className="mx-auto max-w-md text-sm text-[var(--color-muted)]">
        Every trade from here on pays creator fees into their escrow. Send them
        the link — they can claim whenever they want.
      </p>

      <div className="mx-auto w-full max-w-md break-all rounded-lg border border-[var(--color-line)] bg-[#0b0c12] px-3 py-2 font-mono text-xs text-[var(--color-muted)]">
        {mint}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href={`/coin/${mint}`}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
        >
          View coin page
        </Link>
        <a
          href={`https://pump.fun/coin/${mint}`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold"
        >
          Trade on pump.fun
        </a>
        <a
          href={`https://solscan.io/tx/${signature}`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-muted)]"
        >
          Transaction
        </a>
      </div>
    </div>
  );
}

/** Tickers are uppercase alphanumerics; handles often are not. */
function defaultTicker(handle: string): string {
  const cleaned = handle.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 10) || "COIN";
}
