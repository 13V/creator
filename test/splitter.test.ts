import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { PublicKey } from "@solana/web3.js";

import { configPda, handleHash, vaultPda } from "../src/lib/splitter/pda";
import type { Platform } from "../src/lib/social/types";

/**
 * Cross-checks the TypeScript derivations against addresses produced by the
 * Rust program itself (`cargo test emit_pda_fixtures`).
 *
 * This is the one mismatch with no remedy. pump.fun fixes a coin's `creator`
 * permanently at launch, so a launcher that derives a vault the program does
 * not control strands that coin's fees for good — there is no instruction, on
 * our side or pump.fun's, that can move them afterwards.
 */
const fixtures = JSON.parse(
  readFileSync(
    join(process.cwd(), "programs/fee-splitter/tests/pda-fixtures.json"),
    "utf8",
  ),
) as {
  programId: string;
  config: string;
  vaults: { platform: Platform; handle: string; pubkey: string; bump: number }[];
};

const PROGRAM_ID = new PublicKey(fixtures.programId);

test("config PDA matches the program", () => {
  assert.equal(configPda(PROGRAM_ID).toBase58(), fixtures.config);
});

for (const vault of fixtures.vaults) {
  test(`vault PDA matches the program for ${vault.platform}/${vault.handle}`, () => {
    const derived = vaultPda(PROGRAM_ID, vault.platform, vault.handle);
    assert.equal(derived.pubkey.toBase58(), vault.pubkey);
    assert.equal(derived.bump, vault.bump);
  });
}

test("handles fold to one vault regardless of case or padding", () => {
  const canonical = vaultPda(PROGRAM_ID, "x", "mrbeast").pubkey.toBase58();
  for (const variant of ["MrBeast", "  MrBeast  ", "MRBEAST", "mrBeast"]) {
    assert.equal(
      vaultPda(PROGRAM_ID, "x", variant).pubkey.toBase58(),
      canonical,
      `${variant} must not get its own vault`,
    );
  }
});

test("different platforms with the same handle get different vaults", () => {
  const onX = vaultPda(PROGRAM_ID, "x", "same").pubkey.toBase58();
  const onInstagram = vaultPda(PROGRAM_ID, "instagram", "same").pubkey.toBase58();
  const onTikTok = vaultPda(PROGRAM_ID, "tiktok", "same").pubkey.toBase58();
  assert.equal(new Set([onX, onInstagram, onTikTok]).size, 3);
});

test("handle hash is a fixed 32 bytes whatever the handle length", () => {
  assert.equal(handleHash("a").length, 32);
  assert.equal(handleHash("a".repeat(500)).length, 32);
});
