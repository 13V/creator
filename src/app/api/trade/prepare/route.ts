import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

import { fail, handleError, ok, tooManyRequests } from "@/lib/api";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { buildTrade } from "@/lib/pump/trade";

export const runtime = "nodejs";

const schema = z.object({
  mint: z.string().min(32).max(44),
  wallet: z.string().min(32).max(44),
  side: z.enum(["buy", "sell"]),
  /** SOL to spend, for a buy. */
  solAmount: z.coerce.number().min(0).max(1_000).optional(),
  /** Base units of the token to sell. */
  tokenAmount: z.string().regex(/^\d+$/).optional(),
  slippageBps: z.coerce.number().int().min(10).max(5_000).default(100),
});

export async function POST(request: Request) {
  try {
    const gate = await checkRateLimit(`trade:${clientKey(request)}`, { limit: 30, windowMs: 60_000 });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const body = schema.parse(await request.json());

    let mint: PublicKey;
    let wallet: PublicKey;
    try {
      mint = new PublicKey(body.mint);
      wallet = new PublicKey(body.wallet);
    } catch {
      return fail("Invalid mint or wallet address.");
    }

    const quote = await buildTrade({
      mint,
      user: wallet,
      side: body.side,
      solLamports:
        body.side === "buy" ? Math.round((body.solAmount ?? 0) * 1_000_000_000) : undefined,
      tokenAmount: body.side === "sell" ? body.tokenAmount : undefined,
      slippageBps: body.slippageBps,
    });

    return ok(quote);
  } catch (error) {
    return handleError(error);
  }
}
