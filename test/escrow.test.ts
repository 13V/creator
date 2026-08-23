import assert from "node:assert/strict";
import test from "node:test";

import { decodeMasterSeed, deriveEscrowKeypair } from "../src/lib/escrow/derive";

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
