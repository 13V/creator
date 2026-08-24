import { ImageResponse } from "next/og";
import { PublicKey } from "@solana/web3.js";

import { previewEscrow } from "@/lib/escrow";
import { OG, loadImageDataUri, monogramStyle } from "@/lib/og";
import { getFeeSnapshot } from "@/lib/pump/fees";
import { getCreator } from "@/lib/repo";
import { resolveProfile } from "@/lib/social/resolve";
import { isPlatform, PLATFORM_LABELS } from "@/lib/social/types";

export const runtime = "nodejs";
export const alt = "Creator fees";
export const size = OG.size;
export const contentType = "image/png";

/**
 * Share card for a creator.
 *
 * Written to be persuasive when a fan posts it *at* the creator: the headline
 * is what they are owed, and the call to action is that it is claimable now.
 */
export default async function Image({
  params,
}: {
  params: { platform: string; handle: string };
}) {
  if (!isPlatform(params.platform)) {
    return new ImageResponse(<Shell headline="Creator Launchpad" />, size);
  }

  const profile = await resolveProfile(params.platform, decodeURIComponent(params.handle));
  const record = getCreator(params.platform, profile.handle);
  const escrow = previewEscrow(profile);

  const escrowPubkey = record?.escrow_pubkey ?? (escrow.available ? escrow.pubkey : null);
  const [fees, avatar] = await Promise.all([
    escrowPubkey
      ? getFeeSnapshot(new PublicKey(escrowPubkey)).catch(() => null)
      : Promise.resolve(null),
    loadImageDataUri(profile.avatarUrl),
  ]);

  const sol = `${((fees?.totalLamports ?? 0) / 1_000_000_000).toFixed(3)} SOL`;
  const name = (profile.displayName ?? `@${profile.handle}`).slice(0, 26);
  const subtitle = `@${profile.handle} on ${PLATFORM_LABELS[profile.platform]}`;

  return new ImageResponse(
    (
      <div style={frame}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={140} height={140} style={avatarStyle} />
          ) : (
            <div style={monogramStyle(140)}>{profile.handle.slice(0, 2).toUpperCase()}</div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 700, letterSpacing: -1.5 }}>
              {name}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: OG.muted, marginTop: 8 }}>
              {subtitle}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 24, color: OG.muted, letterSpacing: 2 }}>
            HAS CREATOR FEES WAITING
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontWeight: 800,
              color: OG.accent,
              letterSpacing: -3,
            }}
          >
            {sol}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#c6cad8", marginTop: 6 }}>
            Claimable now — no account needed
          </div>
        </div>
      </div>
    ),
    size,
  );
}

const frame = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  background: OG.background,
  padding: 72,
  color: OG.text,
  fontFamily: "sans-serif",
};

const avatarStyle = {
  borderRadius: 70,
  objectFit: "cover" as const,
  border: `3px solid ${OG.line}`,
};

function Shell({ headline }: { headline: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0b12",
        color: OG.text,
        fontSize: 64,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      {headline}
    </div>
  );
}
