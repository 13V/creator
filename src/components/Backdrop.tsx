/**
 * A field of tiny emoji across the page ground.
 *
 * This replaces the dot grid rather than joining it: two regular textures at
 * different pitches read as moiré rather than as one surface. Same job the
 * dots were doing — stopping flat colour from making the page feel unfinished
 * — with something that says what the product is about.
 *
 * Rendered as DOM. The obvious cheaper route is one tiling element with an SVG
 * data URI, but SVG-as-image runs in a restricted context with no access to
 * system fonts: the image loads and paints nothing at all. Verified before
 * building this, rather than after.
 *
 * Emoji are colour bitmap glyphs, so `color` cannot tint them either. The
 * flattening in `.backdrop-emoji` is what makes them read as the ground a
 * shade deeper — see the stylesheet.
 */

/*
 * All money, and chosen for silhouette.
 *
 * Flattened to one tone at 13px an emoji is only its outline, which rules out
 * most of the obvious picks: rendered at the shipped size, banknotes, cards
 * and charts fill 95-100% of their own bounding box, so they land as solid
 * rectangles that read as nothing at all. A receipt and a handshake went the
 * same way on inspection — one a filled block, the other a shapeless lump.
 *
 * What is left is money imagery that survives as an outline: a bag, wings, a
 * gem, a bull, a bank, the money-fingers.
 */
const GLYPHS = [
  "🪙", "💰", "💸", "💎", "💲", "🏦",
  "🚀", "🐂", "🫰", "🛍️", "💱", "⛏️",
] as const;

/*
 * How many cells to emit.
 *
 * The grid auto-fills to the viewport and the layer clips whatever overflows,
 * so this only has to be *enough* — the cost of a few hundred spare spans is
 * far lower than the cost of measuring the viewport, which would mean client
 * state and a flash of a different pattern on hydration.
 *
 * 2600 covers an ultrawide 3440x1440 at the cell size the stylesheet switches
 * to up there, and every smaller viewport by a wide margin.
 */
const CELLS = 2600;

/**
 * Scrambles the index before picking a glyph.
 *
 * A regular grid plus any simple `index % length` produces diagonal stripes of
 * repeated glyphs, since the row length and the list length fall into step.
 * Knuth's multiplicative hash decorrelates neighbours in both directions, so
 * the field reads as scattered even though the geometry is a strict grid.
 */
function glyphFor(index: number): string {
  const hashed = Math.imul(index + 1, 2654435761) >>> 16;
  return GLYPHS[hashed % GLYPHS.length];
}

export function Backdrop() {
  return (
    <div className="backdrop-grid" aria-hidden>
      {Array.from({ length: CELLS }, (_, i) => (
        <span key={i} className="backdrop-emoji">
          {glyphFor(i)}
        </span>
      ))}
    </div>
  );
}
