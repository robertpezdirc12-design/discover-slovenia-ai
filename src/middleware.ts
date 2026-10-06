import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

/**
 * next-intl middleware — botrijo poti glede na jezik.
 *
 * Izključeno (matcher): /api/*, /_next/*, /_vercel/*, vse statične datoteke
 * z piko v imenu (manifest.json, icon-192.png, logo.svg, rss.xml,
 * /content/*.jpg, favicon …).
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
