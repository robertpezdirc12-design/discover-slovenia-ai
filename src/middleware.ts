import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { buildCspHeader } from "@/lib/csp";
import { routing } from "@/i18n/routing";

/**
 * next-intl middleware (botrijo poti glede na jezik) + CSP nonce.
 *
 * Izključeno (matcher): /api/*, /_next/*, /_vercel/*, vse statične datoteke
 * z piko v imenu (manifest.json, icon-192.png, logo.svg, rss.xml,
 * /content/*.jpg, favicon, sw.js, offline.html …).
 *
 * CSP (issue #2 §9, »CSP nonce« iz PRODUCT-AUDIT.md):
 *  1. generiraj naključni nonce (crypto.randomUUID → base64);
 *  2. postavi `x-nonce` + `content-security-policy` na ZAHTVEVKO —
 *     next-intl interno naredi `new Headers(request.headers)` in jih
 *     prenese v NextResponse.next/rewrite (dokazano v dist vira), Next.js
 *     pa nonce samodejno pripne svojim skriptom;
 *  3. postavi `content-security-policy` na ODZIV (brskalnik jo vidi).
 *
 * Ker je nonce na odzivu svež za vsako zahtevo, morajo biti strani
 * DINAMIČNO izrisane — [locale]/layout.tsx ima zato force-dynamic
 * (SSG HTML bi vseboval zastarel nonce → blokirane skripte).
 */
const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // crypto.randomUUID() vsebuje '-', ki ni dovoljen v CSP nonce → base64.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCspHeader({
    nonce,
    dev: process.env.NODE_ENV !== "production",
  });

  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);

  const response = intlMiddleware(request);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
