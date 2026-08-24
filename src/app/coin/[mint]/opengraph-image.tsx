import { ImageResponse } from "next/og";
import { PublicKey } from "@solana/web3.js";

import { OG, loadImageDataUri, monogramStyle } from "@/lib/og";
import { getFeeSnapshot } from "@/lib/pump/fees";
import { getCoin } from "@/lib/repo";
import { PLATFORM_LABELS } from "@/lib/social/types";

export const runtime = "nodejs";
export const alt = "Creator coin";
export const size = OG.size;
export const contentType = "image/png";

/**
 * Share card for a coin.
 *
 * This product spreads by people posting coins at creators, so the link
 * preview is a real surface: it leads with the money the creator has waiting
 * rather than with the ticker.
 *
 * Satori requires every element with more than one child to declare a display
 * mode, so each text line below is built as a single interpolated string.
 */
export default async function Image({ params }: { params: { mint: string } }) {
  const coin = await getCoin(params.mint);
  if (!coin) return new ImageResponse(<Shell headline="Creator Launchpad" />, size);

  const [fees, avatar] = await Promise.all([
    getFeeSnapshot(new PublicKey(coin.escrow_pubkey)).catch(() => null),
    loadImageDataUri(coin.image_url),
  ]);

  const sol = fees ? `${(fees.totalLamports / 1_000_000_000).toFixed(3)} SOL` : "— SOL";
  const subtitle = `$${coin.symbol} · for @${coin.handle} on ${PLATFORM_LABELS[coin.platform]}`;
  const custodial = coin.escrow_kind === "pump-social";

  return new ImageResponse(
    (
      <div style={frame}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={148} height={148} style={avatarStyle} />
          ) : (
            <div style={monogramStyle(148)}>{coin.symbol.slice(0, 2).toUpperCase()}</div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 62, fontWeight: 700, letterSpacing: -1.5 }}>
              {coin.name.slice(0, 24)}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: OG.muted, marginTop: 8 }}>
              {subtitle}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: OG.muted, letterSpacing: 2 }}>
              CREATOR FEES WAITING
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 88,
                fontWeight: 800,
                color: OG.money,
                letterSpacing: -2,
              }}
            >
              {sol}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: custodial ? OG.money : OG.warn,
              border: `2px solid ${custodial ? "#a9e0c8" : "#efd9a8"}`,
              borderRadius: 999,
              padding: "12px 26px",
            }}
          >
            {custodial ? "Non-custodial" : "Held in trust"}
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
  borderRadius: 74,
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
        background: OG.background,
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
