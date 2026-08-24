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
 * than using one fixed decimal count that would render either "0.0000" or
 * a wall of digits.
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
  tone?: "neutral" | "good" | "warn";
}) {
  const tones = {
    neutral: "border-[var(--color-line)] text-[var(--color-muted)]",
    good: "border-[#2f6f52] bg-[#12291f] text-[var(--color-accent)]",
    warn: "border-[#6b5326] bg-[#2a2013] text-[var(--color-warn)]",
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
 * This is the single most important thing to be honest about on the page: one
 * route needs nobody to be trusted, the other needs this launchpad to be.
 */
export function EscrowBadge({ kind, compact = false }: { kind: EscrowKind; compact?: boolean }) {
  if (kind === "pump-social") {
    return <Badge tone="good">◆ {compact ? "Non-custodial" : "Non-custodial · pump.fun vault"}</Badge>;
  }
  return <Badge tone="warn">◇ {compact ? "In trust" : "Held in trust by this launchpad"}</Badge>;
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent ? "text-[var(--color-accent)]" : ""
        }`}
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
  return <div className={`animate-pulse rounded-xl bg-[#161822] ${className}`} />;
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
      className="card group flex gap-3 p-4 transition duration-150 hover:-translate-y-0.5 hover:border-[#3a3d52]"
    >
      <Avatar src={imageUrl} alt={name} size={52} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span className="shrink-0 rounded bg-[#1c1f2b] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-muted)]">
            ${symbol}
          </span>
        </div>

        <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
          {PLATFORM_GLYPH[platform]} @{handle}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <EscrowBadge kind={escrowKind} compact />
          {feeLamports !== undefined && feeLamports > 0 && (
            <span className="font-mono text-[11px] text-[var(--color-accent)]">
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
      className="card flex items-center gap-3 p-3.5 transition hover:border-[#3a3d52]"
    >
      <span className="w-5 shrink-0 text-center font-mono text-xs text-[var(--color-muted)]">
        {rank}
      </span>

      <Avatar src={avatarUrl} alt={handle} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {displayName ?? `@${handle}`}
          </span>
          {claimed && (
            <span className="shrink-0 text-[10px] text-[var(--color-accent)]">✓ claimed</span>
          )}
        </div>
        <div className="truncate text-xs text-[var(--color-muted)]">
          {PLATFORM_GLYPH[platform]} @{handle} · {coinCount} coin{coinCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-semibold tabular-nums text-[var(--color-accent)]">
          {formatSol(feeLamports)}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          SOL waiting
        </div>
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
      <dt className="w-24 shrink-0 text-[var(--color-muted)]">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 break-all font-mono text-[11px] text-[#9aa0b8] underline-offset-2 hover:text-white hover:underline"
        >
          {value}
        </a>
        <CopyButton value={value} label={label} />
      </dd>
    </div>
  );
}
