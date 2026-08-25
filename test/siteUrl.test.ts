import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveSiteUrl } from "../src/lib/siteUrl";

test("uses the first usable candidate", () => {
  assert.equal(
    resolveSiteUrl(["https://backd.fun", "https://ignored.example"]).origin,
    "https://backd.fun",
  );
});

test("treats blank and whitespace-only values as unset", () => {
  // The exact shape Vercel produces for a variable you left empty in the UI.
  assert.equal(resolveSiteUrl(["", "   ", "backd.fun"]).origin, "https://backd.fun");
});

test("adds a scheme to the bare hostnames Vercel exposes", () => {
  assert.equal(resolveSiteUrl(["creator-abc123.vercel.app"]).origin, "https://creator-abc123.vercel.app");
});

test("skips a candidate that is not a URL at all", () => {
  assert.equal(resolveSiteUrl(["http://", "https://backd.fun"]).origin, "https://backd.fun");
});

test("falls back to localhost rather than throwing", () => {
  assert.equal(resolveSiteUrl([]).origin, "http://localhost:3000");
  assert.equal(resolveSiteUrl([undefined, ""]).origin, "http://localhost:3000");
});
