import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { previewEscrow } from "@/lib/escrow";
import { fetchBondingCurve } from "@/lib/pump/coin";
import { getConnection } from "@/lib/pump/connection";
import { applyFeeShare } from "@/lib/pump/setupFeeShare";
import { insertCoin, upsertCreator } from "@/lib/repo";
import { resolveProfile } from "@/lib/social/resolve";
import { PLATFORMS } from "@/lib/social/types";

export const runtime = "nodejs";

const schema = z.object({
  signature: z.string().min(32).max(128),
  mint: z.string().min(32).max(44),
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(30),
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().min(1).max(10),
  description: z.string().trim().max(500).default(""),
  metadataUri: z.string().url(),
  imageUrl: z.string().url().nullish(),
  launcher: z.string().min(32).max(44),
  devBuyLamports: z.coerce.number().int().min(0).default(0),
});

/**
 * Records a launch after confirming it on-chain.
 *
 * Nothing in the request body is trusted. The coin is only indexed once its
 * bonding curve exists and names the escrow we would have derived ourselves —
 * otherwise anyone could POST here and list a coin whose fees route to them.
 */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    let mint: PublicKey;
    try {
      mint = new PublicKey(body.mint);
    } catch {
      return fail("Invalid mint address.");
    }

    const curve = await fetchBondingCurve(mint);
    if (!curve) {
      return fail(
        "No pump.fun bonding curve found for that mint yet. If the transaction " +
          "just landed, retry in a moment.",
        409,
      );
    }

    const profile = await resolveProfile(body.platform, body.handle);
    const expected = previewEscrow(profile);
    if (!expected.available) {
      return fail(expected.reason ?? "Escrow is not configured for this platform.", 503);
    }

    if (curve.creator.toBase58() !== expected.pubkey) {
      return fail(
        "That coin's creator does not match this creator's escrow, so it was not indexed.",
        409,
      );
    }

    const status = await getConnection().getSignatureStatus(body.signature, {
      searchTransactionHistory: true,
    });
    if (!status.value || status.value.err) {
      return fail("That transaction did not confirm successfully.", 409);
    }

    const creator = await upsertCreator(profile, expected.kind, expected.pubkey);

    await insertCoin({
      mint: body.mint,
      creator_id: creator.id,
      name: body.name,
      symbol: body.symbol,
      description: body.description || null,
      metadata_uri: body.metadataUri,
      image_url: body.imageUrl ?? profile.avatarUrl,
      launcher: body.launcher,
      signature: body.signature,
      dev_buy_lamports: body.devBuyLamports,
    });

    /*
     * Split the creator fees, now that the bonding curve exists.
     *
     * Deliberately after the coin is indexed and never fatal: if this fails the
     * coin is still live and still pays its creator — in full, since without a
     * sharing config pump.fun sends everything to the creator. The platform
     * simply earns nothing on it, which is the right way round for a failure.
     */
    let feeShare;
    try {
      feeShare = await applyFeeShare({
        mint,
        platform: body.platform,
        handle: body.handle,
        escrowKind: expected.kind,
      });
    } catch (error) {
      console.error("fee share setup failed for", body.mint, error);
      feeShare = {
        applied: false,
        reason: error instanceof Error ? error.message : "Fee share setup failed.",
      };
    }

    return ok({
      indexed: true,
      mint: body.mint,
      creatorId: creator.id,
      feeShare,
    });
  } catch (error) {
    return handleError(error);
  }
}
