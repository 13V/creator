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
});

/** Issues a one-time code the creator must place on their profile. */
export async function POST(request: Request) {
  try {
    const gate = checkRateLimit(`claim-start:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const { platform, handle } = schema.parse(await request.json());

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
      getCreator(platform, handle) ?? upsertCreator(profile, escrow.kind, escrow.pubkey);

    const code = generateVerificationCode();
    setVerificationCode(creator.id, code);

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
