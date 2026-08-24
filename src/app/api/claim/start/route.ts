import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

import { fail, handleError, ok, tooManyRequests } from "@/lib/api";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { previewEscrow } from "@/lib/escrow";
import { getCreator, setVerificationCode, upsertCreator } from "@/lib/repo";
import { resolveProfile } from "@/lib/social/resolve";
import { PLATFORMS } from "@/lib/social/types";
import {
  generateVerificationCode,
  VERIFICATION_TTL_MS,
  verificationInstructions,
} from "@/lib/verify/code";

export const runtime = "nodejs";

const schema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(30),
  /**
   * Where the creator wants to be paid.
   *
   * Required, because the code this issues is bound to it: a code posted on a
   * public profile can be read by anyone, so it must only ever release funds
   * to the wallet that asked for it.
   */
  wallet: z.string().min(32).max(44),
});

/** Issues a one-time code the creator must place on their profile. */
export async function POST(request: Request) {
  try {
    const gate = checkRateLimit(`claim-start:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const { platform, handle, wallet } = schema.parse(await request.json());

    let destination: PublicKey;
    try {
      destination = new PublicKey(wallet);
    } catch {
      return fail("That is not a valid Solana wallet address.");
    }

    const profile = await resolveProfile(platform, handle);
    const escrow = previewEscrow(profile);

    if (escrow.kind === "pump-social") {
      return ok({
        route: "pump.fun" as const,
        escrowPubkey: escrow.pubkey,
        message:
          "This creator's fees sit in pump.fun's own social vault. Claim them by " +
          "linking this X account on pump.fun — no verification is needed here, " +
          "and this launchpad could not release them even if you asked.",
      });
    }

    if (!escrow.available) {
      return fail(escrow.reason ?? "Escrow is not configured.", 503);
    }

    const creator =
      await getCreator(platform, handle) ?? await upsertCreator(profile, escrow.kind, escrow.pubkey);

    const code = generateVerificationCode();
    await setVerificationCode(creator.id, destination.toBase58(), code);

    return ok({
      route: "launchpad" as const,
      code,
      instructions: verificationInstructions(platform),
      expiresInMs: VERIFICATION_TTL_MS,
      escrowPubkey: escrow.pubkey,
    });
  } catch (error) {
    return handleError(error);
  }
}
