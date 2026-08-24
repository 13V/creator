import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

import { GridTile } from "@/components/GridTile";
import { Avatar, EmptyState, EscrowBadge, PLATFORM_GLYPH, formatSol } from "@/components/ui";
import { previewEscrow } from "@/lib/escrow";
import { getFeeSnapshot } from "@/lib/pump/fees";
import { getCreator, listCoinsByCreator } from "@/lib/repo";
import { resolveProfile } from "@/lib/social/resolve";
import { isPlatform, PLATFORM_LABELS } from "@/lib/social/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string; handle: string }>;
}) {
  const { platform, handle } = await params;
  if (!isPlatform(platform)) return { title: "Creator not found" };

  const decoded = decodeURIComponent(handle);
  return {
    title: `@${decoded}`,
    description:
      `Creator fees are accruing on-chain for @${decoded} on ` +
      `${PLATFORM_LABELS[platform]}. Claimable any time, no account needed.`,
  };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ platform: string; handle: string }>;
}) {
  const { platform, handle } = await params;
  if (!isPlatform(platform)) notFound();

  const profile = await resolveProfile(platform, decodeURIComponent(handle));
  const record = await getCreator(platform, profile.handle);
  const escrow = previewEscrow(profile);

  const escrowPubkey = record?.escrow_pubkey ?? (escrow.available ? escrow.pubkey : null);
  const fees = escrowPubkey
    ? await getFeeSnapshot(new PublicKey(escrowPubkey)).catch(() => null)
    : null;

  const coins = record ? await listCoinsByCreator(record.id) : [];
  const escrowKind = record?.escrow_kind ?? escrow.kind;
  const claimed = Boolean(record?.verified_at);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        <Avatar src={profile.avatarUrl} alt={profile.handle} size={112} />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
            <h1 className="text-xl font-bold tracking-tight">
              {profile.displayName ?? `@${profile.handle}`}
            </h1>
            {claimed && (
              <span className="text-xs font-medium text-[var(--color-money)]">✓ verified</span>
            )}
          </div>

          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-0.5 inline-block text-sm text-[var(--color-muted)] hover:underline"
          >
            {PLATFORM_GLYPH[profile.platform]} @{profile.handle} on{" "}
            {PLATFORM_LABELS[profile.platform]}
          </a>

          <dl className="mt-4 flex justify-center gap-7 sm:justify-start">
            <Metric label="coins" value={coins.length} />
            <Metric
              label="SOL waiting"
              value={fees ? formatSol(fees.totalLamports) : "—"}
              accent
            />
            <Metric
              label="followers"
              value={profile.followers != null ? compact(profile.followers) : "—"}
            />
          </dl>

          {profile.bio && (
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[var(--color-muted)] sm:mx-0">
              {profile.bio}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
            <EscrowBadge kind={escrowKind} compact />
            {escrowKind === "pump-social" ? (
              <a
                href="https://pump.fun"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-money px-4 py-2 text-xs"
              >
                Claim on pump.fun
              </a>
            ) : (
              <Link
                href={`/claim?platform=${profile.platform}&handle=${encodeURIComponent(profile.handle)}`}
                className="btn-primary px-4 py-2 text-xs"
              >
                Is this you? Claim it
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8 border-t border-[var(--color-line)] pt-6">
        {coins.length === 0 ? (
          <EmptyState
            title="No coins yet"
            body={`Nobody has launched a coin for @${profile.handle} here.`}
          />
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3">
            {coins.map((coin) => (
              <GridTile
                key={coin.mint}
                mint={coin.mint}
                name={coin.name}
                symbol={coin.symbol}
                imageUrl={coin.image_url}
                platform={coin.platform}
                handle={coin.handle}
                feeLamports={0}
                showHandle={false}
                showFees={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <dd className={`tnum text-base font-bold ${accent ? "text-[var(--color-money)]" : ""}`}>
        {value}
      </dd>
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
    </div>
  );
}

function compact(value: number): string {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
