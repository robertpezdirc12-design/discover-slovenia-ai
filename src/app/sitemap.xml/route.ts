import { sitemapXml } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic";

/**
 * /sitemap.xml — generiran sitemap (#41 Faza 3, 2.57.0; zapre P2 iz #38).
 * Vnosi iz kanonskih registrov (statične javne poti, destinacije, države,
 * vodniki) × 6 jezikov s hreflang xhtml:link alternatami — gradnik v
 * src/lib/sitemap-data.ts (čista logika, pogodbene teste). Osnovni URL se
 * izpelje iz zahteve (kanon rss.xml — brez trdo kodirane domene).
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return new Response(sitemapXml(origin), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
