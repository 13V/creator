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
 * Eight loud duotones.
 *
 * This has been three palettes now: twelve invented pastels that read as
 * "generate me an avatar", then four tints so muted the board looked dead.
 * These are the opposite of both — saturated, high-contrast pairs that a
 * memecoin actually deserves, and that survive being sat on a cream ground
 * behind a black border.
 *
 * The pair is always two hues apart rather than two shades of one, so a tile
 * has a direction across it instead of a wash.
 */
const PAIRS: readonly (readonly [string, string])[] = [
  ["#6c4cf5", "#00d9e0"],
  ["#ff3b5c", "#ffcf24"],
  ["#00c853", "#3fd0ff"],
  ["#ff6b2c", "#ff3b9e"],
  ["#3b5cff", "#a24cff"],
  ["#ffcf24", "#00c853"],
  ["#ff3b9e", "#6c4cf5"],
  ["#00d9e0", "#3b5cff"],
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
      `radial-gradient(120% 90% at 22% 12%, rgb(255 255 255 / 0.3) 0%, transparent 52%), ` +
      `linear-gradient(${angle}deg, ${stops[0]} 0%, ${stops[1]} 100%)`,
    stops,
  };
}

/**
 * The card ground for a coin: its own artwork hue, mixed down into the panel.
 *
 * Two earlier attempts failed for the same reason — a fixed list of soft
 * tokens. Seeded independently it gave mint-green cards under orange tiles;
 * aligned to `PAIRS` it still clustered, because eight artwork pairs were
 * mapping onto five soft tokens and three cards in a row came out pink.
 *
 * Mixing instead of picking removes the problem rather than tuning it: every
 * pair gets a distinct ground derived from its own first hue, and because the
 * mix resolves against `--color-panel` it lands light on the light theme and
 * near-black on the dark one, with no second palette to maintain.
 *
 * 14% is the point where the grid reads as coloured while the coin's name
 * still has the contrast of text on paper.
 */
export function coinTint(key: string): string {
  const [hue] = PAIRS[seedFrom(key) % PAIRS.length];
  return `color-mix(in oklab, ${hue} 14%, var(--color-panel))`;
}
