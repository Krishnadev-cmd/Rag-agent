import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  /* config options here */
};

export default nextConfig;
