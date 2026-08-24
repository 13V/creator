"use client";

import { useEffect, useRef, useState } from "react";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Square image picker with a live preview.
 *
 * Validates type and size in the browser so an oversized file is rejected
 * before it is uploaded and pinned, rather than after a round trip.
 */
export function ImagePicker({
  file,
  onChange,
  fallbackUrl,
}: {
  file: File | null;
  onChange: (file: File | null, error: string | null) => void;
  /** Shown when nothing is picked — usually the resolved creator's avatar. */
  fallbackUrl?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(next: File | null) {
    if (!next) return onChange(null, null);
    if (!ACCEPT.split(",").includes(next.type)) {
      return onChange(null, "Images must be a PNG, JPG, GIF, or WEBP.");
    }
    if (next.size > MAX_BYTES) {
      return onChange(null, "That image is larger than 5 MB.");
    }
    onChange(next, null);
  }

  const shown = preview ?? fallbackUrl ?? null;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-dashed text-center transition ${
          dragging
            ? "border-[var(--color-accent)] bg-[#1a1013]"
            : "border-[var(--color-line-strong)] bg-[#0c0c11] hover:border-[var(--color-accent)]"
        }`}
      >
        {shown ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-[#0a0a0ce6] py-1.5 text-[11px] text-[var(--color-muted)]">
              {preview ? "Change image" : "Using their avatar — click to replace"}
            </span>
          </>
        ) : (
          <span className="px-3 text-xs leading-relaxed text-[var(--color-faint)]">
            <span className="block text-[var(--color-fg)]">Click or drop an image</span>
            PNG · JPG · GIF · WEBP
          </span>
        )}
      </button>

      {file && (
        <button
          type="button"
          onClick={() => accept(null)}
          className="text-[11px] text-[var(--color-faint)] underline-offset-2 hover:text-[var(--color-fg)] hover:underline"
        >
          Remove
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => accept(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
