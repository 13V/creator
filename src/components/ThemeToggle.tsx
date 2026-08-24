"use client";

import { useEffect, useState } from "react";

/**
 * Switches between the two shipped themes.
 *
 * The choice lives in `localStorage` under `creator-theme` and is applied to
 * `<html data-theme>` by an inline script in the document head, before first
 * paint — see `layout.tsx`. This component only mirrors and updates it, so
 * there is never a frame of the wrong theme.
 */

export const THEMES = [
  { id: "light", label: "Pop" },
  { id: "dark", label: "Dark" },
  { id: "glass", label: "Glass" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_KEY = "creator-theme";

/**
 * Runs before the first paint, so it has to be small, synchronous, and
 * tolerant of a browser that refuses storage entirely — a private window that
 * throws on `localStorage` must still render, just in the default theme.
 */
export const THEME_SCRIPT = `
try {
  var t = localStorage.getItem(${JSON.stringify(THEME_KEY)});
  if (t === "dark" || t === "glass") document.documentElement.dataset.theme = t;
} catch (e) {}
`.trim();

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>("light");

  // The inline script has already applied the stored value; read it back
  // rather than re-deriving it, so the control agrees with the page.
  useEffect(() => {
    const applied = document.documentElement.dataset.theme;
    setTheme(applied === "dark" || applied === "glass" ? applied : "light");
  }, []);

  function choose(next: ThemeId) {
    setTheme(next);
    // `light` is the default, so it is the absence of the attribute rather
    // than a value — one less state for the pre-paint script to handle.
    if (next === "light") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // A browser blocking storage still gets the theme for this page view.
    }
  }

  if (compact) {
    const order = THEMES.map((t) => t.id);
    const next = order[(order.indexOf(theme) + 1) % order.length];
    return (
      <button
        type="button"
        onClick={() => choose(next)}
        title={`Switch to the ${next} theme`}
        aria-label={`Switch to the ${next} theme`}
        className="grid h-9 w-full place-items-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--wash)] hover:text-[var(--color-fg)]"
      >
        <SwatchIcon theme={theme} />
      </button>
    );
  }

  return (
    <div className="segmented w-full">
      {THEMES.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => choose(option.id)}
          data-active={theme === option.id}
          className="segment flex-1 text-center"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Half-filled circle — the universal "change how this looks" glyph. */
function SwatchIcon({ theme }: { theme: ThemeId }) {
  const fill = theme === "light" ? 1 : theme === "dark" ? 0.6 : 0.25;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" opacity={fill} />
    </svg>
  );
}
