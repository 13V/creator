import assert from "node:assert/strict";
import test from "node:test";

import {
  ESCROW_RENT_LAMPORTS,
  claimableLamports,
  planPayout,
  type FeeSnapshot,
} from "../src/lib/pump/payoutTx";

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
  const wallet = ESCROW_RENT_LAMPORTS + 3_686_000;
  const steps = planPayout(
    snapshot({ bondingCurveLamports: 4_825_000, ammLamports: 20_009_000, walletLamports: wallet }),
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
  const steps = planPayout(
    snapshot({ walletLamports: ESCROW_RENT_LAMPORTS + 2_500_000 }),
  );
  assert.equal(steps.nativeLamports, 2_500_000);
});

test("the escrow keeps its own rent rather than being drained", () => {
  // The launch funds the escrow to its rent floor so it can pay for the coin's
  // fee-sharing config. Paying that out would destroy the account, making the
  // creator's next coin buy the rent again, and would count the launcher's
  // float as creator earnings.
  const steps = planPayout(snapshot({ walletLamports: ESCROW_RENT_LAMPORTS + 5_000_000 }));
  assert.equal(steps.nativeLamports, 5_000_000);
});

test("an escrow holding only its rent float has nothing to claim", () => {
  const bare = snapshot({ walletLamports: ESCROW_RENT_LAMPORTS });
  assert.equal(claimableLamports(bare), 0);
  assert.equal(planPayout(bare).nativeLamports, 0);
});

test("claimable never goes negative on an under-funded escrow", () => {
  const thin = snapshot({ walletLamports: 1_000 });
  assert.equal(claimableLamports(thin), 0);
  assert.equal(planPayout(thin).nativeLamports, 0);
});

test("AMM fees still count as claimable even with no native balance", () => {
  const ammOnly = snapshot({ ammLamports: 3_000_000 });
  assert.equal(claimableLamports(ammOnly), 3_000_000);
});
