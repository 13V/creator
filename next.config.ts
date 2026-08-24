import type { NextConfig } from "next";

const config: NextConfig = {
  // Avatars are proxied through /api/avatar, so remote patterns stay narrow.
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  serverExternalPackages: ["node:sqlite", "sharp"],
};

export default config;
