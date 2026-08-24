import { fail, handleError, ok } from "@/lib/api";
import { env } from "@/lib/env";
import { distributeMany, findDistributable } from "@/lib/pump/distribute";
import { countCoins, listCoins } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Coins scanned per run. Scanning is two batched account reads regardless of
 * the number, so this is bounded by how many *transactions* a run might have
 * to send, not by the read cost.
 */
const SCAN = 200;

/** Transactions per run, so one invocation cannot outlive its time budget. */
const MAX_SENDS = 40;

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
  /*
   * A bearer token, always — never the `x-vercel-cron` header on its own.
   *
   * That header is set by the platform rather than proven by it, so treating
   * its presence as authentication makes this endpoint's cost anyone's to
   * spend: every call sends real transactions paid for by the treasury.
   * Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled runs when
   * CRON_SECRET is configured, so the scheduled path uses the same door as a
   * manual trigger.
   */
  const token = env().ADMIN_TOKEN;
  if (!token) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${token}`;
}

/**
 * Which page of coins this run looks at.
 *
 * Scanning only the newest page would strand every older coin: one that goes
 * quiet for a month and then catches a bid would accrue fees no run ever saw.
 * Deriving the page from the clock walks the whole catalogue without needing
 * to remember anything between runs.
 */
function pageForNow(total: number): number {
  const pages = Math.max(1, Math.ceil(total / SCAN));
  return (Math.floor(Date.now() / 3_600_000) % pages) * SCAN;
}

export async function GET(request: Request) {
  try {
    if (!authorised(request)) {
      return fail("Not authorised.", 401);
    }

    /*
     * Storage being down means we cannot tell which coins exist, not that
     * something is broken here. Say so and let the next run pick it up, rather
     * than returning a 500 that looks like a failing job in the dashboard.
     */
    let total: number;
    let coins: { mint: string }[];
    let offset = 0;
    try {
      total = await countCoins();
      if (total === 0) {
        return ok({ scanned: 0, ready: 0, paid: 0, results: [] });
      }
      offset = pageForNow(total);
      coins = await listCoins(SCAN, offset);
    } catch (error) {
      console.error("cannot read the coin list:", error);
      return ok({
        skipped: "storage unavailable",
        scanned: 0,
        ready: 0,
        paid: 0,
        results: [],
      });
    }

    // Only coins whose vault clears pump.fun's minimum are worth a
    // transaction; the rest would fail and burn a fee to tell us so.
    const ready = await findDistributable(coins.map((coin) => coin.mint));
    const results = await distributeMany(ready.slice(0, MAX_SENDS));
    const paid = results.filter((r) => r.status === "paid");

    if (paid.length > 0) {
      console.log(`distributed creator fees for ${paid.length} coin(s)`);
    }

    return ok({
      total,
      offset,
      scanned: coins.length,
      ready: ready.length,
      deferred: Math.max(0, ready.length - MAX_SENDS),
      paid: paid.length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) {
    return handleError(error);
  }
}
