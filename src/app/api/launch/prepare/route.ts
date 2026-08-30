import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { z } from "zod";

import { fail, handleError, ok, tooManyRequests } from "@/lib/api";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { prepareLaunch } from "@/lib/pump/launch";
import type { CoinImage } from "@/lib/pump/metadata";
import { parseSocialInput } from "@/lib/social/parse";
import { resolveProfile } from "@/lib/social/resolve";
import { PLATFORMS } from "@/lib/social/types";

export const runtime = "nodejs";

const MAX_DEV_BUY_SOL = 50;

/** Blank strings arrive from untouched form fields; treat them as absent. */
const optionalUrl = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => !value || /^https?:\/\/\S+$/i.test(value), {
    message: "Links must start with http:// or https://",
  });

const schema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(30),
  payer: z.string().min(32).max(44),
  name: z.string().trim().min(1).max(32),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(13)
    .regex(/^[A-Za-z0-9]+$/, "Ticker must be letters and numbers only"),
  description: z.string().trim().max(500).default(""),
  imageUrl: z.string().url().optional(),
  twitter: optionalUrl,
  telegram: optionalUrl,
  website: optionalUrl,
  devBuySol: z.coerce.number().min(0).max(MAX_DEV_BUY_SOL).default(0),
  slippageBps: z.coerce.number().int().min(50).max(5_000).default(500),
});

/**
 * Reads the request as either multipart (the launch form, which can carry an
 * image file) or JSON (scripts and integrations).
 */
async function readBody(
  request: Request,
): Promise<{ fields: Record<string, unknown>; image: CoinImage | null }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return { fields: (await request.json()) as Record<string, unknown>, image: null };
  }

  const form = await request.formData();
  const fields: Record<string, unknown> = {};
  let image: CoinImage | null = null;

  for (const [key, value] of form.entries()) {
    if (key === "image" && value instanceof File && value.size > 0) {
      image = { blob: value, filename: value.name || "coin" };
    } else if (typeof value === "string") {
      fields[key] = value;
    }
  }

  return { fields, image };
}

export async function POST(request: Request) {
  try {
    const gate = await checkRateLimit(`prepare:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const { fields, image } = await readBody(request);
    const body = schema.parse(fields);

    const ref = parseSocialInput(`${body.platform}:${body.handle}`);
    if (!ref) return fail("That handle is not valid for this platform.");

    let payer: PublicKey;
    try {
      payer = new PublicKey(body.payer);
    } catch {
      return fail("Connected wallet address is not a valid Solana public key.");
    }

    const profile = await resolveProfile(ref.platform, ref.handle);
    const imageUrl = body.imageUrl ?? profile.avatarUrl;
    if (!image && !imageUrl) {
      return fail("Add an image for the coin.");
    }

    const prepared = await prepareLaunch({
      profile,
      payer,
      name: body.name,
      symbol: body.symbol.toUpperCase(),
      description:
        body.description ||
        `A creator coin for ${profile.displayName ?? "@" + profile.handle}. ` +
          `Trading fees accrue to them at ${profile.profileUrl}.`,
      image,
      imageUrl,
      links: { twitter: body.twitter, telegram: body.telegram, website: body.website },
      devBuyLamports: Math.round(body.devBuySol * LAMPORTS_PER_SOL),
      slippageBps: body.slippageBps,
    });

    return ok({ ...prepared, profile });
  } catch (error) {
    return handleError(error);
  }
}
