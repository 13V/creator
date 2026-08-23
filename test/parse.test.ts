import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidHandle,
  normalizeHandle,
  parseSocialInput,
  profileUrl,
} from "../src/lib/social/parse";

test("parses profile URLs across platforms", () => {
  assert.deepEqual(parseSocialInput("https://x.com/mrbeast"), {
    platform: "x",
    handle: "mrbeast",
  });
  assert.deepEqual(parseSocialInput("https://twitter.com/MrBeast"), {
    platform: "x",
    handle: "MrBeast",
  });
  assert.deepEqual(parseSocialInput("https://www.tiktok.com/@khaby.lame"), {
    platform: "tiktok",
    handle: "khaby.lame",
  });
  assert.deepEqual(parseSocialInput("https://instagram.com/leomessi/"), {
    platform: "instagram",
    handle: "leomessi",
  });
});

test("tolerates the shapes people actually paste", () => {
  // No scheme.
  assert.deepEqual(parseSocialInput("x.com/mrbeast"), {
    platform: "x",
    handle: "mrbeast",
  });
  // Tracking params and trailing slashes.
  assert.deepEqual(parseSocialInput("https://x.com/mrbeast?s=20&t=abc"), {
    platform: "x",
    handle: "mrbeast",
  });
  // A deep link rather than the profile root.
  assert.deepEqual(parseSocialInput("https://www.tiktok.com/@khaby.lame/video/12345"), {
    platform: "tiktok",
    handle: "khaby.lame",
  });
  // Explicit platform prefix.
  assert.deepEqual(parseSocialInput("x:@mrbeast"), {
    platform: "x",
    handle: "mrbeast",
  });
});

test("bare handles need a platform hint", () => {
  assert.equal(parseSocialInput("@mrbeast"), null);
  assert.deepEqual(parseSocialInput("@mrbeast", "x"), {
    platform: "x",
    handle: "mrbeast",
  });
});

test("rejects site chrome that is not a profile", () => {
  // Escrowing fees to `x.com/settings` would strand them forever.
  assert.equal(parseSocialInput("https://x.com/settings"), null);
  assert.equal(parseSocialInput("https://x.com/i/flow/login"), null);
  assert.equal(parseSocialInput("https://instagram.com/explore"), null);
  // TikTok profiles always carry an @; /foryou is a feed.
  assert.equal(parseSocialInput("https://www.tiktok.com/foryou"), null);
});

test("rejects unsupported hosts and malformed input", () => {
  assert.equal(parseSocialInput("https://youtube.com/@mrbeast"), null);
  assert.equal(parseSocialInput("https://x.com/"), null);
  assert.equal(parseSocialInput(""), null);
  assert.equal(parseSocialInput("   "), null);
});

test("enforces each platform's handle rules", () => {
  // X handles cap at 15 characters.
  assert.equal(isValidHandle("x", "a".repeat(15)), true);
  assert.equal(isValidHandle("x", "a".repeat(16)), false);
  // X allows no dots; Instagram and TikTok do.
  assert.equal(isValidHandle("x", "khaby.lame"), false);
  assert.equal(isValidHandle("tiktok", "khaby.lame"), true);
  // Dots may not lead, trail, or repeat.
  assert.equal(isValidHandle("instagram", ".leo"), false);
  assert.equal(isValidHandle("instagram", "leo."), false);
  assert.equal(isValidHandle("instagram", "leo..messi"), false);
});

test("normalizeHandle strips @ and case", () => {
  assert.equal(normalizeHandle("@MrBeast"), "mrbeast");
  assert.equal(normalizeHandle("  @@khaby.lame "), "khaby.lame");
});

test("profileUrl round-trips back to a parseable link", () => {
  for (const [platform, handle] of [
    ["x", "mrbeast"],
    ["instagram", "leomessi"],
    ["tiktok", "khaby.lame"],
  ] as const) {
    const parsed = parseSocialInput(profileUrl(platform, handle));
    assert.deepEqual(parsed, { platform, handle });
  }
});
