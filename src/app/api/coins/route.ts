import { handleError, ok, tooManyRequests } from "@/lib/api";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { countCoins, countCreators, listCoins } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const gate = checkRateLimit(`coins:${clientKey(request)}`, {
      limit: 60,
      windowMs: 60000,
    });
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

    return ok({
      coins: await listCoins(limit, offset),
      totals: { coins: await countCoins(), creators: await countCreators() },
    });
  } catch (error) {
    return handleError(error);
  }
}
