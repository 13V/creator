import assert from "node:assert/strict";
import test from "node:test";

import { planPayout, type FeeSnapshot } from "../src/lib/pump/payoutTx";

function snapshot(partial: Partial<FeeSnapshot>): FeeSnapshot {
  const bondingCurveLamports = partial.bondingCurveLamports ?? 0;
  const ammLamports = partial.ammLamports ?? 0;
  const walletLamports = partial.walletLamports ?? 0;
  return {
    bondingCurveLamports,
    ammLamports,
    walletLamports,
    claimableLamports: bondingCurveLamports + ammLamports,
    totalLamports: bondingCurveLamports + ammLamports + walletLamports,
  };
}

test("the AMM share is never moved as native lamports", () => {
  // Regression guard. The AMM vault pays in *wrapped* SOL, so counting it as
  // native overdraws the escrow and reverts the whole claim -- which left
  // creators unable to withdraw anything once any AMM fees existed.
  const steps = planPayout(
    snapshot({ bondingCurveLamports: 4_825_000, ammLamports: 20_009_000, walletLamports: 3_686_000 }),
  );

  assert.equal(steps.nativeLamports, 4_825_000 + 3_686_000);
  assert.notEqual(steps.nativeLamports, 4_825_000 + 20_009_000 + 3_686_000);
  assert.equal(steps.closeWsolAccount, true);
});

test("AMM fees always close the wrapped-SOL account", () => {
  const steps = planPayout(snapshot({ ammLamports: 1_000_000 }));
  assert.equal(steps.closeWsolAccount, true);
  assert.equal(steps.nativeLamports, 0);
});

test("bonding-curve-only fees move entirely as native lamports", () => {
  const steps = planPayout(snapshot({ bondingCurveLamports: 7_000_000 }));
  assert.equal(steps.nativeLamports, 7_000_000);
});

test("the wrapped-SOL account is closed even with no AMM fees", () => {
  // The collect instructions create it idempotently regardless, so skipping
  // the close strands a dust account and bills the creator ~0.002 SOL of rent
  // on every claim. Measured on a real payout before this was fixed.
  const steps = planPayout(snapshot({ bondingCurveLamports: 500_000, ammLamports: 0 }));
  assert.equal(steps.closeWsolAccount, true);
});

test("already-collected SOL resting in the escrow is swept too", () => {
  const steps = planPayout(snapshot({ walletLamports: 2_500_000 }));
  assert.equal(steps.nativeLamports, 2_500_000);
});
