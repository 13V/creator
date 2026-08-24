"use client";

import { useState } from "react";

import { ShareIcon } from "@/components/icons";

/**
 * Uses the native share sheet where there is one — this is a phone-first feed —
 * and quietly falls back to copying the link on desktop.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          if (navigator.share) {
            await navigator.share({ title, url });
            return;
          }
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Cancelled share sheet, or no clipboard permission.
        }
      }}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted)] transition hover:bg-[#ffffff0a] hover:text-[var(--color-fg)]"
    >
      <ShareIcon />
      {copied ? "Copied" : "Share"}
    </button>
  );
}
