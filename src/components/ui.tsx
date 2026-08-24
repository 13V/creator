import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/Avatar";
import { CopyButton } from "@/components/CopyButton";
import type { EscrowKind, Platform } from "@/lib/social/types";

export { Avatar };

export const PLATFORM_GLYPH: Record<Platform, string> = {
  x: "𝕏",
  instagram: "IG",
  tiktok: "TT",
};

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Formats lamports for display.
 *
 * Fee balances span many orders of magnitude — a coin minutes old holds dust
 * while a popular one holds tens of SOL — so precision scales with size rather
 * than using one fixed decimal count that would render either "0.0000" or a
 * wall of digits.
 */
export function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol === 0) return "0";
  if (sol < 0.0001) return "<0.0001";
  if (sol < 1) return sol.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (sol < 1000) return sol.toFixed(2);
  return sol.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function lamportsToSol(lamports: number, digits = 4): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(digits);
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "money" | "caution" | "accent";
}) {
  const tones = {
    neutral: "border-[var(--color-line)] text-[var(--color-muted)]",
    money: "border-[#3f5410] bg-[#1a2408] text-[var(--color-money)]",
    caution: "border-[#6b5326] bg-[#2a2013] text-[var(--color-caution)]",
    accent: "border-[#7a2a1a] bg-[#2a1310] text-[var(--color-accent)]",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Says who can actually withdraw a coin's fees.
 *
 * The single most important thing to be honest about on the page: one route
 * needs nobody to be trusted, the other needs this launchpad to be.
 */
export function EscrowBadge({ kind, compact = false }: { kind: EscrowKind; compact?: boolean }) {
  if (kind === "pump-social") {
    return (
      <Badge tone="money">
        ◆ {compact ? "Non-custodial" : "Non-custodial · pump.fun vault"}
      </Badge>
    );
  }
  return <Badge tone="caution">◇ {compact ? "In trust" : "Held in trust by this launchpad"}</Badge>;
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div
        className={`tnum mt-1.5 text-lg font-semibold ${accent ? "text-[var(--color-money)]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[#16161c] ${className}`} />;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-accent-dim)]"
    >
      {children}
    </Link>
  );
}

export function CoinTile({
  mint,
  name,
  symbol,
  imageUrl,
  platform,
  handle,
  escrowKind,
  feeLamports,
}: {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  platform: Platform;
  handle: string;
  escrowKind: EscrowKind;
  feeLamports?: number;
}) {
  return (
    <Link
      href={`/coin/${mint}`}
      className="card group flex gap-3.5 p-4 transition duration-150 hover:-translate-y-0.5 hover:border-[var(--color-line-strong)]"
    >
      <Avatar src={imageUrl} alt={name} size={54} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span className="shrink-0 rounded bg-[#1e1e26] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-muted)]">
            ${symbol}
          </span>
        </div>

        <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
          {PLATFORM_GLYPH[platform]} @{handle}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <EscrowBadge kind={escrowKind} compact />
          {feeLamports !== undefined && feeLamports > 0 && (
            <span className="tnum font-mono text-[11px] text-[var(--color-money)]">
              {formatSol(feeLamports)} SOL earned
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** One row of the unclaimed-fee leaderboard. */
export function LeaderRow({
  rank,
  platform,
  handle,
  displayName,
  avatarUrl,
  coinCount,
  feeLamports,
  claimed,
}: {
  rank: number;
  platform: Platform;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  coinCount: number;
  feeLamports: number;
  claimed: boolean;
}) {
  return (
    <Link
      href={`/creator/${platform}/${encodeURIComponent(handle)}`}
      className="card flex items-center gap-3.5 p-3.5 transition hover:border-[var(--color-line-strong)]"
    >
      <span className="tnum w-5 shrink-0 text-center font-mono text-xs text-[var(--color-faint)]">
        {rank}
      </span>

      <Avatar src={avatarUrl} alt={handle} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {displayName ?? `@${handle}`}
          </span>
          {claimed && (
            <span className="shrink-0 text-[10px] text-[var(--color-money)]">✓ claimed</span>
          )}
        </div>
        <div className="truncate text-xs text-[var(--color-muted)]">
          {PLATFORM_GLYPH[platform]} @{handle} · {coinCount} coin{coinCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="tnum font-mono text-sm font-semibold text-[var(--color-money)]">
          {formatSol(feeLamports)}
        </div>
        <div className="eyebrow">SOL waiting</div>
      </div>
    </Link>
  );
}

/** A labelled on-chain address with an explorer link and a copy control. */
export function AddressRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="w-24 shrink-0 text-[var(--color-faint)]">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 break-all font-mono text-[11px] text-[#9a9aae] underline-offset-2 hover:text-white hover:underline"
        >
          {value}
        </a>
        <CopyButton value={value} label={label} />
      </dd>
    </div>
  );
}

/** Compact relative time, the way a feed timestamps a post. */
export function timeAgo(timestamp: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
}

/** Mint addresses are long; show enough of both ends to recognise one. */
export function shortAddress(address: string, edge = 4): string {
  return address.length <= edge * 2 + 1
    ? address
    : `${address.slice(0, edge)}…${address.slice(-edge)}`;
}
