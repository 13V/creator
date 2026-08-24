import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

import {
  AddressRow,
  Avatar,
  EscrowBadge,
  PLATFORM_GLYPH,
  Stat,
  formatSol,
} from "@/components/ui";
import { pumpFunUrl, solscanUrl } from "@/lib/pump/coin";
import { getFeeSnapshot } from "@/lib/pump/fees";
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

export default async function CoinPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;
  const coin = getCoin(mint);
  if (!coin) notFound();

  const fees = await getFeeSnapshot(new PublicKey(coin.escrow_pubkey)).catch(() => null);
  const creatorHref = `/creator/${coin.platform}/${coin.handle}`;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="card flex flex-wrap items-start gap-5 p-6">
        <Avatar src={coin.image_url} alt={coin.name} size={84} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{coin.name}</h1>
            <span className="rounded bg-[#1e1e26] px-2 py-1 font-mono text-xs text-[var(--color-muted)]">
              ${coin.symbol}
            </span>
          </div>

          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            Launched for{" "}
            <Link href={creatorHref} className="text-white underline-offset-2 hover:underline">
              {PLATFORM_GLYPH[coin.platform]} @{coin.handle}
            </Link>{" "}
            ·{" "}
            <a
              href={profileUrl(coin.platform, coin.handle)}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-2 hover:underline"
            >
              view profile
            </a>
          </p>

          {coin.description && (
            <p className="mt-3 text-sm leading-relaxed text-[#c9c9d6]">{coin.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={pumpFunUrl(coin.mint)}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
            >
              Trade on pump.fun
            </a>
            <Link
              href={creatorHref}
              className="rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold"
            >
              Creator&apos;s fees
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Fees waiting to claim"
          value={fees ? `${formatSol(fees.totalLamports)} SOL` : "—"}
          accent={Boolean(fees && fees.totalLamports > 0)}
        />
        <Stat label="Opening buy" value={`${formatSol(coin.dev_buy_lamports)} SOL`} />
        <Stat
          label="Launched"
          value={new Date(coin.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        />
      </div>

      <div className="card grid gap-3 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Where the creator fees go</h2>
          <EscrowBadge kind={coin.escrow_kind} />
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
          {coin.escrow_kind === "pump-social"
            ? "Fees route to pump.fun's own social vault for this X account. This launchpad holds no key to it — only the creator, by linking that account on pump.fun, can withdraw."
            : "Fees route to an escrow wallet this launchpad derives and holds in trust. It is released to the creator once they verify the account is theirs."}
        </p>

        <dl className="mt-1 grid gap-2 text-xs">
          <AddressRow label="Escrow" value={coin.escrow_pubkey} href={solscanUrl("account", coin.escrow_pubkey)} />
          <AddressRow label="Mint" value={coin.mint} href={solscanUrl("account", coin.mint)} />
          <AddressRow label="Launch tx" value={coin.signature} href={solscanUrl("tx", coin.signature)} />
          <AddressRow label="Launched by" value={coin.launcher} href={solscanUrl("account", coin.launcher)} />
        </dl>
      </div>
    </div>
  );
}
