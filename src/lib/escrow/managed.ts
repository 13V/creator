import "server-only";

import { Keypair, PublicKey } from "@solana/web3.js";

import { env } from "../env";
import { PLATFORM_LABELS, type Platform, type SocialProfile } from "../social/types";
import { decodeMasterSeed, deriveEscrowKeypair } from "./derive";
import type { EscrowResolution, EscrowStrategy } from "./types";

function masterSeed(): Buffer {
  const raw = env().ESCROW_MASTER_SEED;
  if (!raw) {
    throw new Error("ESCROW_MASTER_SEED is not configured");
  }
  return decodeMasterSeed(raw);
}

/**
 * Deterministically derives the escrow keypair for a handle.
 *
 * The key is never stored, only recomputed, which means the master seed *is*
 * the custody: it belongs in a KMS/HSM in production, not an env var.
 */
export function deriveManagedEscrow(platform: Platform, handle: string): Keypair {
  return deriveEscrowKeypair(masterSeed(), platform, handle);
}

export function managedEscrowPubkey(platform: Platform, handle: string): PublicKey {
  return deriveManagedEscrow(platform, handle).publicKey;
}

/**
 * Custodial escrow for platforms pump.fun has no native social vault for.
 *
 * Fees accrue to a key this launchpad derives and can spend. That is a real
 * trust assumption and the UI says so plainly: the coin is launchable, but the
 * creator is relying on the operator to forward the funds once they verify.
 */
export const managedStrategy: EscrowStrategy = {
  kind: "managed",

  supports(): boolean {
    return Boolean(env().ESCROW_MASTER_SEED);
  },

  async resolve(profile: SocialProfile): Promise<EscrowResolution> {
    if (!env().ESCROW_MASTER_SEED) {
      return {
        ok: false,
        reason:
          `${PLATFORM_LABELS[profile.platform]} launches need ESCROW_MASTER_SEED ` +
          "configured, because pump.fun has no native fee vault for this platform.",
      };
    }

    return {
      ok: true,
      escrow: {
        kind: "managed",
        pubkey: managedEscrowPubkey(profile.platform, profile.handle),
        setupInstructions: [],
        custodyNote:
          `Fees accrue to an escrow wallet held by this launchpad on behalf of ` +
          `@${profile.handle}. It is released once they verify the account.`,
        claimRoute: "launchpad",
      },
    };
  },
};
