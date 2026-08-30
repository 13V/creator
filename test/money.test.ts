import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSol, formatUsd, lamportsToSol, plausibleSolUsd } from "../src/lib/money";

const SOL = 1_000_000_000;

test("no price means no dollar figure, not a zero", () => {
  /*
   * The whole contract of this function. A card that renders "$0" against a
   * balance that is really 4 SOL is a lie about money; returning null makes
   * the caller fall back to SOL.
   */
  assert.equal(formatUsd(4 * SOL, null), null);
  assert.equal(formatUsd(4 * SOL, undefined), null);
  assert.equal(formatUsd(4 * SOL, 0), null);
});

test("dust reads as dust rather than rounding to nothing", () => {
  assert.equal(formatUsd(1_000, 200), "<$0.01");
  assert.equal(formatSol(1_000), "<0.0001");
});

test("a genuinely empty balance is zero, not dust", () => {
  assert.equal(formatUsd(0, 200), "$0");
  assert.equal(formatSol(0), "0");
});

test("precision drops as the figure grows", () => {
  assert.equal(formatUsd(SOL / 10, 200), "$20.00");
  assert.equal(formatUsd(SOL * 2, 200), "$400");
  assert.equal(formatUsd(SOL * 25, 200), "$5.0K");
  assert.equal(formatUsd(SOL * 500, 200), "$100K");
  assert.equal(formatUsd(SOL * 25_000, 200), "$5.00M");
  assert.equal(formatUsd(SOL * 500_000, 200), "$100.0M");
  assert.equal(formatUsd(SOL * 25_000_000, 200), "$5.00B");
});

test("every bucket boundary lands in exactly one bucket", () => {
  // Off-by-one here would print "$100.00" and "$1000" — the two shapes the
  // thresholds exist to avoid.
  assert.equal(formatUsd(SOL, 100), "$100");
  assert.equal(formatUsd(SOL, 99.99), "$99.99");
  assert.equal(formatUsd(SOL, 1_000), "$1.0K");
  assert.equal(formatUsd(SOL, 999), "$999");
  assert.equal(formatUsd(SOL, 1_000_000), "$1.00M");
  assert.equal(formatUsd(SOL, 1_000_000_000), "$1.00B");
});

test("SOL formatting trims trailing zeros without eating the number", () => {
  assert.equal(formatSol(SOL / 2), "0.5");
  assert.equal(formatSol(SOL / 4), "0.25");
  // 0.1 SOL is 0.1000 before the trim; a greedy trim would leave "0.1" — right
  // — but the same regex applied to 100 SOL must not leave "1".
  assert.equal(formatSol(SOL / 10), "0.1");
  assert.equal(formatSol(SOL * 100), "100.00");
  assert.equal(formatSol(SOL * 1_000), "1,000");
});

test("lamportsToSol is exact rather than rounded for display", () => {
  assert.equal(lamportsToSol(SOL), "1.0000");
  assert.equal(lamportsToSol(1, 9), "0.000000001");
});

test("the price band rejects what a broken source returns", () => {
  /*
   * Each of these is a real failure shape: an API that starts answering 0, one
   * that returns the number as a string, one that returns an error object, and
   * one that returns a value no sane market produces. Any of them would be
   * rendered to a user as fact.
   */
  assert.equal(plausibleSolUsd(0), false);
  assert.equal(plausibleSolUsd("200"), false);
  assert.equal(plausibleSolUsd(null), false);
  assert.equal(plausibleSolUsd(undefined), false);
  assert.equal(plausibleSolUsd({ usd: 200 }), false);
  assert.equal(plausibleSolUsd(NaN), false);
  assert.equal(plausibleSolUsd(Infinity), false);
  assert.equal(plausibleSolUsd(-200), false);
  assert.equal(plausibleSolUsd(1_000_000), false);
});

test("the price band accepts prices SOL has actually traded at", () => {
  // Deliberately wide: this catches a broken response shape, it does not have
  // an opinion about the market.
  for (const price of [0.5, 8, 26, 130, 200, 260, 5_000]) {
    assert.equal(plausibleSolUsd(price), true, `rejected ${price}`);
  }
});
