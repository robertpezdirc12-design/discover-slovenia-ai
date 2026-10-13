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
 * @graph Event entitet SAMO za dogodke s POTRJENIM in ŠE NE ZAKLJUČENIM
 * datumom (dateUnconfirmed NIKOLI v strukturiranih podatkih — iskrenostni
 * kanon; zaključeni izključeni prek isEventPast s SSR dnevom — 2.48.0).
 * Skripta nosi CSP nonce z zahteve (middleware → x-nonce; enak kanon kot
 * domača stran) in suppressHydrationWarning za per-zahtevni nonce atribut.
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
  // #38 (2.48.0): današnji datum reši STREŽNIK (enkrat per zahteva) in ga
  // poda kot prop — UI oznaka „pretekli dogodek“ + izključitev zaključenih
  // dogodkov iz Event JSON-LD; isti niz SSR/klient → 0 hidracijskih
  // razlik (kanon POLIR15-b). Časovni pas Europe/Ljubljana (en-CA = ISO
  // „YYYY-MM-DD“), NE UTC — kanon repozitorija.
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
  }).format(new Date());
  return (
    <>
      <EventsView todayIso={todayIso} />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: jsonldScriptHtml(eventsJsonLd(EVENTS, locale, todayIso)),
        }}
      />
    </>
  );
}
