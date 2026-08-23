import { handleError, ok } from "@/lib/api";
import { countCoins, countCreators, listCoins } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

    return ok({
      coins: listCoins(limit, offset),
      totals: { coins: countCoins(), creators: countCreators() },
    });
  } catch (error) {
    return handleError(error);
  }
}
