"use client";

import { useState } from "react";

/**
 * Avatar that degrades gracefully.
 *
 * Creator images come from social CDNs and IPFS gateways that rotate URLs,
 * rate limit, hang, and 404. Two defences, because they fail differently:
 * `onError` swaps in the placeholder for a load that fails outright, while the
 * CSS background paints it immediately for one that merely hangs — the real
 * image covers the background once it finally decodes.
 */
export function Avatar({
  src,
  alt,
  size = 56,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = !src || failed ? "/avatar-fallback.svg" : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src ?? "fallback"}
      src={resolved}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full border border-[var(--color-line)] object-cover"
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/avatar-fallback.svg)",
        backgroundSize: "cover",
      }}
    />
  );
}
