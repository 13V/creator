import assert from "node:assert/strict";
import { test } from "node:test";

import { coinArt, seedFrom } from "../src/lib/coinArt";

const MINT = "7xQnDpu9RJhoyPzHqBv1TkmXW3aFsLc82YbNe6Zt4Mo";

test("the same mint always paints the same tile", () => {
  assert.equal(coinArt(MINT).background, coinArt(MINT).background);
});

test("different mints get different tiles", () => {
  const mints = [
    "2Drc4ZmQvKp8YxNhLw3TbGaSfR6uEjM9cVnKt5XygYy3",
    "7ENGpQvXm4RtLbYcHs2NkWaZf9uDgJ6MrToP1iSvqiiq",
    "EeXyRq8VtNcPzMwLj3oAaHbF5uDgS2mNj7yTqK4vB2iN",
    "Fjw6NtQr9VcXyLzMk1oBbHcG4uEhT3nPk8zUrL5wU9qU",
  ];
  const seen = new Set(mints.map((mint) => coinArt(mint).background));
  assert.equal(seen.size, mints.length);
});

test("the hash stays inside unsigned 32-bit range", () => {
  // Long inputs are where a signed overflow would show: past ~7 characters an
  // unclamped `hash * 31` leaves the safe integer range and every later mint
  // collapses onto the same few colours.
  for (const input of [MINT, MINT.repeat(4), "a", ""]) {
    const seed = seedFrom(input);
    assert.ok(Number.isInteger(seed), `${input}: not an integer`);
    assert.ok(seed >= 0 && seed <= 0xffffffff, `${input}: ${seed} out of range`);
  }
});

test("every seed lands on a real colour pair", () => {
  // `PAIRS[seed % PAIRS.length]` is only safe while the modulus can never be
  // negative, which is the whole reason `seedFrom` clamps.
  for (const input of ["", "z", MINT, MINT.repeat(9)]) {
    const art = coinArt(input);
    assert.match(art.stops[0], /^#[0-9a-f]{6}$/);
    assert.match(art.stops[1], /^#[0-9a-f]{6}$/);
    assert.ok(art.background.includes(art.stops[0]));
    assert.ok(art.background.includes(art.stops[1]));
  }
});
