import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { Platform } from "../social/types";

/**
 * The `state` parameter carried through an OAuth round trip.
 *
 * It is signed rather than stored. A serverless deployment has no memory
 * between the redirect out and the callback back, and the alternatives — a
 * database row or a shared cache — are more moving parts for something a
 * short-lived HMAC covers completely.
 *
 * Signing matters as much as the CSRF nonce does: the payload names the
 * destination wallet, so an unsigned state would let anyone finish a sign-in
 * and redirect the payout to an address of their choosing.
 *
 * Free of `server-only` so the encode/decode round trip can be tested.
 */

/** A sign-in that has not come back within this is stale, not in progress. */
export const STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthState {
  platform: Platform;
  /** The handle being claimed, so the callback can check who signed in. */
  handle: string;
  /** Where the creator wants to be paid. */
  wallet: string;
  /** PKCE verifier, for the providers that require it. */
  verifier: string | null;
  /** Guards against a replayed or cross-site callback. */
  nonce: string;
  issuedAt: number;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function sign(payload: string, secret: Buffer): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

export function encodeState(state: OAuthState, secret: Buffer): string {
  const payload = base64url(Buffer.from(JSON.stringify(state), "utf8"));
  return `${payload}.${sign(payload, secret)}`;
}

export type StateResult =
  | { ok: true; state: OAuthState }
  | { ok: false; reason: string };

export function decodeState(
  token: string,
  secret: Buffer,
  now = Date.now(),
): StateResult {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "Malformed sign-in state." };

  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload, secret));

  // Length has to match before a timing-safe compare will even run, and an
  // unequal length is already a failure.
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return { ok: false, reason: "That sign-in did not come from here." };
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "Malformed sign-in state." };
  }

  if (typeof state.issuedAt !== "number" || now - state.issuedAt > STATE_TTL_MS) {
    return { ok: false, reason: "That sign-in took too long. Start again." };
  }

  return { ok: true, state };
}

export function newNonce(): string {
  return base64url(randomBytes(16));
}

/** PKCE verifier: 43-128 unreserved characters, per RFC 7636. */
export function newVerifier(): string {
  return base64url(randomBytes(48));
}

/** PKCE S256 challenge: BASE64URL(SHA256(verifier)), per RFC 7636 §4.2. */
export function challengeFor(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}
