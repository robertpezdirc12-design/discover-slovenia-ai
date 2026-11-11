import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Snapshot uradnega registra (AJPES) mora biti vključen v serverless
     funkcijo /api/apartments (rezerva, ko SQLite ni dosegljiva — Vercel). */
  outputFileTracingIncludes: {
    "/api/apartments": ["./data/ajpes-apartments.json"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
