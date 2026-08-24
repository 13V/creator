import type { NextConfig } from "next";

const config: NextConfig = {
  // Avatars are proxied through /api/avatar, so remote patterns stay narrow.
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // `pg` and `sharp` load native bindings; bundling them breaks that.
  // (node:sqlite is a builtin and never needed listing here.)
  serverExternalPackages: ["pg", "sharp"],
};

export default config;
