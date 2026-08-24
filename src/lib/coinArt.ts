/**
 * Artwork for a coin that has no image.
 *
 * Most launches never upload one, and a shared fallback means a board of them
 * is a wall of identical tiles. The old fallback stamped the ticker across a
 * fixed blue gradient, which read as a missing-image placeholder rather than
 * as artwork — and at four columns the repeated monogram was the loudest thing
 * on the page.
 *
 * So each coin gets its own two-hue wash instead, picked deterministically
 * from its mint. Same coin, same colours, on every render and every device —
 * no state, no storage, and no flash of a different tile on hydration.
 *
 * Kept free of `server-only` and of React so the mapping can be tested, and so
 * the OG image route can paint the same tile the site does.
 */

/*
 * Four deep tints of the palette's own semantic colours, not a separate
 * pastel set.
 *
 * There were twelve hand-picked pastel pairs — baby blue, peach, lavender,
 * mint — a palette that existed nowhere else in the product and read as
 * "generate me an avatar". These are drawn from the accent, money, down and
 * caution hues at low lightness, so a board of fallbacks looks like it belongs
 * to the same interface as the numbers on top of it.
 */
const PAIRS: readonly (readonly [string, string])[] = [
  ["#16324a", "#1d2740"],
  ["#123a2c", "#16303f"],
  ["#3a1c28", "#2a1a36"],
  ["#3a2f14", "#25301c"],
];

/**
 * FNV-style rolling hash over the mint.
 *
 * `>>> 0` after every step keeps it in unsigned 32-bit range; without it the
 * multiply overflows into the float range and neighbouring mints start
 * colliding on the same colour.
 */
export function seedFrom(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export interface CoinArt {
  /** Ready for a `background` declaration. */
  background: string;
  /** The two stops, for anywhere that needs the colours rather than the CSS. */
  stops: readonly [string, string];
}

/**
 * The wash for one coin.
 *
 * Two layers: the colour pair on a rotated axis, and a faint lift across the
 * top-left corner so the tile has a lit side rather than reading as a flat
 * swatch. Kept dark enough that a real uploaded image beside it is obviously
 * the brighter object — a placeholder should never outshine the content it
 * stands in for.
 */
export function coinArt(key: string): CoinArt {
  const seed = seedFrom(key);
  const stops = PAIRS[seed % PAIRS.length];
  const angle = 120 + (seed % 5) * 12;

  return {
    background:
      `linear-gradient(35deg, rgb(255 255 255 / 0.06) 0%, transparent 38%), ` +
      `linear-gradient(${angle}deg, ${stops[0]} 0%, ${stops[1]} 100%)`,
    stops,
  };
}
