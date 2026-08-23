import "server-only";

import { fetchWithTimeout } from "../social/http";

const PUMP_IPFS_ENDPOINT = "https://pump.fun/api/ipfs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface MetadataInput {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitter?: string;
  website?: string;
}

export interface UploadedMetadata {
  metadataUri: string;
  imageUri: string | null;
}

/**
 * Mirrors the creator's avatar into the coin's metadata.
 *
 * pump.fun's own IPFS endpoint is used so the resulting token renders natively
 * on pump.fun. Avatars are re-hosted rather than hot-linked because social CDNs
 * rotate URLs and would leave the coin with a dead image.
 */
export async function uploadMetadata(input: MetadataInput): Promise<UploadedMetadata> {
  const image = await downloadImage(input.imageUrl);

  const form = new FormData();
  form.append("file", image.blob, image.filename);
  form.append("name", input.name);
  form.append("symbol", input.symbol);
  form.append("description", input.description);
  form.append("twitter", input.twitter ?? "");
  form.append("telegram", "");
  form.append("website", input.website ?? "");
  form.append("showName", "true");

  const res = await fetchWithTimeout(PUMP_IPFS_ENDPOINT, {
    method: "POST",
    body: form,
    timeoutMs: 30_000,
  });

  if (!res.ok) {
    throw new Error(`pump.fun metadata upload failed (${res.status})`);
  }

  const body = (await res.json()) as {
    metadataUri?: string;
    metadata?: { image?: string };
  };

  if (!body.metadataUri) {
    throw new Error("pump.fun metadata upload returned no metadataUri");
  }

  return { metadataUri: body.metadataUri, imageUri: body.metadata?.image ?? null };
}

async function downloadImage(url: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetchWithTimeout(url, { timeoutMs: 15_000, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Could not download the creator's image (${res.status})`);
  }

  const contentType = res.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Creator image URL returned ${contentType}, not an image`);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error("Creator image was empty");
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Creator image is larger than 5 MB");
  }

  const ext = contentType.split("/")[1]?.split(";")[0] ?? "png";
  return {
    blob: new Blob([buffer], { type: contentType }),
    filename: `avatar.${ext}`,
  };
}
