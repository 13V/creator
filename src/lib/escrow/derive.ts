import { hkdfSync } from "node:crypto";
import { Keypair } from "@solana/web3.js";

import type { Platform } from "../social/types";

const HKDF_INFO_PREFIX = "creator-launchpad/escrow/v1";

/**
 * Decodes the operator's master seed, accepting hex or base64 so it can be
 * pasted straight from `openssl rand`.
 */
export function decodeMasterSeed(raw: string): Buffer {
  /*
   * Trimmed first, because the untrimmed path fails silently rather than
   * loudly. JavaScript's `$` does not match before a trailing newline, so a
   * seed pasted out of a terminal as "deadbeef\n" fails the hex test, falls
   * through to the base64 branch, and decodes to entirely different bytes
   * without erroring. Every escrow derived from those bytes would sit at an
   * address the correct seed cannot reproduce — custody lost with no symptom
   * until a creator tries to claim.
   */
  const value = raw.trim();
  const buf =
    /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0
      ? Buffer.from(value, "hex")
      : Buffer.from(value, "base64");
  if (buf.length < 16) {
    throw new Error("ESCROW_MASTER_SEED must decode to at least 16 bytes");
  }
  return buf;
}

/**
 * Deterministically derives a managed escrow keypair.
 *
 * Pure and side-effect free: the key is never stored, only recomputed, so the
 * master seed is the sole piece of custody that has to be protected.
 * Handles are lower-cased so `@Handle` and `@handle` cannot end up with two
 * different escrows holding half the fees each.
 */
export function deriveEscrowKeypair(
  masterSeed: Buffer,
  platform: Platform,
  handle: string,
): Keypair {
  const info = `${HKDF_INFO_PREFIX}:${platform}:${handle.toLowerCase()}`;
  const derived = hkdfSync("sha256", masterSeed, Buffer.alloc(0), info, 32);
  return Keypair.fromSeed(new Uint8Array(derived));
}

const HKDF_INFO_TREASURY = "creator-launchpad/treasury/v1";

/**
 * Derives the platform's treasury wallet from the same master seed.
 *
 * A fallback for when `PLATFORM_FEE_WALLET` is unset, so the platform's share
 * of creator fees has somewhere to land without introducing a second secret to
 * lose. The label is distinct from the escrow prefix, so this can never
 * collide with a creator's escrow.
 *
 * Set `PLATFORM_FEE_WALLET` explicitly to use a wallet held somewhere else —
 * a hardware wallet or a multisig — which is the better arrangement once the
 * treasury holds anything worth taking.
 */
export function deriveTreasuryKeypair(masterSeed: Buffer): Keypair {
  const derived = hkdfSync("sha256", masterSeed, Buffer.alloc(0), HKDF_INFO_TREASURY, 32);
  return Keypair.fromSeed(new Uint8Array(derived));
}

const HKDF_INFO_FINGERPRINT = "creator-launchpad/fingerprint/v1";

/**
 * A short, non-reversible identifier for a master seed.
 *
 * The seed cannot be checked by reading it back — nobody should be pasting it
 * anywhere to compare — but an offline backup is worthless if it is not the
 * same seed production is deriving from, and a paste error is invisible until
 * a creator cannot claim. This gives the backup and the running deployment a
 * value they can each print and be compared by eye.
 *
 * Derived through HKDF under its own label, so it shares no key material with
 * any escrow or the treasury, and truncated to 16 hex characters: enough that
 * two different seeds will not collide by accident, short enough to read out.
 */
export function escrowSeedFingerprint(masterSeed: Buffer): string {
  const derived = hkdfSync("sha256", masterSeed, Buffer.alloc(0), HKDF_INFO_FINGERPRINT, 32);
  return Buffer.from(derived).toString("hex").slice(0, 16);
}
