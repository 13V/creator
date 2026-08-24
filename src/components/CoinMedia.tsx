"use client";

import { useState } from "react";

import { coinArt } from "@/lib/coinArt";

/**
 * Square artwork for a coin.
 *
 * The wash is painted *underneath* the image rather than swapped in on error,
 * because IPFS gateways tend to hang rather than fail — `onError` never fires
 * and the tile would otherwise sit empty indefinitely.
 */
export function CoinMedia({
  src,
  alt,
  seed,
  className = "",
}: {
  src: string | null;
  alt: string;
  /** Whatever identifies this coin — the mint, so the wash is stable. */
  seed: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const art = coinArt(seed);

  return (
    <div className="relative h-full w-full" style={{ background: art.background }}>
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
