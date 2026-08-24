import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

import { CoinMedia } from "@/components/CoinMedia";
import { ShareButton } from "@/components/ShareButton";
import {
  AddressRow,
  Avatar,
  EscrowBadge,
  PLATFORM_GLYPH,
  formatSol,
  timeAgo,
} from "@/components/ui";
import { pumpFunUrl, solscanUrl } from "@/lib/pump/coin";
import { getFeeSnapshot } from "@/lib/pump/fees";
import { getMarketData } from "@/lib/pump/market";
import { getCoin } from "@/lib/repo";
import { profileUrl } from "@/lib/social/parse";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
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

  const [fees, market] = await Promise.all([
    getFeeSnapshot(new PublicKey(coin.escrow_pubkey)).catch(() => null),
    getMarketData([coin.mint]).catch(() => null),
  ]);
  const stats = market?.get(coin.mint) ?? null;
  const percent = Math.round((stats?.progress ?? 0) * 100);
  const creatorHref = `/creator/${coin.platform}/${encodeURIComponent(coin.handle)}`;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start">
      <div className="aspect-square overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[#0c0c11]">
        <CoinMedia src={coin.image_url} alt={coin.name} symbol={coin.symbol} />
      </div>

      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          <Link href={creatorHref}>
            <Avatar src={coin.avatar_url} alt={coin.handle} size={40} />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <Link href={creatorHref} className="block truncate text-sm font-semibold hover:underline">
              {coin.display_name ?? `@${coin.handle}`}
            </Link>
            <a
              href={profileUrl(coin.platform, coin.handle)}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-xs text-[var(--color-muted)] hover:underline"
            >
              {PLATFORM_GLYPH[coin.platform]} @{coin.handle} · {timeAgo(coin.created_at)} ago
            </a>
          </div>
          <EscrowBadge kind={coin.escrow_kind} compact />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{coin.name}</h1>
          <span className="font-mono text-sm text-[var(--color-muted)]">${coin.symbol}</span>
          {coin.description && (
            <p className="mt-3 text-sm leading-relaxed text-[#c9c9d6]">{coin.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card px-4 py-3">
            <div className="eyebrow">Market cap</div>
            <div className="tnum mt-1 text-lg font-bold">
              {stats?.marketCapLamports == null
                ? "—"
                : `${formatSol(stats.marketCapLamports)} SOL`}
            </div>
          </div>
          <div className="card px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">{stats?.graduated ? "Migrated" : "To graduation"}</span>
              <span className="tnum font-mono text-xs text-[var(--color-muted)]">{percent}%</span>
            </div>
            <div className="curve-track mt-2.5">
              <div className="curve-fill" style={{ width: `${Math.max(percent, 1.5)}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1f5f45] bg-[#0f2b21] p-4">
          <div className="eyebrow text-[#3fae83]">Waiting for @{coin.handle}</div>
          <div className="tnum mt-1 text-3xl font-bold text-[var(--color-money)]">
            {fees ? formatSol(fees.totalLamports) : "—"} SOL
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#8fc4ad]">
            {coin.escrow_kind === "pump-social"
              ? "In pump.fun's own social vault. This launchpad holds no key — only they can withdraw it."
              : "Held in trust by this launchpad, released once they verify the account is theirs."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={pumpFunUrl(coin.mint)}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Trade on pump.fun
          </a>
          <Link
            href={creatorHref}
            className="rounded-full border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-semibold"
          >
            Their profile
          </Link>
          <ShareButton path={`/coin/${coin.mint}`} title={`${coin.name} ($${coin.symbol})`} />
        </div>

        <dl className="card grid gap-2 p-4 text-xs">
          <AddressRow label="Escrow" value={coin.escrow_pubkey} href={solscanUrl("account", coin.escrow_pubkey)} />
          <AddressRow label="Mint" value={coin.mint} href={solscanUrl("account", coin.mint)} />
          <AddressRow label="Launch tx" value={coin.signature} href={solscanUrl("tx", coin.signature)} />
          <AddressRow label="Launched by" value={coin.launcher} href={solscanUrl("account", coin.launcher)} />
        </dl>
      </div>
    </div>
  );
}
