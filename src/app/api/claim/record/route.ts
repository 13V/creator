import { z } from "zod";

import { fail, handleError, ok, tooManyRequests } from "@/lib/api";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
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

/**
 * Confirms a signature really moved the claimed amount to the claimed wallet.
 *
 * A confirmed signature on its own proves nothing about *this* payout: any
 * transaction on mainnet has one. Without checking the balances, anyone could
 * post a stranger's signature with an amount and a destination of their
 * choosing and have it appear in a creator's public payout history.
 */
async function paidAsClaimed({
  signature,
  escrow,
  destination,
  lamports,
}: {
  signature: string;
  escrow: string;
  destination: string;
  lamports: number;
}): Promise<string | null> {
  const tx = await getConnection().getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx || tx.meta?.err) return "That payout transaction did not confirm.";

  const keys = tx.transaction.message
    .getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses })
    .keySegments()
    .flat()
    .map((key) => key.toBase58());

  if (!keys.includes(escrow)) {
    return "That transaction does not involve this creator's escrow.";
  }

  const index = keys.indexOf(destination);
  if (index < 0) return "That transaction does not pay the destination given.";

  const pre = tx.meta?.preBalances?.[index] ?? 0;
  const post = tx.meta?.postBalances?.[index] ?? 0;
  const credited = post - pre;

  // The destination usually pays the fee as well, so it nets slightly less
  // than the transfer. Accept anything at or above the claim rather than
  // insisting on an exact figure.
  if (credited + 1_000_000 < lamports) {
    return `That transaction credited ${credited} lamports, not ${lamports}.`;
  }
  return null;
}

/** Records a completed payout once its transaction has confirmed on-chain. */
export async function POST(request: Request) {
  try {
    const gate = await checkRateLimit(`claim-record:${clientKey(request)}`, {
      limit: 20,
      windowMs: 60000,
    });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const body = schema.parse(await request.json());

    const creator = await getCreator(body.platform, body.handle);
    if (!creator) return fail("Unknown creator.", 404);

    const problem = await paidAsClaimed({
      signature: body.signature,
      escrow: creator.escrow_pubkey,
      destination: body.destination,
      lamports: body.lamports,
    });
    if (problem) return fail(problem, 409);

    await insertPayout({
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
