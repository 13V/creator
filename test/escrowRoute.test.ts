import assert from "node:assert/strict";
import { test } from "node:test";

import { pumpSocialUserId, routeEscrow, supportsPumpSocial } from "../src/lib/escrow/route";
import type { Platform, SocialProfile } from "../src/lib/social/types";

/**
 * The branch that decides who can move a creator's money.
 *
 * `pump-social` means a pump.fun PDA nobody here holds a key to. `managed`
 * means a wallet this launchpad custodies. Getting this wrong does not throw
 * or fail a build — it silently changes who can withdraw, which is why it is
 * worth this many cases.
 */
function profile(over: Partial<SocialProfile> = {}): SocialProfile {
  return {
    platform: "x",
    handle: "naval",
    platformUserId: "745273",
    displayName: "Naval",
    avatarUrl: null,
    bio: null,
    followers: null,
    profileUrl: "https://x.com/naval",
    verifiedUpstream: true,
    ...over,
  };
}

const WITH_SEED = { managedAvailable: true };
const NO_SEED = { managedAvailable: false };

test("an X profile with a confirmed numeric id gets the native vault", () => {
  assert.equal(routeEscrow(profile(), WITH_SEED), "pump-social");
  assert.equal(pumpSocialUserId(profile()), "745273");
});

test("without the numeric id an X profile falls back to a managed escrow", () => {
  /*
   * This is the live configuration, not a hypothetical: the id comes from X's
   * paid API, and with no funded token every X launch lands here. The Risks
   * and Terms pages say so because of this branch.
   */
  assert.equal(routeEscrow(profile({ platformUserId: null }), WITH_SEED), "managed");
  assert.equal(supportsPumpSocial(profile({ platformUserId: null })), false);
});

test("a handle alone never reaches the native vault", () => {
  // The vault is a PDA over the numeric id. A handle where an id belongs
  // would derive a vault keyed to nothing, and fees would accrue somewhere
  // the real creator could never claim from.
  assert.equal(supportsPumpSocial(profile({ platformUserId: "naval" })), false);
  assert.equal(supportsPumpSocial(profile({ platformUserId: "745273a" })), false);
  assert.equal(supportsPumpSocial(profile({ platformUserId: " 745273" })), false);
  assert.equal(supportsPumpSocial(profile({ platformUserId: "745273\n" })), false);
  assert.equal(supportsPumpSocial(profile({ platformUserId: "" })), false);
});

test("an id longer than pump.fun's 20-character cap is refused, not truncated", () => {
  // Truncating would derive a *valid-looking* vault for the wrong account.
  assert.equal(supportsPumpSocial(profile({ platformUserId: "1".repeat(20) })), true);
  assert.equal(supportsPumpSocial(profile({ platformUserId: "1".repeat(21) })), false);
});

test("no other platform reaches the native vault, id or not", () => {
  // pump.fun's social vault is X-only. A Reddit id that happened to be numeric
  // must not be mistaken for one.
  for (const platform of ["reddit", "instagram", "tiktok"] as Platform[]) {
    assert.equal(
      routeEscrow(profile({ platform, platformUserId: "745273" }), WITH_SEED),
      "managed",
      platform,
    );
  }
});

test("with no seed configured a non-native launch is unavailable, not managed", () => {
  /*
   * Returning "managed" here would name an escrow address nobody holds the key
   * to derive, and the launch would put real fees behind it.
   */
  assert.equal(routeEscrow(profile({ platformUserId: null }), NO_SEED), "unavailable");
  assert.equal(routeEscrow(profile({ platform: "tiktok" }), NO_SEED), "unavailable");
});

test("the native path does not need a seed", () => {
  // Nothing is custodied, so there is nothing to derive.
  assert.equal(routeEscrow(profile(), NO_SEED), "pump-social");
});

test("an unverified upstream lookup does not change custody", () => {
  /*
   * `verifiedUpstream` is a UI badge. It once looked like it gated the native
   * path; it does not, and a test is cheaper than rediscovering that from the
   * board.
   */
  assert.equal(routeEscrow(profile({ verifiedUpstream: false }), WITH_SEED), "pump-social");
});
