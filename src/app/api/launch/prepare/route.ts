import { PublicKey } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { prepareLaunch } from "@/lib/pump/launch";
import { parseSocialInput } from "@/lib/social/parse";
import { resolveProfile } from "@/lib/social/resolve";
import { PLATFORMS } from "@/lib/social/types";

export const runtime = "nodejs";

/** pump.fun renders these in fixed-width slots; longer values get truncated. */
const MAX_DEV_BUY_SOL = 50;

const schema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(30),
  payer: z.string().min(32).max(44),
  name: z.string().trim().min(1).max(32),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Ticker must be letters and numbers only"),
  description: z.string().trim().max(500).default(""),
  imageUrl: z.string().url().optional(),
  devBuySol: z.coerce.number().min(0).max(MAX_DEV_BUY_SOL).default(0),
  slippageBps: z.coerce.number().int().min(50).max(5_000).default(500),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

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
    if (!imageUrl) {
      return fail("No image available for this creator. Provide one to launch.");
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
      imageUrl,
      devBuyLamports: Math.round(body.devBuySol * LAMPORTS_PER_SOL),
      slippageBps: body.slippageBps,
    });

    return ok({ ...prepared, profile });
  } catch (error) {
    return handleError(error);
  }
}
