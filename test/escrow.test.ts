import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeMasterSeed,
  deriveEscrowKeypair,
  deriveTreasuryKeypair,
  escrowSeedFingerprint,
} from "../src/lib/escrow/derive";

const SEED_A = decodeMasterSeed("a".repeat(64));
const SEED_B = decodeMasterSeed("b".repeat(64));

function key(seed: Buffer, platform: "x" | "instagram" | "tiktok", handle: string) {
  return deriveEscrowKeypair(seed, platform, handle).publicKey.toBase58();
}

test("derivation is deterministic", () => {
  assert.equal(key(SEED_A, "tiktok", "khaby.lame"), key(SEED_A, "tiktok", "khaby.lame"));
});

test("handle casing cannot split one creator across two escrows", () => {
  // Otherwise @Handle and @handle would each hold half the fees.
  assert.equal(key(SEED_A, "tiktok", "KhabY.Lame"), key(SEED_A, "tiktok", "khaby.lame"));
});

test("the same handle on different platforms gets different escrows", () => {
  assert.notEqual(key(SEED_A, "tiktok", "mrbeast"), key(SEED_A, "instagram", "mrbeast"));
});

test("different handles get different escrows", () => {
  assert.notEqual(key(SEED_A, "tiktok", "mrbeast"), key(SEED_A, "tiktok", "mrbeast2"));
});

test("a different master seed yields a completely different escrow", () => {
  assert.notEqual(key(SEED_A, "tiktok", "mrbeast"), key(SEED_B, "tiktok", "mrbeast"));
});

test("master seeds decode from hex or base64", () => {
  const hex = decodeMasterSeed("00112233445566778899aabbccddeeff");
  assert.equal(hex.length, 16);
  assert.equal(hex.toString("hex"), "00112233445566778899aabbccddeeff");

  const b64 = decodeMasterSeed(Buffer.alloc(32, 7).toString("base64"));
  assert.equal(b64.length, 32);
});

test("short master seeds are rejected", () => {
  assert.throws(() => decodeMasterSeed("abcd"), /at least 16 bytes/);
  assert.throws(() => decodeMasterSeed(""), /at least 16 bytes/);
});

test("surrounding whitespace cannot change which bytes a seed decodes to", () => {
  /*
   * The failure this guards is silent, not loud. JavaScript's `$` does not
   * match before a trailing newline, so "aaaa...\n" fails the hex test, falls
   * through to base64, and decodes to unrelated bytes without erroring. Every
   * escrow derived from those bytes sits at an address the correct seed cannot
   * reproduce, and nothing says so until a creator tries to claim.
   */
  const hex = "a".repeat(64);
  const clean = decodeMasterSeed(hex);

  for (const messy of [`${hex}\n`, ` ${hex}`, `${hex}\r\n`, `  ${hex}  `]) {
    assert.deepEqual(decodeMasterSeed(messy), clean, JSON.stringify(messy));
  }
});

test("a fingerprint identifies a seed without depending on how it was written", () => {
  const hex = "a".repeat(64);
  assert.equal(
    escrowSeedFingerprint(decodeMasterSeed(hex)),
    escrowSeedFingerprint(decodeMasterSeed(`${hex}\n`)),
  );
});

test("different seeds fingerprint differently", () => {
  assert.notEqual(escrowSeedFingerprint(SEED_A), escrowSeedFingerprint(SEED_B));
});

test("a fingerprint is short, hex, and reveals no seed material", () => {
  const print = escrowSeedFingerprint(SEED_A);
  assert.match(print, /^[0-9a-f]{16}$/);
  // The whole point is that publishing it costs nothing, so it must not be a
  // slice of the seed or of any key derived from it.
  assert.ok(!SEED_A.toString("hex").includes(print));
  assert.ok(!deriveTreasuryKeypair(SEED_A).secretKey.toString().includes(print));
});

test("the treasury is derived from the seed, not shared between seeds", () => {
  const a = deriveTreasuryKeypair(SEED_A).publicKey.toBase58();
  assert.equal(a, deriveTreasuryKeypair(SEED_A).publicKey.toBase58());
  assert.notEqual(a, deriveTreasuryKeypair(SEED_B).publicKey.toBase58());
  // ...and it must never collide with an escrow, which shares the same seed.
  assert.notEqual(a, key(SEED_A, "x", "treasury"));
});
