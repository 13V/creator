import { fail, handleError, ok } from "@/lib/api";
import { env } from "@/lib/env";
import { distributeMany } from "@/lib/pump/distribute";
import { listCoins } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Coins per run, so one invocation cannot outlive its serverless budget. */
const BATCH = 40;

/**
 * Cranks creator-fee payouts on a schedule.
 *
 * `distributeCreatorFees` needs no signature, so anyone *can* call it — which
 * in practice means nobody does, and fees pile up in vaults while creators
 * conclude the launchpad is not paying them. This is what makes the money
 * actually move.
 *
 * Guarded by ADMIN_TOKEN as well as Vercel's own cron header, so it can be
 * triggered by hand while staying closed to the internet.
 */
function authorised(request: Request): boolean {
  // Vercel signs its own scheduled invocations.
  if (request.headers.get("x-vercel-cron")) return true;

  const token = env().ADMIN_TOKEN;
  if (!token) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${token}`;
}

export async function GET(request: Request) {
  try {
    if (!authorised(request)) {
      return fail("Not authorised.", 401);
    }

    // Newest first: a fresh coin is the one most likely to have unswept fees
    // and the one whose creator is most likely to be watching.
    const coins = await listCoins(BATCH);
    if (coins.length === 0) {
      return ok({ checked: 0, paid: 0, results: [] });
    }

    const results = await distributeMany(coins.map((coin) => coin.mint));
    const paid = results.filter((r) => r.status === "paid");

    if (paid.length > 0) {
      console.log(`distributed creator fees for ${paid.length} coin(s)`);
    }

    return ok({
      checked: results.length,
      paid: paid.length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) {
    return handleError(error);
  }
}
