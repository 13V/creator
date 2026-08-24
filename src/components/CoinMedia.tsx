"use client";

import { useState } from "react";

/**
 * Square artwork for a coin, with a fallback built for this size.
 *
 * The avatar placeholder is a 64px silhouette; stretched across a 580px feed
 * post it reads as broken, so this falls back to a tinted monogram of the
 * ticker instead. The monogram is painted *underneath* rather than swapped in
 * on error, because IPFS gateways tend to hang rather than fail — `onError`
 * never fires and the post would otherwise sit empty indefinitely.
 */
export function CoinMedia({
  src,
  alt,
  symbol,
  className = "",
}: {
  src: string | null;
  alt: string;
  symbol: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const monogram = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "?";

  return (
    <div className="relative h-full w-full [container-type:size] bg-[linear-gradient(140deg,#1c1c25,#131319_55%,#1d1522)]">
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-mono text-[clamp(1.25rem,18cqmin,5rem)] font-bold tracking-tight text-[#4a4a5c]">
          {monogram}
        </span>
      </div>

      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`relative h-full w-full object-cover ${className}`}
        />
      )}
    </div>
  );
}
