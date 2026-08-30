import { fail, handleError, ok } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import {
  decodeMasterSeed,
  deriveTreasuryKeypair,
  escrowSeedFingerprint,
} from "@/lib/escrow/derive";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports which master seed this deployment is actually running on.
 *
 * ESCROW_MASTER_SEED is the single piece of custody for every managed escrow —
 * Reddit, Instagram and TikTok, where pump.fun has no native social vault (only
 * X gets one) — and it is
 * never written down anywhere the app can read back. That leaves two ways to
 * lose the money silently: keeping no offline copy at all, and keeping one that
 * is not the seed production is deriving from. The second is the likelier of
 * the two and the harder to notice, because a wrong seed produces perfectly
 * valid-looking escrow addresses; it just produces different ones, and nothing
 * complains until a creator tries to claim and the vault is empty.
 *
 * So this returns identifiers rather than the secret: a fingerprint derived
 * under its own HKDF label, and the treasury public key, which is a real
 * on-chain address anyone can check. Run `npm run escrow:fingerprint` against
 * the offline backup and compare. Matching values mean the backup can restore
 * this deployment; differing ones mean the backup is worthless and you have
 * found that out while it is still fixable.
 *
 * Deliberately says nothing that helps recover the seed: no bytes, no prefix,
 * no encoding — only its length, which is what tells you whether a paste was
 * truncated.
 */
export async function GET(request: Request) {
  try {
    if (!isAdmin(request)) return fail("Not authorised.", 401);

    const raw = env().ESCROW_MASTER_SEED;
    if (!raw) {
      return ok({
        configured: false,
        note:
          "No ESCROW_MASTER_SEED is set. Managed escrows for Reddit, " +
          "Instagram and TikTok cannot be derived, so those platforms " +
          "cannot take launches.",
      });
    }

    const seed = decodeMasterSeed(raw);

    return ok({
      configured: true,
      fingerprint: escrowSeedFingerprint(seed),
      treasury: deriveTreasuryKeypair(seed).publicKey.toBase58(),
      seedBytes: seed.length,
      /*
       * Surfaced because a seed that arrived with surrounding whitespace used
       * to decode to different bytes entirely, and the decoder now trims. If
       * this is true, the stored value is being repaired on every read — fix
       * the variable rather than relying on that.
       */
      hadSurroundingWhitespace: raw !== raw.trim(),
    });
  } catch (error) {
    return handleError(error);
  }
}
