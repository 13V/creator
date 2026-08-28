"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

import { CheckIcon } from "@/components/icons";
import { ImagePicker } from "@/components/ImagePicker";
import { Avatar, Badge, EscrowBadge, PlatformMark } from "@/components/ui";
import { base64ToBytes } from "@/lib/base64";
import { formatShare } from "@/lib/pump/feeShare";
import { PLATFORM_LABELS, type EscrowKind, type Platform, type SocialProfile } from "@/lib/social/types";

interface EscrowPreview {
  kind: EscrowKind;
  pubkey: string;
  custodyNote: string;
  available: boolean;
  reason?: string;
  /**
   * Read from the resolve response rather than hardcoded: a pump.fun social
   * vault cannot carry a sharing config, so those coins pay the creator 100%
   * while managed ones are split.
   */
  creatorShareBps: number;
  platformShareBps: number;
}

interface Prepared {
  transaction: string;
  deferredBuyLamports: number;
  mint: string;
  metadataUri: string;
  imageUri: string | null;
  escrowPubkey: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

const QUICK_BUYS = ["0.1", "0.5", "1"];
/** Default first, so the selected chip is not stranded at the end of the row. */
const PLATFORM_ORDER: Platform[] = ["x", "reddit", "instagram", "tiktok"];
const NAME_MAX = 32;
const TICKER_MAX = 13;

export function LaunchForm({
  initialHandle,
  initialPlatform,
}: {
  /* Handed over by the rail's launcher through the URL, so arriving here does
     not mean typing the same handle a second time. */
  initialHandle?: string;
  initialPlatform?: Platform;
} = {}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [platform, setPlatform] = useState<Platform>(initialPlatform ?? "x");
  const [handle, setHandle] = useState(initialHandle ?? "");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [escrow, setEscrow] = useState<EscrowPreview | null>(null);
  const [looking, setLooking] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [buy, setBuy] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ mint: string; signature: string; handle: string } | null>(null);

  // Track whether the launcher has typed their own name/ticker, so resolving a
  // creator can prefill them without ever overwriting deliberate input.
  const touched = useRef({ name: false, ticker: false });

  const cleanHandle = handle.trim().replace(/^@+/, "");

  // Look the creator up as they type. Debounced because it hits three
  // different upstreams, all of which rate limit.
  useEffect(() => {
    if (!cleanHandle) {
      setProfile(null);
      setEscrow(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLooking(true);
      try {
        const res = await fetch("/api/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: cleanHandle, platform }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);

        const found = body.profile as SocialProfile;
        setProfile(found);
        setEscrow(body.escrow as EscrowPreview);
        if (!touched.current.name) setName((found.displayName ?? found.handle).slice(0, NAME_MAX));
        if (!touched.current.ticker) setTicker(defaultTicker(found.handle));
      } catch {
        setProfile(null);
        setEscrow(null);
      } finally {
        setLooking(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [cleanHandle, platform]);

  const ready =
    connected &&
    !!profile &&
    !!escrow?.available &&
    name.trim().length > 0 &&
    /^[A-Za-z0-9]{1,13}$/.test(ticker.trim());

  const launch = useCallback(async () => {
    if (!profile || !publicKey || !signTransaction) return;
    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("platform", profile.platform);
      form.set("handle", profile.handle);
      form.set("payer", publicKey.toBase58());
      form.set("name", name.trim());
      form.set("symbol", ticker.trim().toUpperCase());
      form.set("description", description.trim());
      form.set("twitter", twitter.trim());
      form.set("telegram", telegram.trim());
      form.set("website", website.trim());
      form.set("devBuySol", String(Number.parseFloat(buy) || 0));
      if (file) form.set("image", file);

      setStatus("Pinning artwork and building the transaction…");
      const res = await fetch("/api/launch/prepare", { method: "POST", body: form });
      const prepared = (await res.json()) as Prepared & { error?: string };
      if (!res.ok) throw new Error(prepared.error ?? "Could not build the launch.");

      setStatus("Approve it in your wallet…");
      const tx = VersionedTransaction.deserialize(base64ToBytes(prepared.transaction));
      const signed = await signTransaction(tx);

      setStatus("Sending to Solana…");
      const signature = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });

      setStatus("Confirming…");
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: prepared.blockhash,
          lastValidBlockHeight: prepared.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) throw new Error("The launch failed on-chain.");

      /*
       * The opening buy, when it could not share a transaction with the create.
       * It goes through the ordinary trade endpoint, which quotes against the
       * bonding curve that now exists rather than a predicted one.
       */
      if (prepared.deferredBuyLamports > 0) {
        setStatus("Approve your opening buy…");
        const buyRes = await fetch("/api/trade/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mint: prepared.mint,
            wallet: publicKey.toBase58(),
            side: "buy",
            solAmount: prepared.deferredBuyLamports / 1_000_000_000,
            slippageBps: 500,
          }),
        });
        const buyPrepared = (await buyRes.json()) as {
          transaction?: string;
          blockhash?: string;
          lastValidBlockHeight?: number;
          error?: string;
        };

        if (!buyRes.ok || !buyPrepared.transaction) {
          // The coin is live either way, so this is a warning rather than a
          // failed launch — the user can buy from the coin page.
          setError(
            `The coin launched, but the opening buy did not: ${
              buyPrepared.error ?? "could not build it"
            }. Buy from the coin page instead.`,
          );
        } else {
          const buyTx = VersionedTransaction.deserialize(
            base64ToBytes(buyPrepared.transaction),
          );
          const signedBuy = await signTransaction(buyTx);
          const buySig = await connection.sendRawTransaction(signedBuy.serialize(), {
            maxRetries: 3,
          });
          await connection.confirmTransaction(
            {
              signature: buySig,
              blockhash: buyPrepared.blockhash!,
              lastValidBlockHeight: buyPrepared.lastValidBlockHeight!,
            },
            "confirmed",
          );
        }
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
          symbol: ticker.trim().toUpperCase(),
          description: description.trim(),
          metadataUri: prepared.metadataUri,
          imageUrl: prepared.imageUri ?? profile.avatarUrl,
          launcher: publicKey.toBase58(),
          devBuyLamports: Math.round((Number.parseFloat(buy) || 0) * 1_000_000_000),
        }),
      });

      setDone({ mint: prepared.mint, signature, handle: profile.handle });
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The launch failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [profile, publicKey, signTransaction, connection, name, ticker, description, twitter, telegram, website, buy, file]);

  if (done) return <Success {...done} />;

  return (
    <div className="grid grid-cols-1 gap-7">
      <header>
        <h1 className="display text-[clamp(2.1rem,1.5rem+2vw,3rem)]">
          Launch a coin.
          <br />
          <em>Whoever you name gets the fees.</em>
        </h1>
        <p className="mt-3.5 max-w-[33rem] text-[15px] leading-[1.62] text-[var(--color-muted)] [text-wrap:pretty]">
          It goes live on pump.fun immediately. The creator you name earns fees
          on every trade, and only they can withdraw them.
        </p>
      </header>

      <section className="grid gap-5 sm:grid-cols-[188px_minmax(0,1fr)]">
        <div className="grid grid-cols-1 max-w-[190px] gap-2">
          <Label>Image</Label>
          <ImagePicker
            file={file}
            fallbackUrl={profile?.avatarUrl}
            onChange={(next, problem) => {
              setFile(next);
              if (problem) setError(problem);
            }}
          />
        </div>

        <div className="grid grid-cols-1 content-start gap-4">
          <Labeled label="Name" counter={`${name.length}/${NAME_MAX}`}>
            <input
              value={name}
              placeholder="Charli's Coin"
              onChange={(e) => {
                touched.current.name = true;
                setName(e.target.value.slice(0, NAME_MAX));
              }}
              className="field"
            />
          </Labeled>

          <Labeled label="Ticker" counter={`${ticker.length}/${TICKER_MAX}`}>
            <input
              value={ticker}
              placeholder="CHARLI"
              onChange={(e) => {
                touched.current.ticker = true;
                setTicker(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, TICKER_MAX));
              }}
              className="field font-mono uppercase"
            />
          </Labeled>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label>Who gets the fees?</Label>
          <span className="text-[11px] text-[var(--color-faint)]">
            Just their handle. No account needed.
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPlatform(option)}
              className={`rounded border px-3 py-1.5 text-xs font-semibold transition ${
                platform === option
                  ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent-deep)]"
                  : "border-[var(--color-line)] bg-[var(--color-panel-2)] text-[var(--color-muted)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-fg)]"
              }`}
            >
              {PLATFORM_LABELS[option]}
            </button>
          ))}
        </div>

        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@charlidamelio"
          spellCheck={false}
          className="field"
        />

        {cleanHandle && <CreatorPreview profile={profile} escrow={escrow} looking={looking} />}
      </section>

      <section className="grid grid-cols-1 gap-2">
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Optional — we write one from the creator's profile if you leave this blank."
          className="field resize-y"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Labeled label="Twitter"><input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" className="field" /></Labeled>
        <Labeled label="Telegram"><input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" className="field" /></Labeled>
        <Labeled label="Website"><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className="field" /></Labeled>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label>Your opening buy</Label>
          <span className="text-[11px] text-[var(--color-faint)]">
            Optional — SOL, bought at launch price before anyone else
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={buy}
            inputMode="decimal"
            onChange={(e) => setBuy(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))}
            placeholder="0.0"
            className="field tnum max-w-[190px] font-mono"
          />
          {QUICK_BUYS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setBuy(amount)}
              className={`tnum rounded-full border px-3.5 py-2 font-mono text-xs transition ${
                buy === amount
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-deep)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-fg)]"
              }`}
            >
              {amount}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-[var(--color-down-line)] bg-[var(--color-down-soft)] px-3.5 py-2.5 text-sm text-[var(--color-down)]">
          {error}
        </p>
      )}
      {status && (
        <p className="rounded-xl border border-[var(--glass-edge)] bg-[var(--wash-soft)] px-3.5 py-2.5 text-sm text-[var(--color-muted)]">
          {status}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={launch}
          disabled={!ready || busy}
          className="btn-primary px-7 py-3.5 text-sm"
        >
          {busy ? "Launching…" : connected ? "Launch it" : "Connect a wallet"}
        </button>
        <span className="text-xs text-[var(--color-faint)]">
          You cover the network fee and your opening buy. That is all you pay.
        </span>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

function Labeled({
  label,
  counter,
  children,
}: {
  label: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid grid-cols-1 gap-2">
      <span className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {counter && <span className="tnum font-mono text-[10px] text-[var(--color-faint)]">{counter}</span>}
      </span>
      {children}
    </label>
  );
}

function CreatorPreview({
  profile,
  escrow,
  looking,
}: {
  profile: SocialProfile | null;
  escrow: EscrowPreview | null;
  looking: boolean;
}) {
  if (looking && !profile) {
    return <div className="h-[76px] animate-pulse rounded-2xl border border-[var(--glass-edge)] bg-[var(--wash-soft)]" />;
  }
  if (!profile || !escrow) {
    return (
      <p className="rounded-xl border border-[var(--glass-edge)] bg-[var(--wash-soft)] px-3.5 py-2.5 text-xs text-[var(--color-muted)]">
        No profile found for that handle yet.
      </p>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-3.5 p-3.5">
      <Avatar src={profile.avatarUrl} alt={profile.handle} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {profile.displayName ?? `@${profile.handle}`}
          </span>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            <PlatformMark platform={profile.platform} /> @{profile.handle}
          </a>
          {!profile.verifiedUpstream && <Badge>Unverified lookup</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <EscrowBadge kind={escrow.kind} compact />
          {escrow.available && (
            <Badge tone="money">
              {formatShare(escrow.creatorShareBps)} of fees to @{profile.handle}
            </Badge>
          )}
          <span className="text-[11px] text-[var(--color-faint)]">
            {escrow.available ? escrow.custodyNote : escrow.reason}
          </span>
        </div>
      </div>
    </div>
  );
}

function Success({ mint, signature, handle }: { mint: string; signature: string; handle: string }) {
  return (
    <div className="card grid grid-cols-1 gap-4 p-9 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent-deep)]">
        <CheckIcon />
      </div>
      <h2 className="display text-3xl">Live for @{handle}</h2>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
        Send @{handle} the link. That is how they will know to claim it.
      </p>

      <div className="mx-auto w-full max-w-md break-all rounded-xl border border-[var(--glass-edge)] bg-[var(--wash-soft)] px-3 py-2 font-mono text-xs text-[var(--color-muted)]">
        {mint}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Link href={`/coin/${mint}`} className="btn-primary px-5 py-2.5 text-sm">
          View coin
        </Link>
        <a href={`https://pump.fun/coin/${mint}`} target="_blank" rel="noreferrer noopener"
           className="rounded-full border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-semibold">
          Trade on pump.fun
        </a>
        <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer noopener"
           className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm text-[var(--color-muted)]">
          Transaction
        </a>
      </div>
    </div>
  );
}

function defaultTicker(handle: string): string {
  return handle.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, TICKER_MAX) || "COIN";
}
