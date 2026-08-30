import type { SocialProfile } from "../social/types";

/**
 * Which escrow a profile is entitled to, as a pure decision.
 *
 * This is the single most consequential branch in the product — it decides
 * whether a creator's fees land somewhere nobody can touch or somewhere this
 * launchpad holds the key — and it lived inline in a module that imports
 * `server-only` and the Solana SDK, so it could not be tested. It is here so
 * it can be, and `pumpSocial.supports` and `previewEscrow` both read from it
 * rather than each carrying their own copy of the rule.
 */

/** pump.fun caps the social vault's user id at 20 characters. */
const MAX_USER_ID_LEN = 20;

/**
 * The numeric id pump.fun's native social vault would be derived from, or
 * null if this profile has no such vault.
 *
 * Returns the id rather than a boolean so callers cannot end up re-checking
 * `platformUserId` to satisfy the type system and accidentally encoding a
 * second, subtly different version of the rule.
 *
 * A handle is never enough: the vault is a PDA over the creator's *numeric*
 * platform id, so without a confirmed id there is nothing to derive, whatever
 * the platform. That id comes from X's paid API, which is why an unfunded
 * deployment routes every launch — X included — to a managed escrow.
 */
export function pumpSocialUserId(profile: SocialProfile): string | null {
  const id = profile.platformUserId;
  if (profile.platform !== "x" || !id) return null;
  if (!/^\d+$/.test(id) || id.length > MAX_USER_ID_LEN) return null;
  return id;
}

/** Whether pump.fun's native social vault is reachable for this profile. */
export function supportsPumpSocial(profile: SocialProfile): boolean {
  return pumpSocialUserId(profile) !== null;
}

export type EscrowRoute = "pump-social" | "managed" | "unavailable";

/**
 * The escrow a profile gets, given what this deployment is configured for.
 *
 * `managedAvailable` is whether ESCROW_MASTER_SEED is set. With neither route
 * open the answer is `unavailable` rather than a managed escrow nobody has the
 * seed to derive — a launch that cannot name a destination for the fees must
 * not proceed.
 */
export function routeEscrow(
  profile: SocialProfile,
  { managedAvailable }: { managedAvailable: boolean },
): EscrowRoute {
  if (supportsPumpSocial(profile)) return "pump-social";
  if (managedAvailable) return "managed";
  return "unavailable";
}
