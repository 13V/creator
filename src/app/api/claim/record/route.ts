import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { getConnection } from "@/lib/pump/connection";
import { getCreator, insertPayout } from "@/lib/repo";
import { PLATFORMS } from "@/lib/social/types";

export const runtime = "nodejs";

const schema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(30),
  signature: z.string().min(32).max(128),
  lamports: z.coerce.number().int().min(0),
  destination: z.string().min(32).max(44),
});

/** Records a completed payout once its transaction has confirmed on-chain. */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    const creator = getCreator(body.platform, body.handle);
    if (!creator) return fail("Unknown creator.", 404);

    const status = await getConnection().getSignatureStatus(body.signature, {
      searchTransactionHistory: true,
    });
    if (!status.value || status.value.err) {
      return fail("That payout transaction did not confirm.", 409);
    }

    insertPayout({
      creator_id: creator.id,
      amount_lamports: body.lamports,
      destination: body.destination,
      signature: body.signature,
    });

    return ok({ recorded: true });
  } catch (error) {
    return handleError(error);
  }
}
