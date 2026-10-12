import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { HomeView } from "@/components/home/home-view";
import { alternatesFor } from "@/lib/hreflang";
import { jsonldScriptHtml, softwareApplicationJsonLd } from "@/lib/jsonld";
import { getHeroSeasonal } from "@/lib/seasonal-hero";
import { getSessionGate } from "@/lib/session-gate";

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
 *
 * POLIR10 (2.37.0): suppressHydrationWarning na ld+json skripti utiša
 * hidracijsko primerjavo PER-ZAHTEVNEGA atributa nonce (odjemalec ima v
 * flight podatkih prazen niz; vsebina skripte je deterministična in se
 * ne razlikuje) — enak kanon kot <html> za next-themes v layoutu;
 * nonce atribut OSTANE v izpisanem HTML (produkcjska CSP zahteva ga).
 *
 * POLIR15-c (2.42.0): STREŽNIŠKA VRATA za osebno domov (getSessionGate —
 * React cache dedup getServerSession, JWT = 0 db klicev) — sekca je ŽE v
 * SSR (prijavljeni) oziroma trajno odsotna (gostje); prej je useSession()
 * na klientu vstavljal sekco po hidraciji (2 premika vsebine).
 *
 * POLIR15-b (2.42.0): SEZONSKA AFINITETA heroja — getHeroSeasonal razreši
 * sezono/mikro-dogodek ENKRAT na strežniku in posreduje prop (0 hidracijske
 * razlike). QA kavelj `?sezona=winter|spring|summer|autumn` prisili sezono
 * (mikro-dogodek utiša) — produkcija vedno resolve po now.
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sezona?: string }>;
}) {
  const { locale } = await params;
  const { sezona } = await searchParams;
  // CSP nonce (middleware → x-nonce) — enak mehanizem kot v layoutu.
  const nonce = (await headers()).get("x-nonce") ?? "";
  // POLIR13 (2.40.0): sejni piškotek dai:next-step-dismissed (zrcal
  // sessionStorage ob dismissu) preberemo na strežniku in kartico izpustimo
  // ŽE v SSR — po ponovnem nalaganju v isti seji je ni (0 px premika).
  // Strani so že dinamične (headers() za nonce) ⇒ 0 dodatnega stroška.
  const nextStepDismissed =
    (await cookies()).get("dai:next-step-dismissed")?.value === "1";
  // POLIR15-c: strežniška vrata osebne domov (cache dedup, fail-closed).
  const { authed } = await getSessionGate();
  // POLIR15-b: sezonska varianta heroja (strežniško, enkrat na zahtevo).
  const seasonalHero = getHeroSeasonal({ override: sezona ?? null });
  return (
    <>
      <HomeView
        nextStepDismissed={nextStepDismissed}
        personalGate={authed}
        seasonalHero={seasonalHero}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: jsonldScriptHtml(softwareApplicationJsonLd(locale)),
        }}
      />
    </>
  );
}
