import "server-only";

import { fetchWithTimeout } from "../social/http";
import { LaunchError } from "./errors";

const PUMP_IPFS_ENDPOINT = "https://pump.fun/api/ipfs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** What pump.fun's uploader and every major wallet will actually render. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export interface CoinImage {
  blob: Blob;
  filename: string;
}

export interface MetadataInput {
  name: string;
  symbol: string;
  description: string;
  /** An image the launcher uploaded. Takes precedence over `imageUrl`. */
  image?: CoinImage | null;
  /** Fallback when nothing was uploaded — usually the creator's avatar. */
  imageUrl?: string | null;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface UploadedMetadata {
  metadataUri: string;
  imageUri: string | null;
}

/**
 * Pins the coin's image and metadata to pump.fun's own IPFS endpoint, so the
 * token renders natively on pump.fun.
 *
 * An uploaded file wins over the creator's avatar: someone launching a coin
 * usually has better artwork in mind than a profile picture, and avatar CDNs
 * rate limit hard enough that relying on them alone blocks launches.
 */
export async function uploadMetadata(input: MetadataInput): Promise<UploadedMetadata> {
  const image = input.image
    ? validateImage(input.image)
    : await downloadImage(input.imageUrl);

  const form = new FormData();
  form.append("file", image.blob, image.filename);
  form.append("name", input.name);
  form.append("symbol", input.symbol);
  form.append("description", input.description);
  form.append("twitter", input.twitter ?? "");
  form.append("telegram", input.telegram ?? "");
  form.append("website", input.website ?? "");
  form.append("showName", "true");

  const res = await fetchWithTimeout(PUMP_IPFS_ENDPOINT, {
    method: "POST",
    body: form,
    timeoutMs: 30_000,
  });

  if (!res.ok) {
    throw new LaunchError(
      res.status === 429
        ? "pump.fun is rate limiting metadata uploads right now. Try again shortly."
        : `pump.fun rejected the coin metadata (${res.status}). Try again shortly.`,
    );
  }

  const body = (await res.json()) as {
    metadataUri?: string;
    metadata?: { image?: string };
  };

  if (!body.metadataUri) {
    throw new LaunchError("pump.fun accepted the metadata but returned no URI.");
  }

  return { metadataUri: body.metadataUri, imageUri: body.metadata?.image ?? null };
}

function validateImage(image: CoinImage): CoinImage {
  const type = image.blob.type.split(";")[0].trim();
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) {
    throw new LaunchError("Images must be a PNG, JPG, GIF, or WEBP.");
  }
  if (image.blob.size === 0) {
    throw new LaunchError("That image file was empty.");
  }
  if (image.blob.size > MAX_IMAGE_BYTES) {
    throw new LaunchError("That image is larger than 5 MB. Pick a smaller one.");
  }
  return image;
}

async function downloadImage(url: string | null | undefined): Promise<CoinImage> {
  if (!url) {
    throw new LaunchError("Add an image for the coin.");
  }

  const res = await fetchWithTimeout(url, { timeoutMs: 15_000, redirect: "follow" });
  if (!res.ok) {
    // Avatar CDNs rate limit hard, and a coin cannot launch without a picture.
    // Say which knob fixes it rather than failing as an opaque server error.
    throw new LaunchError(
      res.status === 429
        ? "The avatar service is rate limiting us. Upload your own image instead."
        : `Could not fetch the creator's picture (${res.status}). Upload your own image instead.`,
    );
  }

  const contentType = (res.headers.get("content-type") ?? "image/png").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new LaunchError(
      `That image URL returned ${contentType}, not an image. Upload a file instead.`,
    );
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new LaunchError("The creator's picture came back empty. Upload your own image.");
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new LaunchError("That image is larger than 5 MB. Upload a smaller one.");
  }

  const ext = contentType.split("/")[1] ?? "png";
  return { blob: new Blob([buffer], { type: contentType }), filename: `avatar.${ext}` };
}
