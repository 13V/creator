import "server-only";

import sharp from "sharp";

const FETCH_TIMEOUT_MS = 6_000;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const AVATAR_PX = 300;

/**
 * Loads an avatar as a PNG data URI for use inside an OG image.
 *
 * Satori only decodes PNG and JPEG, but real avatars arrive as GIF (pump.fun),
 * WebP, AVIF, or SVG, and an image it cannot read aborts the entire response.
 * Everything is therefore re-encoded to PNG here rather than trusted, and any
 * failure resolves to null so the card renders without the picture instead of
 * the share preview breaking.
 */
export async function loadImageDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;

    const source = await res.arrayBuffer();
    if (source.byteLength === 0 || source.byteLength > MAX_SOURCE_BYTES) return null;

    // Downscale as well as convert: a 4K avatar would otherwise inflate the
    // data URI far beyond what the card needs at 148px.
    const png = await sharp(Buffer.from(source), { animated: false })
      .resize(AVATAR_PX, AVATAR_PX, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Shared palette so both share cards stay visually identical. */
export const OG = {
  size: { width: 1200, height: 630 },
  background: "linear-gradient(135deg, #0a0a0c 0%, #1a1218 55%, #0d1a15 100%)",
  text: "#f4f4f7",
  muted: "#8b8b9c",
  accent: "#4ce0a5",
  warn: "#ffb84d",
  line: "#26262f",
} as const;

/**
 * Placeholder shown when an avatar cannot be loaded, so the card keeps its
 * two-column balance instead of leaving a hole where the picture should be.
 */
export function monogramStyle(size: number) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    borderRadius: size / 2,
    border: `3px solid ${OG.line}`,
    background: "#16161c",
    color: OG.muted,
    fontSize: size * 0.42,
    fontWeight: 700,
  } as const;
}
