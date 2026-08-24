import { hkdfSync } from "node:crypto";
import { Keypair } from "@solana/web3.js";

import type { Platform } from "../social/types";

const HKDF_INFO_PREFIX = "creator-launchpad/escrow/v1";

/**
 * Decodes the operator's master seed, accepting hex or base64 so it can be
 * pasted straight from `openssl rand`.
 */
export function decodeMasterSeed(raw: string): Buffer {
  const buf =
    /^[0-9a-f]+$/i.test(raw) && raw.length % 2 === 0
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
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
