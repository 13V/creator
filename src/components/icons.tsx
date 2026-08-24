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
