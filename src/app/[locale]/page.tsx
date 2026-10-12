import type { Metadata } from "next";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";

import { HomeView } from "@/components/home/home-view";
import { authOptions } from "@/lib/auth";
import { alternatesFor } from "@/lib/hreflang";
import { jsonldScriptHtml, softwareApplicationJsonLd } from "@/lib/jsonld";
import { getHeroVariant } from "@/lib/seasonal-hero";

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
 * POLIR15 (2.42.0): (a) SEJONSKA AFINITETA HEROJA — getHeroVariant()
 * (MMDD okna + mikro-dogodki, glej src/lib/seasonal-hero.ts) izračuna
 * varianto ŽE na strežniku in jo poda kot serializiran prop (0 hidracijskih
 * razlik, 0 CLS); QA override ?season=winter|spring|summer|autumn.
 * (b) CLS OSEBNE PLOŠČE — seja se prebere na strežniku prek
 * cache(() => getServerSession(authOptions)) (React cache() dedup —
 * 1 klic na render, enak kanon kot POLIR13 piškotek) in ime poda propu:
 * osebna plošča se izriše ŽE v SSR (skeleton) namesto null-while-loading
 * po useSession() (prej: vstavljanje celotne sekcije po hidraciji =
 * vrzel pri prijavljenih).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/") };
}

/** cache(() => getServerSession) — dedup znotraj render pass (POLIR15-c). */
const getSession = cache(() => getServerSession(authOptions));

const SEASON_WHITELIST = new Set(["winter", "spring", "summer", "autumn"]);

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  // CSP nonce (middleware → x-nonce) — enak mehanizem kot v layoutu.
  const nonce = (await headers()).get("x-nonce") ?? "";
  // POLIR13 (2.40.0): sejni piškotek dai:next-step-dismissed (zrcal
  // sessionStorage ob dismissu) preberemo na strežniku in kartico izpustimo
  // ŽE v SSR — po ponovnem nalaganju v isti seji je ni (0 px premika).
  // Strani so že dinamične (headers() za nonce) ⇒ 0 dodatnega stroška.
  const nextStepDismissed =
    (await cookies()).get("dai:next-step-dismissed")?.value === "1";
  // POLIR15 (2.42.0): sezonska varianta (SSR, deterministična) + QA override.
  const sp = await searchParams;
  const seasonParam = typeof sp.season === "string" ? sp.season : undefined;
  const seasonHero = getHeroVariant({
    seasonOverride:
      seasonParam && SEASON_WHITELIST.has(seasonParam)
        ? seasonParam
        : undefined,
  });
  // POLIR15-c: seja ENKRAT na render (cache()) — ime gre kot prop.
  const session = await getSession();
  const sessionName = session?.user?.name ?? null;
  return (
    <>
      <HomeView
        nextStepDismissed={nextStepDismissed}
        seasonHero={seasonHero}
        sessionName={sessionName}
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
