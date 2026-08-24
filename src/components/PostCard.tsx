import Link from "next/link";

import { CoinMedia } from "@/components/CoinMedia";
import { ShareButton } from "@/components/ShareButton";
import { Avatar, EscrowBadge, PLATFORM_GLYPH, formatSol, timeAgo } from "@/components/ui";
import { BoltIcon } from "@/components/icons";
import type { EscrowKind, Platform } from "@/lib/social/types";

export interface Post {
  mint: string;
  name: string;
  symbol: string;
  image_url: string | null;
  platform: Platform;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  escrow_kind: EscrowKind;
  created_at: number;
  feeLamports: number;
}

/**
 * A launched coin rendered as a feed post.
 *
 * The creator is the author, the artwork is the media, and fees earned are the
 * engagement number — which is the honest headline here, since the whole point
 * is money accruing to somebody who has not asked for it.
 */
export function PostCard({ post }: { post: Post }) {
  const creatorHref = `/creator/${post.platform}/${encodeURIComponent(post.handle)}`;
  const coinHref = `/coin/${post.mint}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[#101015]">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={creatorHref} className="shrink-0">
          <Avatar src={post.avatar_url} alt={post.handle} size={38} />
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          <Link href={creatorHref} className="block truncate text-sm font-semibold hover:underline">
            {post.display_name ?? `@${post.handle}`}
          </Link>
          <div className="truncate text-xs text-[var(--color-muted)]">
            {PLATFORM_GLYPH[post.platform]} @{post.handle} · {timeAgo(post.created_at)}
          </div>
        </div>

        <EscrowBadge kind={post.escrow_kind} compact />
      </header>

      <Link href={coinHref} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-[#0c0c11]">
          <CoinMedia src={post.image_url} alt={post.name} symbol={post.symbol} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-[#0a0a0ceb] via-[#0a0a0c99] to-transparent p-4">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold tracking-tight">{post.name}</div>
              <div className="font-mono text-xs text-[var(--color-muted)]">${post.symbol}</div>
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 px-3 py-2.5">
        {/*
          One escrow serves a creator across every coin launched for them, so
          this is their whole unclaimed balance rather than this coin's share.
          Phrased as a destination to avoid implying per-coin attribution.
        */}
        <span className="flex items-center gap-1.5 rounded-lg bg-[#0f2b21] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-money)]">
          <BoltIcon />
          <span className="tnum">{formatSol(post.feeLamports)} SOL</span>
          <span className="hidden font-normal text-[#3fae83] sm:inline">to @{post.handle}</span>
        </span>

        <a
          href={`https://pump.fun/coin/${post.mint}`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted)] transition hover:bg-[#ffffff0a] hover:text-[var(--color-fg)]"
        >
          Trade
        </a>

        <ShareButton path={coinHref} title={`${post.name} ($${post.symbol})`} />

        <Link
          href={creatorHref}
          className="ml-auto rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted)] transition hover:bg-[#ffffff0a] hover:text-[var(--color-fg)]"
        >
          {post.escrow_kind === "managed" ? "Tell them" : "Their fees"}
        </Link>
      </div>
    </article>
  );
}
