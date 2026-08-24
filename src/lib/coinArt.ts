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
 * Pastels only, and both stops within a stop or two of each other in value.
 * The tile sits under a glass card on a cream ground; a saturated pair fights
 * the panel above it, and a high-contrast pair reads as two blocks rather than
 * as one surface.
 */
const PAIRS: readonly (readonly [string, string])[] = [
  ["#bcdcff", "#d7cdf3"],
  ["#ffd9c2", "#f6cdd6"],
  ["#bfeee3", "#c7dff5"],
  ["#f0cdd8", "#eee0c6"],
  ["#c9d3f0", "#c8ecdf"],
  ["#ffdcc8", "#cdd3ee"],
  ["#cfe0c6", "#eee0c6"],
  ["#c7dff5", "#f0cdd8"],
  ["#d7cdf3", "#c8ecdf"],
  ["#ffd9c2", "#cfe0c6"],
  ["#bcdcff", "#f6cdd6"],
  ["#bfeee3", "#eee0c6"],
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
 * Two layers: the colour pair on a rotated axis, and a white sheen across the
 * top-left corner. The sheen is what stops it reading as a flat swatch — it is
 * the same highlight the glass panels carry, so the tile looks lit by the same
 * light as everything around it.
 */
export function coinArt(key: string): CoinArt {
  const seed = seedFrom(key);
  const stops = PAIRS[seed % PAIRS.length];
  const angle = 120 + (seed % 5) * 12;

  return {
    background:
      `linear-gradient(35deg, rgb(255 255 255 / 0.55) 0%, transparent 32%), ` +
      `linear-gradient(${angle}deg, ${stops[0]} 0%, ${stops[1]} 100%)`,
    stops,
  };
}
