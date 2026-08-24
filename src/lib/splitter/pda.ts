import { createHash } from "node:crypto";

import { PublicKey } from "@solana/web3.js";

import type { Platform } from "../social/types";

/**
 * Client half of the fee-splitter program.
 *
 * Free of `server-only` so the derivations can be unit tested, and free of any
 * RPC so the same code runs in the launch path and in scripts.
 */

export const CONFIG_SEED = Buffer.from("config");
export const VAULT_SEED = Buffer.from("vault");

/** Must match `Platform::as_u8` in the program. */
export const PLATFORM_CODE: Record<Platform, number> = {
  x: 0,
  instagram: 1,
  tiktok: 2,
};

/**
 * Handles are hashed rather than used raw so the seed is a fixed 32 bytes
 * whatever the handle's length, and lowercased first so `@MrBeast` and
 * `@mrbeast` cannot end up with two different vaults.
 */
export function handleHash(handle: string): Buffer {
  return createHash("sha256").update(handle.trim().toLowerCase(), "utf8").digest();
}

export function configPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId)[0];
}

/**
 * The address a coin is launched with as pump.fun's `creator`, so every fee it
 * ever earns lands somewhere that can only split 90/10.
 */
export function vaultPda(
  programId: PublicKey,
  platform: Platform,
  handle: string,
): { pubkey: PublicKey; bump: number } {
  const [pubkey, bump] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, Buffer.from([PLATFORM_CODE[platform]]), handleHash(handle)],
    programId,
  );
  return { pubkey, bump };
}
