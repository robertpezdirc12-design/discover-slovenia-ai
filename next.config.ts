import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  // Predogledni pult (preview-chat-*.space-z.ai) streže/_next vire čez izvor —
  // Next.js 16 opozori, prihodnje veze pa to zahtevajo izrecno.
  allowedDevOrigins: ["*.space-z.ai"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // Lokalni logo.svg v zeleni ploščici navigacije (samo lastni viri).
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default withNextIntl(nextConfig);
