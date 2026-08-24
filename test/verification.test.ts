import assert from "node:assert/strict";
import { test } from "node:test";

import {
  VERIFICATION_TTL_MS,
  checkPending,
  codeIsPresent,
  generateVerificationCode,
} from "../src/lib/verify/policy";
import type { VerificationRow } from "../src/lib/repo";

function pending(over: Partial<VerificationRow> = {}): VerificationRow {
  return {
    creator_id: 1,
    wallet: "CREATORWALLET1111111111111111111111111111111",
    code: "pcl-abc123",
    started_at: Date.now(),
    ...over,
  };
}

/**
 * The attack this guards against.
 *
 * The code is published in a public bio, so a bystander can always read it.
 * What must not follow is a payout to their wallet: looking the code up by
 * handle alone let whoever saw it first take the escrow.
 */
test("a wallet with no pending code cannot verify, however valid the code is", () => {
  // The route hands `null` through when no code was issued for this wallet.
  const result = checkPending(null);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /No verification is in progress for that wallet/);
    assert.equal(result.retryable, false, "not a try-again: it is the wrong wallet");
  }
});

test("an expired code is refused rather than retried", () => {
  const result = checkPending(pending({ started_at: Date.now() - VERIFICATION_TTL_MS - 1 }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /expired/);
    assert.equal(result.retryable, false);
  }
});

test("a code still inside its window passes the gate", () => {
  const result = checkPending(pending({ started_at: Date.now() - VERIFICATION_TTL_MS + 60_000 }));
  assert.equal(result.ok, true);
});

test("the code must appear in a field only the owner can edit", () => {
  const row = pending();
  assert.equal(codeIsPresent(row, { bio: `hello ${row.code} world` }), true);
  assert.equal(codeIsPresent(row, { displayName: row.code.toUpperCase() }), true);
  assert.equal(codeIsPresent(row, { bio: "nothing here" }), false);
  assert.equal(codeIsPresent(row, {}), false);
});

test("one creator's code never satisfies another wallet's claim", () => {
  // Both wallets have a live verification, each with its own code. Neither
  // code can stand in for the other, which is what stops a bystander who read
  // the creator's bio from claiming to a wallet of their own.
  const creators = pending({ wallet: "CREATOR", code: "pcl-1111111111" });
  const attacker = pending({ wallet: "ATTACKER", code: "pcl-2222222222" });

  assert.equal(codeIsPresent(attacker, { bio: `posted ${creators.code}` }), false);
  assert.equal(codeIsPresent(creators, { bio: `posted ${creators.code}` }), true);
});

test("codes are unguessable and distinct", () => {
  const codes = new Set(Array.from({ length: 200 }, generateVerificationCode));
  assert.equal(codes.size, 200, "no collisions across 200 codes");
  for (const code of codes) {
    assert.match(code, /^pcl-[0-9a-f]{10}$/, "40 bits of entropy, prefixed");
  }
});
