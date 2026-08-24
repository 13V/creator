import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

import { CoinMedia } from "@/components/CoinMedia";
import { ShareButton } from "@/components/ShareButton";
import { TradePanel } from "@/components/TradePanel";
import {
  Avatar,
  EscrowBadge,
  PLATFORM_GLYPH,
  formatSol,
  shortAddress,
  timeAgo,
} from "@/components/ui";
import { pumpFunUrl, solscanUrl } from "@/lib/pump/coin";
import { getFeeSnapshot } from "@/lib/pump/fees";
import { getTopHolders } from "@/lib/pump/holders";
import { getMarketData } from "@/lib/pump/market";
import { getCoin } from "@/lib/repo";
import { profileUrl } from "@/lib/social/parse";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const coin = getCoin(mint);
  if (!coin) return { title: "Coin not found" };
  return {
    title: `${coin.name} ($${coin.symbol})`,
    description:
      `A creator coin for @${coin.handle}. Every trade pays creator fees into ` +
      "an escrow only they can claim.",
  };
}

export default async function CoinPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const coin = getCoin(mint);
  if (!coin) notFound();

  // Each read degrades on its own, so a flaky RPC costs a panel not the page.
  const [fees, market, holders] = await Promise.all([
    getFeeSnapshot(new PublicKey(coin.escrow_pubkey)).catch(() => null),
    getMarketData([coin.mint]).catch(() => null),
    getTopHolders(coin.mint, 8).catch(() => null),
  ]);

  const stats = market?.get(coin.mint) ?? null;
  const percent = Math.round((stats?.progress ?? 0) * 100);
  const creatorHref = `/creator/${coin.platform}/${encodeURIComponent(coin.handle)}`;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
      <div className="grid min-w-0 gap-5">
        <div className="card grid gap-4 p-5">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              <CoinMedia src={coin.image_url} alt={coin.name} symbol={coin.symbol} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold tracking-tight">{coin.name}</h1>
              <div className="font-mono text-sm text-[var(--color-muted)]">${coin.symbol}</div>
            </div>
            <EscrowBadge kind={coin.escrow_kind} compact />
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-line)] bg-[#0c0c11] p-3">
            <Link href={creatorHref}>
              <Avatar src={coin.avatar_url} alt={coin.handle} size={32} />
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <Link href={creatorHref} className="block truncate text-sm font-semibold hover:underline">
                {coin.display_name ?? `@${coin.handle}`}
              </Link>
              <span className="text-xs text-[var(--color-muted)]">
                {PLATFORM_GLYPH[coin.platform]} @{coin.handle} · launched {timeAgo(coin.created_at)} ago
              </span>
            </div>
            <div className="shrink-0 text-right">
              <div className="tnum font-mono text-sm font-bold text-[var(--color-accent)]">
                {fees ? formatSol(fees.totalLamports) : "—"} SOL
              </div>
              <div className="text-[10px] text-[var(--color-faint)]">waiting for them</div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#c9c9d6]">
            {coin.description || "No description yet."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Chip href={profileUrl(coin.platform, coin.handle)}>
              {PLATFORM_GLYPH[coin.platform]} Profile
            </Chip>
            <Chip href={pumpFunUrl(coin.mint)}>pump.fun</Chip>
            <Chip href={solscanUrl("account", coin.mint)}>
              Contract {shortAddress(coin.mint)}
            </Chip>
            <Chip href={solscanUrl("account", coin.escrow_pubkey)}>
              Escrow {shortAddress(coin.escrow_pubkey)}
            </Chip>
            <Chip href={solscanUrl("tx", coin.signature)}>Launch tx</Chip>
            <ShareButton path={`/coin/${coin.mint}`} title={`${coin.name} ($${coin.symbol})`} />
          </div>
        </div>

        <div className="card grid grid-cols-2 gap-px overflow-hidden bg-[var(--color-line)] p-0 sm:grid-cols-4">
          <Metric
            label="Market cap"
            value={
              stats?.marketCapLamports == null
                ? stats?.graduated
                  ? "On AMM"
                  : "—"
                : `${formatSol(stats.marketCapLamports)} SOL`
            }
          />
          <Metric
            label="Liquidity"
            value={stats ? `${formatSol(stats.liquidityLamports)} SOL` : "—"}
          />
          <Metric
            label="Creator fees"
            value={fees ? `${formatSol(fees.totalLamports)} SOL` : "—"}
            accent
          />
          <Metric label={stats?.graduated ? "Migrated" : "To graduation"} value={`${percent}%`} />
        </div>

        {!stats?.graduated && (
          <div className="card p-4">
            <div className="curve-track">
              <div className="curve-fill" style={{ width: `${Math.max(percent, 1.5)}%` }} />
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              When the curve fills, liquidity migrates and the coin trades on the
              AMM. Creator fees keep accruing either way.
            </p>
          </div>
        )}

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <h2 className="text-sm font-semibold">Top holders</h2>
            <span className="count-pill tnum bg-[#ffffff12] text-[var(--color-muted)]">
              {holders?.length ?? "—"}
            </span>
          </div>

          {holders === null ? (
            <p className="text-sm text-[var(--color-muted)]">
              Holder data is unavailable right now — public RPCs rate limit this
              call heavily. A dedicated endpoint fixes it.
            </p>
          ) : holders.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No holders yet.</p>
          ) : (
            <ol className="grid gap-1.5">
              {holders.map((holder, index) => (
                <li key={`${holder.owner ?? index}`} className="flex items-center gap-3 text-xs">
                  <span className="tnum w-4 shrink-0 text-right font-mono text-[var(--color-faint)]">
                    {index + 1}
                  </span>
                  <a
                    href={holder.owner ? solscanUrl("account", holder.owner) : "#"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="min-w-0 flex-1 truncate font-mono text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  >
                    {holder.owner ? shortAddress(holder.owner, 6) : "unknown"}
                  </a>
                  <span className="tnum shrink-0 font-mono">
                    {(holder.share * 100).toFixed(2)}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="min-w-0 lg:sticky lg:top-8">
        <TradePanel
          mint={coin.mint}
          symbol={coin.symbol}
          graduated={Boolean(stats?.graduated)}
        />
      </div>
    </div>
  );
}

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-line-strong)] hover:text-[var(--color-fg)]"
    >
      {children}
    </a>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#101015] px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className={`tnum mt-1 text-base font-bold ${accent ? "text-[var(--color-accent)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
