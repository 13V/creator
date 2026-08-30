import "server-only";

// The sanity band lives in `@/lib/money`; `server-only` makes this file
// unreachable from the test runner, and an unchecked price band is exactly the
// kind of thing that should have a test.
import { plausibleSolUsd } from "./money";

/**
 * What one SOL is worth in dollars.
 *
 * Board figures are denominated in lamports because that is what the chain
 * reports, but "0.663 SOL" tells almost nobody anything. This converts them
 * for display only — nothing is ever stored or transacted in dollars.
 *
 * Every caller must handle `null`. A price this returns is decoration on a
 * page about real money, so a stale or invented number is worse than no
 * number: when the fetch fails, the UI falls back to showing SOL rather than
 * guessing.
 */

const WSOL = "So11111111111111111111111111111111111111112";

/*
 * Jupiter first because it prices SOL from Solana liquidity itself, which is
 * the same market the coins on this board trade in. CoinGecko is the fallback
 * rather than the primary for the same reason — it is an aggregate of mostly
 * centralised venues, close enough for a label but a step further from the
 * thing being measured.
 *
 * Sixty seconds of caching, shared by every card on the page: the figure moves
 * far less than that matters for a label, and one render must not become one
 * request per coin.
 */
const REVALIDATE_SECONDS = 60;

interface Source {
  url: string;
  read: (body: unknown) => number | undefined;
}

const SOURCES: Source[] = [
  {
    url: `https://lite-api.jup.ag/price/v3?ids=${WSOL}`,
    read: (body) => (body as Record<string, { usdPrice?: number }>)?.[WSOL]?.usdPrice,
  },
  {
    url: "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    read: (body) => (body as { solana?: { usd?: number } })?.solana?.usd,
  },
];

export async function getSolUsd(): Promise<number | null> {
  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, {
        next: { revalidate: REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;

      const value = source.read(await res.json());
      if (plausibleSolUsd(value)) return value;
    } catch {
      // Fall through to the next source; a board that renders in SOL is fine,
      // a board that throws because a price API blinked is not.
    }
  }
  return null;
}
