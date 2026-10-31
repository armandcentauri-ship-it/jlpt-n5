import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Autorise l'accès aux ressources dev (/_next/*, websocket HMR) depuis le domaine de préview.
  // Sans ça, Next.js 16 logue un avertissement cross-origin à chaque requête.
  allowedDevOrigins: ["*.space-z.ai", "space-z.ai"],
};

export default nextConfig;
