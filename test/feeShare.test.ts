import assert from "node:assert/strict";
import { test } from "node:test";

import { PublicKey } from "@solana/web3.js";

import {
  MAX_SHAREHOLDERS,
  ShareSplitError,
  TOTAL_BPS,
  assertValidShares,
  buildShareholders,
  canSplitFees,
  formatShare,
} from "../src/lib/pump/feeShare";

const CREATOR = new PublicKey("So11111111111111111111111111111111111111112");
const PLATFORM = new PublicKey("11111111111111111111111111111111");

test("splits 90/10 and totals exactly what pump.fun requires", () => {
  const shares = buildShareholders({
    creatorEscrow: CREATOR,
    platformWallet: PLATFORM,
    platformBps: 1_000,
  });

  assert.deepEqual(
    shares.map((s) => [s.address.toBase58(), s.shareBps]),
    [
      [CREATOR.toBase58(), 9_000],
      [PLATFORM.toBase58(), 1_000],
    ],
  );
  assert.equal(shares.reduce((n, s) => n + s.shareBps, 0), TOTAL_BPS);
  assertValidShares(shares);
});

test("an odd platform cut still totals exactly, with the remainder to the creator", () => {
  for (const bps of [1, 333, 777, 2_500, 9_999]) {
    const shares = buildShareholders({
      creatorEscrow: CREATOR,
      platformWallet: PLATFORM,
      platformBps: bps,
    });
    assert.equal(shares.reduce((n, s) => n + s.shareBps, 0), TOTAL_BPS, `bps=${bps}`);
    assert.equal(shares[1].shareBps, bps);
    assertValidShares(shares);
  }
});

test("no platform wallet means the creator takes everything", () => {
  const shares = buildShareholders({
    creatorEscrow: CREATOR,
    platformWallet: null,
    platformBps: 1_000,
  });
  assert.deepEqual(shares, [{ address: CREATOR, shareBps: TOTAL_BPS }]);
  assertValidShares(shares);
});

test("a zero cut omits the platform rather than listing it at 0 bps", () => {
  // pump.fun rejects a shareholder with no share, so it cannot just be a zero.
  const shares = buildShareholders({
    creatorEscrow: CREATOR,
    platformWallet: PLATFORM,
    platformBps: 0,
  });
  assert.equal(shares.length, 1);
  assertValidShares(shares);
});

test("refuses a cut that would leave the creator nothing", () => {
  for (const bps of [TOTAL_BPS, TOTAL_BPS + 1, -1, 1.5]) {
    assert.throws(
      () =>
        buildShareholders({
          creatorEscrow: CREATOR,
          platformWallet: PLATFORM,
          platformBps: bps,
        }),
      ShareSplitError,
      `bps=${bps} should be rejected`,
    );
  }
});

test("refuses to list the same address twice", () => {
  assert.throws(
    () =>
      buildShareholders({
        creatorEscrow: CREATOR,
        platformWallet: CREATOR,
        platformBps: 1_000,
      }),
    ShareSplitError,
  );
});

test("validation catches every rule pump.fun enforces", () => {
  assert.throws(() => assertValidShares([]), ShareSplitError, "empty");

  assert.throws(
    () => assertValidShares([{ address: CREATOR, shareBps: 5_000 }]),
    ShareSplitError,
    "must total 10000",
  );

  assert.throws(
    () =>
      assertValidShares([
        { address: CREATOR, shareBps: 10_000 },
        { address: PLATFORM, shareBps: 0 },
      ]),
    ShareSplitError,
    "zero share",
  );

  const tooMany = Array.from({ length: MAX_SHAREHOLDERS + 1 }, () => ({
    address: PublicKey.unique(),
    shareBps: 1,
  }));
  assert.throws(() => assertValidShares(tooMany), ShareSplitError, "too many");
});

test("only escrows we hold a key for can carry a split", () => {
  // `createFeeSharingConfig` is signed by the coin's creator, and a pump-social
  // escrow is a PDA of pump.fun's program that nobody can sign for.
  assert.equal(canSplitFees("managed"), true);
  assert.equal(canSplitFees("pump-social"), false);
});

test("shares render as percentages for UI copy", () => {
  assert.equal(formatShare(9_000), "90%");
  assert.equal(formatShare(1_000), "10%");
  assert.equal(formatShare(TOTAL_BPS), "100%");
  assert.equal(formatShare(333), "3.33%");
});
