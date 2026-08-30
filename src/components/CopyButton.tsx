"use client";

import { useState } from "react";

/** Copies a value and confirms inline, so addresses never need hand-selecting. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label ? `Copy ${label}` : "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // Clipboard is unavailable over plain http or without permission.
        }
      }}
      className="shrink-0 rounded-md border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent-deep)]"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
