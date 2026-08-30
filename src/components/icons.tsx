/** Minimal stroked icons, sized by the surrounding font-size where possible. */
type IconProps = { className?: string; filled?: boolean };

const base = "h-[22px] w-[22px]";

export function HomeIcon({ className = "", filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8" />
    </svg>
  );
}

export function CompassIcon({ className = "", filled }: IconProps) {
  /*
   * The needle is what fills, not the dial. Filling the outer circle — which
   * is most of the icon's area — turns it into a solid disc and loses the one
   * shape that says "compass".
   */
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

export function TrophyIcon({ className = "", filled }: IconProps) {
  /*
   * Only the cup fills. Letting the fill reach the handles and stem — which
   * are open paths — closes them into one black mass at 22px, and the shape
   * stops reading as a trophy at all.
   */
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" fill={filled ? "currentColor" : "none"} />
      <path d="M7 6H4.5A2.5 2.5 0 0 0 7 10.5M17 6h2.5A2.5 2.5 0 0 1 17 10.5" />
      <path d="M12 14v3M9 20h6" />
    </svg>
  );
}

export function WalletIcon({ className = "", filled }: IconProps) {
  /*
   * The card body is one big rounded rect, so filling it the way the other
   * icons fill leaves a solid black box with no readable silhouette. The
   * filled state therefore knocks the stripe and the chip back out in the
   * ground colour, the way CompassIcon reverses its needle.
   */
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16.5 14.5h.01" stroke={filled ? "var(--color-ink)" : "currentColor"} />
    </svg>
  );
}

export function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" className={`${base} ${className}`}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ShareIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={`h-[18px] w-[18px] ${className}`}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 15V3M8.5 6.5 12 3l3.5 3.5" />
    </svg>
  );
}

export function BoltIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`h-[18px] w-[18px] ${className}`}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}

/*
 * Platform marks. These were "𝕏", "IG" and "TT" set as text, which renders at
 * whatever weight the font happens to have and reads as a placeholder.
 */
/*
 * Platform marks come in two forms.
 *
 * The monochrome glyph is the default, because these appear inside dense feed
 * rows and card footers where four different brand palettes fighting each
 * other would read as clutter rather than as information.
 *
 * `BRAND_TILES` is the other form: each platform's real app icon, ground and
 * all. Used where the platform is the thing being chosen rather than a label
 * on something else — the claim page, where somebody is scanning for their
 * own — and where an authentic mark is what makes the row instantly readable.
 *
 * These are third-party trademarks, reproduced to identify the platform they
 * belong to and nothing else.
 */

export function XMark({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function InstagramMark({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.4" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.6" cy="6.4" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function TikTokMark({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.84-2.48V9.78a5.68 5.68 0 1 0 4.93 5.62V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.3 4.3 0 0 1-3.23-1.48z" />
    </svg>
  );
}

export function RedditMark({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 11.82a2.2 2.2 0 0 0-3.72-1.58 10.78 10.78 0 0 0-5.61-1.77l.95-4.48 3.11.66a1.58 1.58 0 1 0 .18-1.06l-3.7-.79a.53.53 0 0 0-.63.41l-1.09 5.24A10.8 10.8 0 0 0 5.72 10.24 2.2 2.2 0 1 0 3.4 13.9a4.3 4.3 0 0 0-.05.66c0 3.36 3.87 6.08 8.65 6.08s8.65-2.72 8.65-6.08a4.3 4.3 0 0 0-.05-.65A2.2 2.2 0 0 0 22 11.82zM7.6 13.4a1.58 1.58 0 1 1 1.58 1.58A1.58 1.58 0 0 1 7.6 13.4zm8.86 4.19a5.9 5.9 0 0 1-4.46 1.4 5.9 5.9 0 0 1-4.46-1.4.53.53 0 0 1 .75-.75 4.94 4.94 0 0 0 3.71 1.09 4.94 4.94 0 0 0 3.71-1.09.53.53 0 1 1 .75.75zm-.64-2.61a1.58 1.58 0 1 1 1.58-1.58 1.58 1.58 0 0 1-1.58 1.58z" />
    </svg>
  );
}

/** The X app icon: black ground, white glyph. */
export function XTile({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5.4" fill="#000000" />
      <path
        fill="#ffffff"
        transform="translate(3.6 3.6) scale(0.7)"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

/**
 * The Instagram app icon. The ground is a radial gradient anchored at the
 * bottom-left corner, which is what makes it Instagram's rather than a generic
 * pink-to-purple sweep — a linear gradient reads as an imitation.
 */
export function InstagramTile({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <radialGradient id="backd-ig" cx="0.28" cy="1.05" r="1.25">
          <stop offset="0" stopColor="#FFD600" />
          <stop offset="0.28" stopColor="#FF7A00" />
          <stop offset="0.52" stopColor="#FF0069" />
          <stop offset="0.74" stopColor="#D300C5" />
          <stop offset="1" stopColor="#7638FA" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="5.4" fill="url(#backd-ig)" />
      <g fill="none" stroke="#ffffff" strokeWidth="1.7">
        <rect x="5" y="5" width="14" height="14" rx="4.2" />
        <circle cx="12" cy="12" r="3.3" />
      </g>
      <circle cx="16.4" cy="7.6" r="1.05" fill="#ffffff" />
    </svg>
  );
}

/** The Reddit app icon: orange ground, white snoo. */
export function RedditTile({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5.4" fill="#FF4500" />
      <path
        fill="#ffffff"
        transform="translate(3.1 3.1) scale(0.74)"
        d="M22 11.82a2.2 2.2 0 0 0-3.72-1.58 10.78 10.78 0 0 0-5.61-1.77l.95-4.48 3.11.66a1.58 1.58 0 1 0 .18-1.06l-3.7-.79a.53.53 0 0 0-.63.41l-1.09 5.24A10.8 10.8 0 0 0 5.72 10.24 2.2 2.2 0 1 0 3.4 13.9a4.3 4.3 0 0 0-.05.66c0 3.36 3.87 6.08 8.65 6.08s8.65-2.72 8.65-6.08a4.3 4.3 0 0 0-.05-.65A2.2 2.2 0 0 0 22 11.82zM7.6 13.4a1.58 1.58 0 1 1 1.58 1.58A1.58 1.58 0 0 1 7.6 13.4zm8.86 4.19a5.9 5.9 0 0 1-4.46 1.4 5.9 5.9 0 0 1-4.46-1.4.53.53 0 0 1 .75-.75 4.94 4.94 0 0 0 3.71 1.09 4.94 4.94 0 0 0 3.71-1.09.53.53 0 1 1 .75.75zm-.64-2.61a1.58 1.58 0 1 1 1.58-1.58 1.58 1.58 0 0 1-1.58 1.58z"
      />
    </svg>
  );
}

/**
 * The TikTok app icon: black ground, and the note drawn three times — cyan
 * offset up-left, pink offset down-right, white on top. The chromatic split is
 * the whole identity; a single white note is just a musical note.
 */
export function TikTokTile({ className = "" }: IconProps) {
  const NOTE =
    "M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.84-2.48V9.78a5.68 5.68 0 1 0 4.93 5.62V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.3 4.3 0 0 1-3.23-1.48z";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5.4" fill="#000000" />
      <g transform="translate(3.6 3.6) scale(0.7)">
        <path d={NOTE} fill="#25F4EE" transform="translate(-1.1 -1.1)" />
        <path d={NOTE} fill="#FE2C55" transform="translate(1.1 1.1)" />
        <path d={NOTE} fill="#ffffff" />
      </g>
    </svg>
  );
}

/**
 * The outline of the B, shared by the mark and its shadow so the two can
 * never drift apart. Drawn on a 24 grid: a flat left stem, two bowls whose
 * right edges are true semicircles (r 4.8, exactly half the bowl height), and
 * a pinch at the waist where the two arcs meet.
 */
const B_OUTLINE =
  "M6.7 1.8 H12.7 A4.8 4.8 0 0 1 12.7 11.4 H13 A4.8 4.8 0 0 1 13 21 H6.7" +
  " A1.6 1.6 0 0 1 5.1 19.4 V3.4 A1.6 1.6 0 0 1 6.7 1.8 Z";

/**
 * The brand mark: B for Backd.
 *
 * Two marks came before it — a ✦, then a ring split 90/10 to state the fee
 * share. The ring was honest but it was a diagram, and a diagram cannot carry
 * a name. This is the letter instead, built the way every other surface on the
 * site is built: a flat fill, one ink edge, and a hard shadow that is a solid
 * copy of the silhouette pushed down and right. Never an extrusion, never a
 * bevel, never a second inner line. The cross splits it into four panels, so
 * the letter reads as assembled rather than drawn.
 *
 * The ink parts are currentColor rather than a fixed black, which is what lets
 * the same component invert on the dark theme: the rail sets the foreground,
 * and the edge and shadow follow it from near-black to cream while the face
 * stays violet.
 *
 * Below about 24px the shadow closes the gap to the face and the letter starts
 * to read as bolded rather than shadowed. Nothing in the app renders it that
 * small — the rail is 30px, the mobile bar 28 — and the favicon uses the
 * tile in `app/icon.svg`, which is built for that size instead.
 */
export function Mark({
  className = "",
  size = 30,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d={B_OUTLINE} fill="currentColor" transform="translate(1.2 1.2)" />
      <path
        d={B_OUTLINE}
        fill="var(--color-accent)"
        stroke="currentColor"
        strokeWidth="0.95"
        strokeLinejoin="round"
      />
      <g stroke="currentColor" strokeWidth="0.95">
        <path d="M11.3 1.8V21" />
        <path d="M5.1 11.4H12.85" />
      </g>
    </svg>
  );
}

/** A plain tick, for the end of a flow that succeeded. */
export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}
