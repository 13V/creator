/**
 * Tone-on-tone emoji across the page ground.
 *
 * The board has large empty areas — beside the hero, under a short list, the
 * whole lower half before any coins exist — and flat colour there is most of
 * what makes the page read as unfinished. These fill it without competing:
 * knocked flat to silhouettes and dropped to a few percent, so they register
 * as texture you notice on the second look rather than as content.
 *
 * Emoji are colour bitmap glyphs, so `color` does nothing to them — the only
 * way to tint them is to flatten and re-tint through filters, which is what
 * `.backdrop-emoji` does. Fixed rather than scrolling, matching the dot grid,
 * so the ground stays put and only the content moves over it.
 *
 * Positions are a fixed list rather than random at runtime: a decorative layer
 * that reshuffles between the server render and hydration would flicker. The
 * list was generated once with rejection sampling — a candidate too near one
 * already placed is thrown away — which gives an irregular scatter without the
 * clumps that pure randomness produces or the even spacing that makes a
 * hand-placed pattern read as wallpaper.
 */

interface Fleck {
  /** Percentage of the viewport, so the scatter holds at any window size. */
  x: number;
  y: number;
  size: number;
  rotate: number;
  glyph: string;
}

/*
 * Chosen for silhouette, not for meaning. Flattened to one tone, an emoji is
 * only its outline: a star, a crown or a coin still reads, while anything with
 * internal detail collapses into a blob.
 */
const FLECKS: Fleck[] = [
  { x: 52, y: 17, size: 38, rotate: 6, glyph: "🪙" },
  { x: 51, y: 39, size: 52, rotate: 13, glyph: "🏆" },
  { x: 20, y: 19, size: 38, rotate: -17, glyph: "⭐" },
  { x: 46, y: 90, size: 52, rotate: 14, glyph: "🎬" },
  { x: 6, y: 31, size: 52, rotate: -3, glyph: "💜" },
  { x: 92, y: 84, size: 34, rotate: 7, glyph: "👑" },
  { x: 75, y: 73, size: 30, rotate: 18, glyph: "💎" },
  { x: 39, y: 73, size: 26, rotate: 11, glyph: "🎬" },
  { x: 21, y: 48, size: 58, rotate: 6, glyph: "👑" },
  { x: 72, y: 3, size: 46, rotate: -5, glyph: "🏆" },
  { x: 66, y: 56, size: 38, rotate: 20, glyph: "💎" },
  { x: 69, y: 88, size: 58, rotate: -14, glyph: "💎" },
  { x: 86, y: 56, size: 58, rotate: 14, glyph: "💎" },
  { x: 53, y: 27, size: 30, rotate: 8, glyph: "🍀" },
  { x: 6, y: 7, size: 42, rotate: -9, glyph: "👑" },
  { x: 94, y: 23, size: 30, rotate: -11, glyph: "🏆" },
  { x: 73, y: 44, size: 58, rotate: 16, glyph: "🎬" },
  { x: 57, y: 59, size: 30, rotate: 15, glyph: "🪙" },
  { x: 85, y: 35, size: 26, rotate: 8, glyph: "🍀" },
  { x: 78, y: 25, size: 30, rotate: 10, glyph: "💸" },
  { x: 33, y: 27, size: 38, rotate: -12, glyph: "🍀" },
  { x: 42, y: 57, size: 38, rotate: -4, glyph: "🔥" },
  { x: 32, y: 91, size: 38, rotate: 20, glyph: "🫶" },
  { x: 60, y: 81, size: 26, rotate: 9, glyph: "🎤" },
  { x: 6, y: 60, size: 52, rotate: 9, glyph: "💸" },
  { x: 83, y: 4, size: 34, rotate: -20, glyph: "🎤" },
  { x: 97, y: 10, size: 46, rotate: -9, glyph: "🪙" },
  { x: 5, y: 50, size: 46, rotate: -6, glyph: "💎" },
  { x: 62, y: 7, size: 34, rotate: 15, glyph: "🤝" },
  { x: 97, y: 69, size: 46, rotate: -8, glyph: "👑" },
  { x: 49, y: 74, size: 42, rotate: 19, glyph: "💎" },
  { x: 79, y: 94, size: 52, rotate: -14, glyph: "📸" },
  { x: 81, y: 65, size: 26, rotate: 2, glyph: "🏆" },
  { x: 86, y: 76, size: 34, rotate: -14, glyph: "👑" },
  { x: 30, y: 49, size: 34, rotate: 18, glyph: "🤝" },
  { x: 90, y: 95, size: 42, rotate: -8, glyph: "🎤" },
  { x: 25, y: 76, size: 58, rotate: -12, glyph: "🔥" },
  { x: 66, y: 67, size: 42, rotate: -20, glyph: "🍀" },
  { x: 38, y: 18, size: 34, rotate: -8, glyph: "⭐" },
  { x: 31, y: 62, size: 34, rotate: -19, glyph: "⭐" },
  { x: 23, y: 37, size: 46, rotate: 14, glyph: "🫶" },
  { x: 2, y: 73, size: 30, rotate: 15, glyph: "✌️" },
  { x: 24, y: 67, size: 52, rotate: -8, glyph: "⭐" },
  { x: 82, y: 18, size: 46, rotate: -6, glyph: "🎬" },
];

export function Backdrop() {
  return (
    <div className="backdrop-flecks" aria-hidden>
      {FLECKS.map((fleck, index) => (
        <span
          key={index}
          className="backdrop-emoji"
          style={{
            left: `${fleck.x}%`,
            top: `${fleck.y}%`,
            fontSize: `${fleck.size}px`,
            transform: `translate(-50%, -50%) rotate(${fleck.rotate}deg)`,
          }}
        >
          {fleck.glyph}
        </span>
      ))}
    </div>
  );
}
