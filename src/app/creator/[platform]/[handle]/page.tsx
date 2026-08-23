import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

import {
  Avatar,
  CoinTile,
  EmptyState,
  EscrowBadge,
  PLATFORM_GLYPH,
  Stat,
  lamportsToSol,
} from "@/components/ui";
import { previewEscrow } from "@/lib/escrow";
import { getFeeSnapshot } from "@/lib/pump/fees";
import { getCreator, listCoinsByCreator } from "@/lib/repo";
import { resolveProfile } from "@/lib/social/resolve";
import { isPlatform, PLATFORM_LABELS } from "@/lib/social/types";

export const dynamic = "force-dynamic";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ platform: string; handle: string }>;
}) {
  const { platform, handle } = await params;
  if (!isPlatform(platform)) notFound();

  const profile = await resolveProfile(platform, decodeURIComponent(handle));
  const record = getCreator(platform, profile.handle);
  const escrow = previewEscrow(profile);

  const escrowPubkey = record?.escrow_pubkey ?? (escrow.available ? escrow.pubkey : null);
  const fees = escrowPubkey
    ? await getFeeSnapshot(new PublicKey(escrowPubkey)).catch(() => null)
    : null;

  const coins = record ? listCoinsByCreator(record.id) : [];
  const escrowKind = record?.escrow_kind ?? escrow.kind;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="card flex flex-wrap items-start gap-5 p-6">
        <Avatar src={profile.avatarUrl} alt={profile.handle} size={84} />

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {profile.displayName ?? `@${profile.handle}`}
          </h1>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-block text-sm text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            {PLATFORM_GLYPH[profile.platform]} @{profile.handle} on{" "}
            {PLATFORM_LABELS[profile.platform]}
          </a>

          {profile.bio && (
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#c6cad8]">
              {profile.bio}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EscrowBadge kind={escrowKind} />
            {record?.verified_at && (
              <span className="text-xs text-[var(--color-accent)]">✓ Account verified</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Unclaimed fees"
          value={fees ? `${lamportsToSol(fees.totalLamports)} SOL` : "—"}
        />
        <Stat label="Coins launched" value={coins.length} />
        <Stat
          label="Followers"
          value={profile.followers != null ? profile.followers.toLocaleString() : "—"}
        />
      </div>

      <div className="card grid gap-3 p-6">
        <h2 className="text-sm font-semibold">
          Are you {profile.displayName ?? `@${profile.handle}`}?
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
          {escrowKind === "pump-social"
            ? "Your fees are already yours — they sit in pump.fun's social vault for your X account. Link that account on pump.fun to withdraw. Nobody here can touch them."
            : "Prove the account is yours and the escrow pays out to any wallet you choose. Verification takes about a minute."}
        </p>
        <div>
          {escrowKind === "pump-social" ? (
            <a
              href="https://pump.fun"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
            >
              Claim on pump.fun
            </a>
          ) : (
            <Link
              href={`/claim?platform=${profile.platform}&handle=${encodeURIComponent(profile.handle)}`}
              className="inline-block rounded-xl bg-gradient-to-b from-[var(--color-accent)] to-[#46c98a] px-4 py-2.5 text-sm font-bold text-[#06210f]"
            >
              Verify and claim
            </Link>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Their coins</h2>
        {coins.length === 0 ? (
          <EmptyState
            title="No coins launched here yet"
            body={`Nobody has launched a coin for @${profile.handle} on this launchpad.`}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {coins.map((coin) => (
              <CoinTile
                key={coin.mint}
                mint={coin.mint}
                name={coin.name}
                symbol={coin.symbol}
                imageUrl={coin.image_url}
                platform={coin.platform}
                handle={coin.handle}
                escrowKind={coin.escrow_kind}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
