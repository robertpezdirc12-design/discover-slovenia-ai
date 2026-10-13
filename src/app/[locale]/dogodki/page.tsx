import type { Metadata } from "next";
import { headers } from "next/headers";

import { EventsView } from "@/components/content/events-view";
import { EVENTS } from "@/lib/content-data";
import { eventsJsonLd, jsonldScriptHtml } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/page-metadata";

/**
 * /dogodki — koledar 31 dogodkov (30 iz produkcije + razdvojen zapis P0 2. serije).
 *
 * SEO Event JSON-LD (2.45.0, #38 — vzor MySwitzerland iz benchmarka #35):
 * @graph Event entitet SAMO za dogodke s potrjenim datumom
 * (dateUnconfirmed/izmišljeni datumi NIKOLI v strukturiranih podatkih —
 * iskrenostni kanon, glej src/lib/jsonld.ts). Skripta nosi CSP nonce z
 * zahteve (middleware → x-nonce; enak kanon kot domača stran) in
 * suppressHydrationWarning za per-zahtevni nonce atribut.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/dogodki");
}

export default async function DogodkiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // CSP nonce (middleware → x-nonce) — enak mehanizem kot na domači strani.
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <EventsView />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: jsonldScriptHtml(eventsJsonLd(EVENTS, locale)),
        }}
      />
    </>
  );
}
