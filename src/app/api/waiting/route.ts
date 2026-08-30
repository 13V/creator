import { ok, handleError } from "@/lib/api";
import { listCoinsWithFees } from "@/lib/leaderboard";
import { getSolUsd } from "@/lib/solPrice";
import { demoBoard, demoBoardEnabled } from "@/lib/demoBoard";

/**
 * Total unclaimed creator fees across the board.
 *
 * Split out from the board itself so the nav rail can show the figure on every
 * page without every page paying for a board query. It deliberately skips
 * market data — the rail needs one number, and pricing every coin to render it
 * would triple the RPC cost of loading any page in the app.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // The rail renders this figure in dollars like the board does, and it is a
    // client component, so the price has to travel with the total rather than
    // being fetched again in the browser.
    // The rail's figure has to come from the same source the board does, or the
    // demo preview shows a populated board beside an empty rail.
    const [{ data: coins }, solUsd] = await Promise.all([
      demoBoardEnabled() ? Promise.resolve({ data: demoBoard() }) : listCoinsWithFees(200),
      getSolUsd(),
    ]);
    const lamports = coins.reduce((sum, coin) => sum + coin.feeLamports, 0);

    return ok(
      { lamports, coins: coins.length, solUsd },
      // A decorative total does not need to be to-the-second fresh, and this
      // keeps a burst of navigation from re-reading every escrow on chain.
      { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return handleError(error);
  }
}
