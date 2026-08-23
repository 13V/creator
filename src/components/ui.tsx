import Link from "next/link";
import type { ReactNode } from "react";

import type { EscrowKind, Platform } from "@/lib/social/types";

export const PLATFORM_GLYPH: Record<Platform, string> = {
  x: "𝕏",
  instagram: "IG",
  tiktok: "TT",
};

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
export function EscrowBadge({ kind }: { kind: EscrowKind }) {
  return kind === "pump-social" ? (
    <Badge tone="good">◆ Non-custodial · pump.fun vault</Badge>
  ) : (
    <Badge tone="warn">◇ Held in trust by this launchpad</Badge>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function Avatar({
  src,
  alt,
  size = 56,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? "/avatar-fallback.svg"}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-[var(--color-line)] bg-[#181a24] object-cover"
      style={{ width: size, height: size }}
    />
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

export function CoinTile({
  mint,
  name,
  symbol,
  imageUrl,
  platform,
  handle,
  escrowKind,
}: {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  platform: Platform;
  handle: string;
  escrowKind: EscrowKind;
}) {
  return (
    <Link
      href={`/coin/${mint}`}
      className="card group flex gap-3 p-4 transition hover:border-[#3a3d52]"
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
        <div className="mt-2">
          <EscrowBadge kind={escrowKind} />
        </div>
      </div>
    </Link>
  );
}

export function lamportsToSol(lamports: number, digits = 4): string {
  return (lamports / 1_000_000_000).toFixed(digits);
}
