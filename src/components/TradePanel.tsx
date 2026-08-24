"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from "@solana/web3.js";

import { base64ToBytes } from "@/lib/base64";
import { formatSol } from "@/components/ui";

type Side = "buy" | "sell";

const PRESETS = [0.25, 0.5, 0.75, 1];
const SLIPPAGE_CHOICES = [50, 100, 300, 500];

interface Balances {
  sol: number;
  tokens: number;
  decimals: number;
}

/**
 * Market buy and sell against the bonding curve.
 *
 * Quoting and instruction building happen server-side so the browser never
 * needs the pump SDK; the wallet only signs. Graduated coins are refused by the
 * endpoint rather than silently failing on-chain.
 */
export function TradePanel({
  mint,
  symbol,
  graduated,
}: {
  mint: string;
  symbol: string;
  graduated: boolean;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippage] = useState(100);
  const [showSlippage, setShowSlippage] = useState(false);
  const [balances, setBalances] = useState<Balances>({ sol: 0, tokens: 0, decimals: 6 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) return setBalances({ sol: 0, tokens: 0, decimals: 6 });
    try {
      const [lamports, accounts] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(mint) }),
      ]);
      const info = accounts.value[0]?.account.data.parsed.info.tokenAmount;
      setBalances({
        sol: lamports / LAMPORTS_PER_SOL,
        tokens: info ? Number(info.uiAmount ?? 0) : 0,
        decimals: info ? Number(info.decimals ?? 6) : 6,
      });
    } catch {
      // A missing token account just means a zero balance.
    }
  }, [connection, publicKey, mint]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const max = side === "buy" ? Math.max(0, balances.sol - 0.02) : balances.tokens;

  const submit = useCallback(async () => {
    if (!publicKey || !signTransaction) return;
    const value = Number.parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount.");

    setBusy(true);
    setError(null);
    try {
      setStatus("Quoting…");
      const body =
        side === "buy"
          ? { mint, wallet: publicKey.toBase58(), side, solAmount: value, slippageBps }
          : {
              mint,
              wallet: publicKey.toBase58(),
              side,
              tokenAmount: BigInt(
                Math.floor(value * 10 ** balances.decimals),
              ).toString(),
              slippageBps,
            };

      const res = await fetch("/api/trade/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const quote = await res.json();
      if (!res.ok) throw new Error(quote.error ?? "Could not build the trade.");

      setStatus("Approve in your wallet…");
      const tx = VersionedTransaction.deserialize(base64ToBytes(quote.transaction));
      const signed = await signTransaction(tx);

      setStatus("Sending…");
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: quote.blockhash,
          lastValidBlockHeight: quote.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) throw new Error("The trade failed on-chain.");

      setStatus(
        side === "buy"
          ? `Bought ${symbol}. ${formatSol(Number(quote.quotedLamports))} SOL spent.`
          : `Sold ${symbol} for about ${formatSol(Number(quote.quotedLamports))} SOL.`,
      );
      setAmount("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The trade failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [publicKey, signTransaction, amount, side, mint, slippageBps, balances.decimals, connection, symbol, refresh]);

  if (graduated) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold">This coin has graduated</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Its bonding curve filled and liquidity migrated, so trades no longer go
          through the curve.
        </p>
        <a
          href={`https://pump.fun/coin/${mint}`}
          target="_blank"
          rel="noreferrer noopener"
          className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm"
        >
          Trade on pump.fun
        </a>
      </div>
    );
  }

  return (
    <div className="card grid min-w-0 gap-3.5 p-4">
      <div className="segmented w-full">
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            type="button"
            data-active={side === option}
            onClick={() => {
              setSide(option);
              setAmount("");
              setError(null);
            }}
            className="segment flex-1 text-center capitalize"
          >
            {option}
          </button>
        ))}
      </div>

      <div className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[#0c0c11] p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[var(--color-muted)]">
            {side === "buy" ? "You spend" : "You sell"}
          </span>
          <span className="tnum text-[11px] text-[var(--color-faint)]">
            {side === "buy"
              ? `${balances.sol.toFixed(4)} SOL`
              : `${balances.tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`}
          </span>
        </div>

        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <input
            value={amount}
            inputMode="decimal"
            placeholder="0.0"
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            size={1}
            className="tnum w-full min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-[#33333f]"
          />
          <span className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1.5 font-mono text-xs">
            {side === "buy" ? "SOL" : `$${symbol}`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((fraction) => (
          <button
            key={fraction}
            type="button"
            disabled={!connected || max <= 0}
            onClick={() => setAmount(String(+(max * fraction).toFixed(side === "buy" ? 4 : 2)))}
            className="rounded-lg border border-[var(--color-line)] py-2 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-fg)] disabled:opacity-40"
          >
            {fraction === 1 ? "Max" : `${fraction * 100}%`}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-muted)]">Slippage</span>
        <button
          type="button"
          onClick={() => setShowSlippage((open) => !open)}
          className="tnum rounded-full border border-[var(--color-line)] px-3 py-1.5 font-mono transition hover:border-[var(--color-line-strong)]"
        >
          {slippageBps / 100}% · adjust
        </button>
      </div>

      {showSlippage && (
        <div className="grid grid-cols-4 gap-2">
          {SLIPPAGE_CHOICES.map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => setSlippage(bps)}
              data-active={slippageBps === bps}
              className="segment rounded-lg border border-[var(--color-line)] text-center"
            >
              {bps / 100}%
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-[#6b2b2b] bg-[#2a1414] px-3 py-2 text-xs text-[#ff9d9d]">
          {error}
        </p>
      )}
      {status && !error && (
        <p className="rounded-lg border border-[var(--color-line)] bg-[#12121a] px-3 py-2 text-xs text-[var(--color-muted)]">
          {status}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!connected || busy || !amount}
        className="btn-primary py-3.5 text-sm"
      >
        {!connected
          ? "Connect a wallet"
          : busy
            ? "Working…"
            : side === "buy"
              ? `Buy $${symbol}`
              : `Sell $${symbol}`}
      </button>
    </div>
  );
}
