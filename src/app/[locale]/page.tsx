import type { Metadata } from "next";
import { headers } from "next/headers";

import { HomeView } from "@/components/home/home-view";
import { alternatesFor } from "@/lib/hreflang";
import { jsonldScriptHtml, softwareApplicationJsonLd } from "@/lib/jsonld";

/**
 * / — DOMAČA STRAN (strežniški ovoj).
 *
 * Metadata: hreflang alternates za vseh 6 jezikov izvirnika
 * (sl brez predpone = x-default; en/it/de/fr/es s predpono) —
 * naslov/opis podeduje iz [locale]/layout.tsx (messages meta).
 *
 * SEO JSON-LD (POLIR C, 2.28.0): schema.org SoftwareApplication z
 * iskrenim featureListom (×6 jezikov) in ceno "0" (načrtovanje je res
 * brezplačno). Inline skripta nosi CSP nonce z zahteve (middleware
 * postavi x-nonce — brez nonca bi jo produkcjska CSP blokirala;
 * enak kanon kot next-themes v [locale]/layout.tsx).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/") };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // CSP nonce (middleware → x-nonce) — enak mehanizem kot v layoutu.
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <HomeView />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonldScriptHtml(softwareApplicationJsonLd(locale)),
        }}
      />
    </>
  );
}
