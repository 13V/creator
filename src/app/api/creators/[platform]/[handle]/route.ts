import { PublicKey } from "@solana/web3.js";

import { fail, handleError, ok } from "@/lib/api";
import { previewEscrow } from "@/lib/escrow";
import { getFeeSnapshot } from "@/lib/pump/fees";
import { getCreator, listCoinsByCreator, listPayouts } from "@/lib/repo";
import { resolveProfile } from "@/lib/social/resolve";
import { isPlatform } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string; handle: string }> },
) {
  try {
    const { platform, handle } = await params;
    if (!isPlatform(platform)) return fail("Unknown platform.", 404);

    const profile = await resolveProfile(platform, handle);
    const escrow = previewEscrow(profile);
    const record = await getCreator(platform, handle);

    // Fees live on-chain, so they are readable even for a creator we have
    // never indexed — someone may have launched their coin elsewhere.
    const escrowPubkey = record?.escrow_pubkey ?? (escrow.available ? escrow.pubkey : null);
    const fees = escrowPubkey
      ? await getFeeSnapshot(new PublicKey(escrowPubkey)).catch(() => null)
      : null;

    return ok({
      profile,
      escrow,
      creator: record,
      coins: record ? await listCoinsByCreator(record.id) : [],
      payouts: record ? await listPayouts(record.id) : [],
      fees,
    });
  } catch (error) {
    return handleError(error);
  }
}
