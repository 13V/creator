/**
 * Money as text, and the sanity band that decides whether a price is fit to
 * print.
 *
 * Split out of `ui.tsx` and `solPrice.ts` so it can be tested. Both of those
 * are unreachable from a test runner — one is a React module, the other
 * imports `server-only`, which throws outside a server component — and the
 * result was that the arithmetic turning on-chain lamports into the dollar
 * figures people read before spending money had no coverage at all. The
 * display components still re-export these, so nothing that renders had to
 * change.
 */

export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Formats lamports for display.
 *
 * Fee balances span many orders of magnitude — a coin minutes old holds dust
 * while a popular one holds tens of SOL — so precision scales with size rather
 * than using one fixed decimal count that would render either "0.0000" or a
 * wall of digits.
 */
export function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol === 0) return "0";
  if (sol < 0.0001) return "<0.0001";
  if (sol < 1) return sol.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (sol < 1000) return sol.toFixed(2);
  return sol.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Lamports as dollars, at the compactness a card has room for.
 *
 * Returns null when there is no price, so callers fall back to SOL rather
 * than rendering "$0" or an empty slot — on a page about real money an
 * invented figure is worse than an unfamiliar unit.
 */
export function formatUsd(lamports: number, solUsd: number | null | undefined): string | null {
  if (!solUsd) return null;
  const usd = (lamports / LAMPORTS_PER_SOL) * solUsd;

  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  // Cents up to $100, then whole dollars: "$1,240.37" is more digits than the
  // figure deserves at 11px, and the cents are noise at that size anyway.
  if (usd < 100) return `$${usd.toFixed(2)}`;
  if (usd < 1_000) return `$${usd.toFixed(0)}`;
  if (usd < 1_000_000) return `$${(usd / 1_000).toFixed(usd < 10_000 ? 1 : 0)}K`;
  if (usd < 1_000_000_000) return `$${(usd / 1_000_000).toFixed(usd < 10_000_000 ? 2 : 1)}M`;
  return `$${(usd / 1_000_000_000).toFixed(2)}B`;
}

export function lamportsToSol(lamports: number, digits = 4): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(digits);
}

/**
 * A sanity band for a SOL price, not a precision check.
 *
 * A source that starts returning 0, a string, or something wild is worse than
 * a source that is down, because the number would be rendered as fact. The
 * bounds are deliberately wide — this is here to catch a broken response
 * shape, not to have an opinion about the price.
 */
export function plausibleSolUsd(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0.01 && value < 100_000;
}
