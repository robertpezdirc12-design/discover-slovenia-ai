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
  // P0 AUDIT M5: osnovne varnostne glave na VSEH odzivih. Polni CSP je
  // zavestno izpuščen (Leaflet/Stripe/Next inline zahtevajo natančno
  // nonce-arhitekturo — dokumentirano v docs/PRODUCT-AUDIT.md kot naslednji
  // korak). HSTS samo prek HTTPS (Vercel) — lokalni http dev ni prizadet.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
