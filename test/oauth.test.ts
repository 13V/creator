import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";

import {
  PROVIDERS,
  authorizeUrl,
  handleMatches,
} from "../src/lib/oauth/providers";
import {
  STATE_TTL_MS,
  challengeFor,
  decodeState,
  encodeState,
  newNonce,
  newVerifier,
  type OAuthState,
} from "../src/lib/oauth/state";

const SECRET = randomBytes(32);
const OTHER_SECRET = randomBytes(32);

function state(over: Partial<OAuthState> = {}): OAuthState {
  return {
    platform: "x",
    handle: "mrbeast",
    wallet: "CREATORWALLET1111111111111111111111111111111",
    verifier: newVerifier(),
    nonce: newNonce(),
    issuedAt: Date.now(),
    ...over,
  };
}

test("state survives a round trip intact", () => {
  const original = state();
  const result = decodeState(encodeState(original, SECRET), SECRET);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.state, original);
});

/**
 * The payload names the destination wallet, so an unsigned or forgeable state
 * would let anyone finish a sign-in and redirect the payout to themselves.
 */
test("a tampered wallet is rejected, not honoured", () => {
  const token = encodeState(state(), SECRET);
  const [payload, signature] = token.split(".");

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.wallet = "ATTACKERWALLET11111111111111111111111111111";
  const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");

  const result = decodeState(`${forged}.${signature}`, SECRET);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /did not come from here/);
});

test("a state signed with another key is rejected", () => {
  const result = decodeState(encodeState(state(), OTHER_SECRET), SECRET);
  assert.equal(result.ok, false);
});

test("a stale sign-in is refused", () => {
  const token = encodeState(state({ issuedAt: Date.now() - STATE_TTL_MS - 1 }), SECRET);
  const result = decodeState(token, SECRET);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /took too long/);
});

test("garbage is refused rather than throwing", () => {
  for (const token of ["", ".", "nodot", "a.b", "....", "x".repeat(500)]) {
    const result = decodeState(token, SECRET);
    assert.equal(result.ok, false, token.slice(0, 12));
  }
});

test("PKCE challenge is the SHA-256 of the verifier, base64url", () => {
  // An HMAC here instead of a hash would be silently accepted by our own code
  // and rejected by every provider that requires PKCE.
  const verifier = newVerifier();
  assert.equal(
    challengeFor(verifier),
    createHash("sha256").update(verifier).digest("base64url"),
  );
});

test("verifiers meet RFC 7636's length rule", () => {
  for (let i = 0; i < 50; i += 1) {
    const v = newVerifier();
    assert.ok(v.length >= 43 && v.length <= 128, `length ${v.length}`);
    assert.match(v, /^[A-Za-z0-9\-._~]+$/, "unreserved characters only");
  }
});

test("each provider builds an authorize URL its platform accepts", () => {
  for (const provider of Object.values(PROVIDERS)) {
    const url = new URL(
      authorizeUrl(provider, {
        clientId: "CLIENT",
        redirectUri: "https://backd.fun/api/oauth/cb",
        state: "STATE",
        codeChallenge: "CHALLENGE",
      }),
    );

    // TikTok names the field `client_key`; everyone else uses `client_id`.
    const idField = provider.platform === "tiktok" ? "client_key" : "client_id";
    assert.equal(url.searchParams.get(idField), "CLIENT", provider.platform);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("state"), "STATE");
    assert.ok(url.searchParams.get("scope"), `${provider.platform} has scopes`);

    if (provider.pkce) {
      assert.equal(url.searchParams.get("code_challenge"), "CHALLENGE");
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    }
  }
});

test("TikTok separates scopes with commas, the others with spaces", () => {
  const tiktok = new URL(
    authorizeUrl(PROVIDERS.tiktok, {
      clientId: "C",
      redirectUri: "https://x/cb",
      state: "S",
    }),
  );
  assert.match(tiktok.searchParams.get("scope")!, /,/);

  const x = new URL(
    authorizeUrl(PROVIDERS.x, { clientId: "C", redirectUri: "https://x/cb", state: "S" }),
  );
  assert.match(x.searchParams.get("scope")!, / /);
});

test("each provider pulls the handle out of its own response shape", () => {
  assert.deepEqual(PROVIDERS.x.parseIdentity({ data: { username: "mrbeast", id: "42" } }), {
    handle: "mrbeast",
    id: "42",
  });
  assert.deepEqual(PROVIDERS.reddit.parseIdentity({ name: "spez", id: "t2_1w72" }), {
    handle: "spez",
    id: "t2_1w72",
  });
  assert.deepEqual(PROVIDERS.instagram.parseIdentity({ username: "zendaya", id: "9" }), {
    handle: "zendaya",
    id: "9",
  });
  assert.deepEqual(
    PROVIDERS.tiktok.parseIdentity({ data: { user: { username: "khaby", open_id: "o1" } } }),
    { handle: "khaby", id: "o1" },
  );
});

test("an identity with no handle is null rather than a blank match", () => {
  for (const provider of Object.values(PROVIDERS)) {
    assert.equal(provider.parseIdentity({}), null, provider.platform);
    assert.equal(provider.parseIdentity(null), null, provider.platform);
    assert.equal(provider.parseIdentity({ data: {} }), null, provider.platform);
  }
});

/** The check that stops someone signing in as themselves to claim @mrbeast. */
test("only the account that signed in can claim its own handle", () => {
  assert.equal(handleMatches("mrbeast", "MrBeast"), true, "case is not identity");
  assert.equal(handleMatches("@mrbeast", "mrbeast"), true, "a leading @ is noise");
  assert.equal(handleMatches("  mrbeast ", "mrbeast"), true);

  assert.equal(handleMatches("mrbeast", "mrbeast1"), false);
  assert.equal(handleMatches("mrbeast", "mr_beast"), false);
  assert.equal(handleMatches("mrbeast", ""), false);
  assert.equal(handleMatches("", "mrbeast"), false);
});
