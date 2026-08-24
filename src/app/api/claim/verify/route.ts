import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

import { fail, handleError, ok, tooManyRequests } from "@/lib/api";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { buildManagedPayout } from "@/lib/pump/fees";
import { getCreator, markVerified } from "@/lib/repo";
import { PLATFORMS } from "@/lib/social/types";
import { checkVerification } from "@/lib/verify/code";

export const runtime = "nodejs";

const schema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(30),
  wallet: z.string().min(32).max(44),
});

/**
 * Verifies handle ownership and returns a payout transaction.
 *
 * The escrow co-signs here; the creator's own wallet is the fee payer and adds
 * the last signature, so the funds can only ever move to the wallet that
 * completed verification.
 */
export async function POST(request: Request) {
  try {
    const gate = checkRateLimit(`claim-verify:${clientKey(request)}`, { limit: 15, windowMs: 60_000 });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const { platform, handle, wallet } = schema.parse(await request.json());

    let destination: PublicKey;
    try {
      destination = new PublicKey(wallet);
    } catch {
      return fail("That is not a valid Solana wallet address.");
    }

    const creator = await getCreator(platform, handle);
    if (!creator) return fail("Start a claim for this handle first.", 404);

    if (creator.escrow_kind !== "managed") {
      return fail(
        "This creator's fees are held by pump.fun's social vault. Claim them on pump.fun.",
        409,
      );
    }

    const result = await checkVerification(creator);
    if (!result.ok) {
      return fail(result.reason, result.retryable ? 425 : 400);
    }

    await markVerified(creator.id, destination.toBase58());

    const payout = await buildManagedPayout({
      platform,
      handle,
      destination,
      feePayer: destination,
    });

    return ok({ verified: true, payout });
  } catch (error) {
    return handleError(error);
  }
}
