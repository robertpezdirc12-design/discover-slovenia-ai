/**
 * AFFILIATE-PROVIDERS — čisti register rezervacijskih partnerjev.
 *
 * v2.5.0 (MindTrip vzorec): 5 partnerjev (booking/getyourguide/kiwi/
 * rentalcars/omio) + gorivo. v2.10.0 (P0-F RECONCILE): register POVEZAN
 * s supply registrom — sprejme VSE ponudnike z dostopom
 * »affiliate-deeplink« (glej src/lib/supply/registry.ts):
 *  · novi: viator (doživetja), tiqets (vstopnice), skyscanner (leti),
 *    airalo (eSIM), discovercars (najem avtov), worldnomads + safetywing
 *    (zavarovanje) — 12 moniziranih + gorivo;
 *  · izven ostajata pošteno: kiwitaxi (partner-feed — pride s CSV viri)
 *    in travelpayouts (api — partnerski API, ne globoka povezava).
 *
 * Kanon URL-jev (P0-F): vsak publicTmpl je PREVERJEN (curl 200 ali
 * spletne reference), NIČ izmišljenih vzorcev. Partnerji BREZ javno
 * dokumentiranega vzorca provizijskega parametra imajo affiliateTmpl ""
 * — takrat ID SAMO ZASEBE ne more zgraditi provizijske povezave;
 * lastnikovo AFFILIATE_*_TMPL nadomestilo (s pravim vzorcem iz programa)
 * jo lahko (iskrena veriga v buildPartnerLink).
 *
 * KANONI (skladno s projektom):
 *  · ČISTA LOGIKA — brez process.env, brez db, brez stranskih učinkov;
 *    env (AFFILIATE_*_ID) bere IZKLJUČNO strežniški sloj ob KLICU
 *    (glej src/lib/affiliate-server.ts + /api/affiliate/go).
 *  · ISKRENOST — partner brez ID-ja še vedno preusmeri na JAVNO iskanje
 *    (uporabniku koristno), klik pa se zabeleži z affiliateActive:false,
 *    da lastnik vidi povpraševanje, ki ga (še) ne monizira.
 *  · PROVIZIJSKI ODSTOTKI so POGODBENI in se spreminjajo — null pomeni
 *    »ocena neznana do pogodbe« (nikoli ne izmišljujemo odstotka); znane
 *    ocene so vidno označene kot ocena iz javno dostopnih pogojev
 *    partnerskih programov, nikoli kot obljuba.
 *  · BENCIN ni provizijska kategorija — brezplačni odprti podatki
 *    (glej src/lib/fuel-stations.ts), eksplicitno 0 %.
 */

// ── Kategorije (uporabnikov seznam: sobe, leti, rent-a-car, doživetja…) ──

export type AffiliateCategory =
  | "stays" // nastanitve / sobe
  | "experiences" // doživetja / izkušnje
  | "flights" // letalske karte
  | "car" // rent-a-car
  | "transfers" // prevozi (vlaki/avtobusi)
  | "tickets" // vstopnice (muzeji, znamenitosti)
  | "esim" // eSIM podatki za potovanje
  | "insurance" // popotniško zavarovanje
  | "fuel"; // bencinske črpalke — brez provizije

export interface AffiliateCategoryLabel {
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
}

export const AFFILIATE_CATEGORIES: Record<
  AffiliateCategory,
  AffiliateCategoryLabel
> = {
  stays: { sl: "Nastanitve", en: "Stays", it: "Soggiorni", de: "Unterkünfte", fr: "Séjours", es: "Alojamientos" },
  experiences: { sl: "Doživetja", en: "Experiences", it: "Esperienze", de: "Erlebnisse", fr: "Expériences", es: "Experiencias" },
  flights: { sl: "Letalske karte", en: "Flights", it: "Voli", de: "Flüge", fr: "Vols", es: "Vuelos" },
  car: { sl: "Rent-a-car", en: "Car rental", it: "Noleggio auto", de: "Mietwagen", fr: "Location de voiture", es: "Alquiler de coches" },
  transfers: { sl: "Prevozi", en: "Transfers", it: "Trasferimenti", de: "Transfers", fr: "Transferts", es: "Traslados" },
  tickets: { sl: "Vstopnice", en: "Tickets", it: "Biglietti", de: "Tickets", fr: "Billets", es: "Entradas" },
  esim: { sl: "eSIM podatki", en: "eSIM data", it: "Dati eSIM", de: "eSIM-Daten", fr: "Données eSIM", es: "Datos eSIM" },
  insurance: { sl: "Zavarovanje", en: "Insurance", it: "Assicurazione", de: "Versicherung", fr: "Assurance", es: "Seguro" },
  fuel: { sl: "Bencinske", en: "Fuel", it: "Carburante", de: "Tankstellen", fr: "Carburant", es: "Combustible" },
};

// ── Registrski vnos partnerja ──────────────────────────────────────────────

export type AffiliateProviderId =
  | "booking"
  | "getyourguide"
  | "kiwi"
  | "rentalcars"
  | "omio"
  | "viator"
  | "tiqets"
  | "skyscanner"
  | "airalo"
  | "discovercars"
  | "worldnomads"
  | "safetywing"
  | "osm-fuel";

export interface AffiliateProviderDef {
  id: AffiliateProviderId;
  /** Javno ime partnerja. */
  name: string;
  category: AffiliateCategory;
  /**
   * Ocena provizije v % (pogodbena — glej kanon zgoraj).
   * 0 = brez provizije (gorivo). null = ocena NEZNANA do pogodbe.
   */
  commissionPct: number | null;
  /** Kratek slovenski opis ponudbe partnerja. */
  descSl: string;
  descEn: string;
  /** Env spremenljivka z partnerjevim ID (brana SAMO na strežniku). */
  envId: string;
  /** Env spremenljivka z opisno predlogo povezave (neobvezna pregl. za lastnika). */
  envTmpl: string;
  /** Privzeta javna predloga povezave — {dest}/{country} se nadomestita. */
  publicTmpl: string;
  /**
   * Javni namestnik, kadar predloga zahteva {country}, ta pa ni znana
   * (npr. airalo: /{country}-eSIM brez države → domača stran, kjer
   * uporabnik izbere državo). Če ni podan, velja čiščenje applyTemplate.
   */
  noCountryTmpl?: string;
  /**
   * Predloga z žetonom — {id} = partnerjev ID. PRAZNA, kadar vzorca
   * provizijskega parametra NI javno dokumentiranega (ID sam zato ne
   * more zgraditi provizijske povezave — pošteno, brez izmišljanja).
   */
  affiliateTmpl: string;
  /** Domena partnerja (za prikaz uporabniku — "odpre pri …"). */
  domain: string;
}

/**
 * Register partnerjev (P0-F RECONCILE). Zmrznjen (Object.freeze) —
 * prirejanje registrskih vnosov v produkciji je napaka, ne lastnost.
 */
export const AFFILIATE_PROVIDERS: readonly AffiliateProviderDef[] =
  Object.freeze([
    {
      id: "booking",
      name: "Booking.com",
      category: "stays",
      commissionPct: 6,
      descSl: "Nastanitve po vsej Sloveniji — hoteli, apartmaji, kmečki turizem.",
      descEn: "Accommodation across Slovenia — hotels, apartments, farm stays.",
      envId: "AFFILIATE_BOOKING_ID",
      envTmpl: "AFFILIATE_BOOKING_TMPL",
      publicTmpl:
        "https://www.booking.com/searchresults.html?ss={dest}&lang=sl",
      affiliateTmpl:
        "https://www.booking.com/searchresults.html?ss={dest}&lang=sl&aid={id}",
      domain: "booking.com",
    },
    {
      id: "getyourguide",
      name: "GetYourGuide",
      category: "experiences",
      commissionPct: 8,
      descSl: "Izkušnje, trenutki in vodiči — od sotesk do vinogradov.",
      descEn: "Experiences, tours and guides — from gorges to vineyards.",
      envId: "AFFILIATE_GYG_ID",
      envTmpl: "AFFILIATE_GYG_TMPL",
      publicTmpl: "https://www.getyourguide.com/s/?q={dest}",
      affiliateTmpl: "https://www.getyourguide.com/s/?q={dest}&partner_id={id}",
      domain: "getyourguide.com",
    },
    {
      id: "viator",
      name: "Viator (Tripadvisor)",
      category: "experiences",
      commissionPct: 8,
      descSl: "Izkušnje in izleti po svetu — Tripadvisorova družina ponudb.",
      descEn: "Experiences and tours worldwide — the Tripadvisor family.",
      envId: "AFFILIATE_VIATOR_ID",
      envTmpl: "AFFILIATE_VIATOR_TMPL",
      publicTmpl: "https://www.viator.com/searchResults/all?text={dest}",
      // Vzorec provizijskega parametra ni javno dokumentiran — ID sam ne
      // zgradi provizijske povezave; lastnikov TMPL nadomestilo jo lahko.
      affiliateTmpl: "",
      domain: "viator.com",
    },
    {
      id: "tiqets",
      name: "Tiqets",
      category: "tickets",
      commissionPct: null,
      descSl: "Vstopnice za muzeje in znamenitosti — takoj na telefon.",
      descEn: "Museum and attraction tickets — straight to your phone.",
      envId: "AFFILIATE_TIQETS_ID",
      envTmpl: "AFFILIATE_TIQETS_TMPL",
      publicTmpl: "https://www.tiqets.com/en/search?search_query={dest}",
      affiliateTmpl: "",
      domain: "tiqets.com",
    },
    {
      id: "kiwi",
      name: "Kiwi.com",
      category: "flights",
      commissionPct: 3,
      descSl: "Letalske karte z združevanjem letov prek vseh prevoznikov.",
      descEn: "Flight tickets combining carriers across the board.",
      envId: "AFFILIATE_KIWI_ID",
      envTmpl: "AFFILIATE_KIWI_TMPL",
      publicTmpl: "https://www.kiwi.com/en/search?query={dest}",
      affiliateTmpl: "https://www.kiwi.com/en/search?query={dest}&aid={id}",
      domain: "kiwi.com",
    },
    {
      id: "skyscanner",
      name: "Skyscanner",
      category: "flights",
      commissionPct: null,
      descSl: "Primerjava letov — iskanje izhodišča izbereš na strani.",
      descEn: "Flight comparison — pick your origin on their site.",
      envId: "AFFILIATE_SKYSCANNER_ID",
      envTmpl: "AFFILIATE_SKYSCANNER_TMPL",
      publicTmpl: "https://www.skyscanner.net/",
      affiliateTmpl: "",
      domain: "skyscanner.net",
    },
    {
      id: "rentalcars",
      name: "Rentalcars.com",
      category: "car",
      commissionPct: 6,
      descSl: "Rent-a-car po vsej Sloveniji — primerjava vseh agencij.",
      descEn: "Car rental across Slovenia — all agencies compared.",
      envId: "AFFILIATE_RENTALCARS_ID",
      envTmpl: "AFFILIATE_RENTALCARS_TMPL",
      publicTmpl: "https://www.rentalcars.com/?city={dest}",
      affiliateTmpl: "https://www.rentalcars.com/?city={dest}&adgroup={id}",
      domain: "rentalcars.com",
    },
    {
      id: "discovercars",
      name: "DiscoverCars",
      category: "car",
      commissionPct: null,
      descSl: "Najem avtov — brezplačna odpoved, primerjava cen.",
      descEn: "Car hire — free cancellation, price comparison.",
      envId: "AFFILIATE_DISCOVERCARS_ID",
      envTmpl: "AFFILIATE_DISCOVERCARS_TMPL",
      publicTmpl: "https://www.discovercars.com/{country}/{dest}",
      affiliateTmpl: "",
      domain: "discovercars.com",
    },
    {
      id: "omio",
      name: "Omio",
      category: "transfers",
      commissionPct: 4,
      descSl: "Vlaki in avtobusi — dobrodošli brez avta.",
      descEn: "Trains and buses — travel without a car.",
      envId: "AFFILIATE_OMIO_ID",
      envTmpl: "AFFILIATE_OMIO_TMPL",
      publicTmpl: "https://www.omio.com/search?resultsTo={dest}",
      affiliateTmpl:
        "https://www.omio.com/search?resultsTo={dest}&aid={id}",
      domain: "omio.com",
    },
    {
      id: "airalo",
      name: "Airalo",
      category: "esim",
      commissionPct: null,
      descSl: "eSIM paketi za potovanja — internet brez kartice.",
      descEn: "Travel eSIM packs — internet without a physical SIM.",
      envId: "AFFILIATE_AIRALO_ID",
      envTmpl: "AFFILIATE_AIRALO_TMPL",
      publicTmpl: "https://www.airalo.com/{country}-eSIM",
      // Brez znane države (splošne povezave) → domača stran z izbiro države.
      noCountryTmpl: "https://www.airalo.com/",
      affiliateTmpl: "",
      domain: "airalo.com",
    },
    {
      id: "worldnomads",
      name: "World Nomads",
      category: "insurance",
      commissionPct: null,
      descSl: "Popotniško zavarovanje — ponudba po državljanstvu.",
      descEn: "Travel insurance — quote by residency.",
      envId: "AFFILIATE_WORLDNOMADS_ID",
      envTmpl: "AFFILIATE_WORLDNOMADS_TMPL",
      publicTmpl: "https://www.worldnomads.com/travel-insurance",
      affiliateTmpl: "",
      domain: "worldnomads.com",
    },
    {
      id: "safetywing",
      name: "SafetyWing",
      category: "insurance",
      commissionPct: null,
      descSl: "Nomadsko zavarovanje — mesečno, kjerkoli na poti.",
      descEn: "Nomad insurance — monthly, anywhere on the road.",
      envId: "AFFILIATE_SAFETYWING_ID",
      envTmpl: "AFFILIATE_SAFETYWING_TMPL",
      publicTmpl: "https://safetywing.com/nomad-insurance",
      affiliateTmpl: "",
      domain: "safetywing.com",
    },
    {
      id: "osm-fuel",
      name: "Odprti podatki (OSM)",
      category: "fuel",
      commissionPct: 0,
      descSl: "Bencinske črpalke po zemljevidu — brezplačni odprti podatki.",
      descEn: "Fuel stations on the map — free open data.",
      envId: "",
      envTmpl: "",
      publicTmpl: "",
      affiliateTmpl: "",
      domain: "openstreetmap.org",
    },
  ]);

/** Iskanje partnerja po id (null za neznane — nikoli izjema). */
export function getProvider(
  id: string,
): AffiliateProviderDef | null {
  return (
    AFFILIATE_PROVIDERS.find((p) => p.id === id) ??
    null
  );
}

// ── Države v URL-jih partnerjev ({country} — preverjeni vzorci) ────────────

/**
 * Imena držav kanonskega nabora (cel Balkan — 10 držav), kot jih
 * uporabljajo javne strani partnerjev (npr. discovercars.com/slovenia/bled,
 * airalo.com/slovenia-eSIM — vzorci preverjeni s curl 200).
 *
 * R41-F4 (2.58.0): razširjeno s 6 novih balkanskih držav — vzorci za
 * airalo.com/{name}-eSIM IN discovercars.com/{name} živo preverjeni
 * (curl 200, 2026-10-14) za VSEH 10 držav:
 *   bosnia-and-herzegovina / serbia / macedonia / kosovo / bulgaria /
 *   greece (plus izvirne slovenia/croatia/montenegro/albania).
 * Zavrnjena kandidata (404 pri obeh ponudnikih): bosnia-herzegovina,
 * north-macedonia — ne izmišljujemo si, samo živo preverjeni vzorci.
 */
export const COUNTRY_URL_NAMES: Readonly<Record<string, string>> =
  Object.freeze({
    SI: "slovenia",
    HR: "croatia",
    ME: "montenegro",
    AL: "albania",
    BA: "bosnia-and-herzegovina",
    RS: "serbia",
    MK: "macedonia",
    XK: "kosovo",
    BG: "bulgaria",
    GR: "greece",
  });

/** Ime države za {country} v predlogi (null za neznano kodo). */
export function countryUrlName(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  return COUNTRY_URL_NAMES[countryCode.toUpperCase()] ?? null;
}

// ── Gradnja povezave (čista) ───────────────────────────────────────────────

export interface BuildLinkInput {
  provider: AffiliateProviderDef;
  /** Ime kraja/destinacije (npr. "Bled"). Prazno → izpusti {dest}. */
  destName?: string | null;
  /** Ime države za {country} (npr. "slovenia"). Prazno → izpusti {country}. */
  destCountryName?: string | null;
  /** Partnerjev ID ali null, kadar program še ni aktiviran. */
  affiliateId?: string | null;
  /** Lastnikova predloga iz env (podpora {id}, {dest}, {country}); prireja privzeto. */
  tmplOverride?: string | null;
}

export interface BuiltLink {
  /** Končni URL (javni ali provizijski). */
  url: string;
  /** Ali povezava nosi provizijski žeton. */
  affiliateActive: boolean;
  /** Uporabljena predloga (za dnevnike — brez ID vrednosti). */
  tmpl: "override" | "affiliate" | "public";
}

/** URL-nadomestitev {dest}, {country} in {id} (encodeURIComponent — varno za query). */
export function applyTemplate(
  tmpl: string,
  destName: string | null,
  affiliateId: string | null,
  destCountryName?: string | null,
): string {
  let out = tmpl;
  if (destName) {
    out = out.replaceAll("{dest}", encodeURIComponent(destName));
  }
  if (destCountryName) {
    out = out.replaceAll("{country}", encodeURIComponent(destCountryName));
  }
  if (affiliateId) {
    out = out.replaceAll("{id}", encodeURIComponent(affiliateId));
  }
  // Iskrenost: če predloga zahteva {dest}/{country}, ju ni pa bilo,
  // počistimo ostanek parametra, da URL ne vsebuje dobesednih oznak.
  if (!destName) {
    out = out
      .replaceAll("={dest}", "=")
      .replaceAll("&{dest}", "")
      .replaceAll("/{dest}", "")
      .replaceAll("{dest}", "");
  }
  if (!destCountryName) {
    out = out
      .replaceAll("={country}", "=")
      .replaceAll("&{country}", "")
      .replaceAll("/{country}/", "/")
      .replaceAll("/{country}", "")
      .replaceAll("{country}", "");
  }
  return out;
}

/**
 * Izgradi povezavo do partnerja. Vrsta reda (najvišja prednost prva):
 *  1. lastnikova predloga (env) — z ID, če je podan;
 *  2. privzeta provizijska predloga — SAMO če registrski vnos pozna
 *     vzorec (affiliateTmpl ≠ "") IN je ID podan;
 *  3. javna predloga — brez ID (partner koristen, klik zabeležen neaktiven).
 *
 * ISKRENOST: ID brez znanega vzorca (affiliateTmpl = "") NE more
 * prikazati provizijsko povezavo — pade na javno, affiliateActive:false
 * (lastnik vidi klik, ve da mora nastaviti TMPL iz programa).
 *
 * Za gorivo (osm-fuel) vrne javno domeno OpenStreetMap (ni rezervacija).
 */
export function buildPartnerLink(input: BuildLinkInput): BuiltLink {
  const { provider } = input;
  const destName = input.destName?.trim() || null;
  const destCountryName = input.destCountryName?.trim() || null;
  const affiliateId = input.affiliateId?.trim() || null;

  if (provider.category === "fuel") {
    return {
      url: "https://www.openstreetmap.org/",
      affiliateActive: false,
      tmpl: "public",
    };
  }

  if (input.tmplOverride?.trim()) {
    const overrideUrl = applyTemplate(
      input.tmplOverride,
      destName,
      affiliateId,
      destCountryName,
    );
    // P0 AUDIT: lastnikova predloga MORA biti https (javna vrata 302 —
    // http/javascript: sheme zavrnemo in iskreno pademo na javno predlogo).
    // Domena je zavestno NE preverjana: affiliate programi pogosto izdajo
    // vzorce na sledilnih domenah, ki se razlikujejo od glavne (test to zaklene).
    if (!overrideUrl.startsWith("https://")) {
      return {
        url: applyTemplate(
          provider.publicTmpl,
          destName,
          null,
          destCountryName,
        ),
        affiliateActive: false,
        tmpl: "public",
      };
    }
    return {
      url: overrideUrl,
      affiliateActive: Boolean(affiliateId),
      tmpl: "override",
    };
  }
  if (affiliateId && provider.affiliateTmpl) {
    return {
      url: applyTemplate(
        provider.affiliateTmpl,
        destName,
        affiliateId,
        destCountryName,
      ),
      affiliateActive: true,
      tmpl: "affiliate",
    };
  }
  // Javna predloga — z iskrenim namestnikom, kadar {country} manjka.
  if (
    !destCountryName &&
    provider.noCountryTmpl &&
    provider.publicTmpl.includes("{country}")
  ) {
    return {
      url: applyTemplate(provider.noCountryTmpl, null, null, null),
      affiliateActive: false,
      tmpl: "public",
    };
  }
  return {
    url: applyTemplate(
      provider.publicTmpl,
      destName,
      null,
      destCountryName,
    ),
    affiliateActive: false,
    tmpl: "public",
  };
}

// ── Ocena provizije (iz zneska rezervacije) ────────────────────────────────

export interface CommissionEstimate {
  /** Osnova (vrednost rezervacije). */
  baseEur: number;
  /** Ocenjena provizija (null, kadar odstotka ne poznamo). */
  commissionEur: number | null;
  /** Odstopek v % (iz registra — ocena, ne obljuba). null = neznano do pogodbe. */
  pct: number | null;
}

/**
 * Ocene provizije za dano vrednost rezervacije (negativne osnove → 0).
 * Za partnerje z neznanim odstotkom (pct null) je ocena null —
 * provizijo truthfully prinese samo partnerjevo poročilo.
 */
export function estimateCommission(
  provider: AffiliateProviderDef,
  baseEur: number,
): CommissionEstimate {
  const base = Number.isFinite(baseEur) && baseEur > 0 ? baseEur : 0;
  const pct = provider.commissionPct;
  if (pct == null) {
    return { baseEur: base, commissionEur: null, pct: null };
  }
  const commission = Math.round(base * (pct / 100) * 100) / 100;
  return { baseEur: base, commissionEur: commission, pct };
}

// ── Izplačilni koledar (vzorec MindTrip: T+3 meseci, 28. v mesecu) ─────────

/**
 * Predvideni datum izplačila: 3 mesece po zaključku bivanja/aktivnosti,
 * na 28. dan tega meseca (vzorec javno dokumentiran pri MindTrip).
 * Meseci se seštevajo koledarsko (14. 5. → 28. 8.).
 *
 * POPRAVEK (55-tests odkritje): aritmetika NE uporablja setMonth na dan
 * 29–31, ker bi ta prelil v naslednji mesec (30. 11. + 3 → „1. 3.“ → po
 * setDate(28) napačno 28. 3.). Mesec in leto seštejemo SAMI in stvar
 * sestavimo na dan 28 — ta obstaja v vseh mesecih, preliva ni nikoli.
 */
export function payoutDueDate(stayCompletedAt: Date): Date {
  const d = new Date(stayCompletedAt.getTime());
  if (Number.isNaN(d.getTime())) {
    return new Date(NaN);
  }
  const targetMonth0 = d.getMonth() + 3; // 0-indexirano, lahko ≥ 12
  const year = d.getFullYear() + Math.floor(targetMonth0 / 12);
  const month0 = targetMonth0 % 12;
  // Dan 28 obstaja v vseh mesecih — konstrukcija brez preliva.
  return new Date(Date.UTC(year, month0, 28, 12, 0, 0, 0));
}

// ── Najbližje letališče (za letalske povezave) ─────────────────────────────

export interface NearestAirport {
  code: string;
  nameSl: string;
  city: string;
}

/**
 * Letališča v dosegu Slovenije po regiji destinacije. ISKRENO:
 * hevristika po regiji kanonskega nabora, ne geografski izračun —
 * regija je vidna v UI, uporabnik lahko presodi.
 */
export function nearestAirportForRegion(region: string): NearestAirport {
  switch (region) {
    case "primorska":
    case "kras":
    // Posočje (2.22.0): Kobarid/korita Soče so bližje Trstu (~80 km) kot
    // Ljubljani (~120 km) — poštena bližina po regiji, glej slovenia-data.ts.
    case "posocje":
      return {
        code: "TRS",
        nameSl: "Letališče Trst (Ronchi)",
        city: "Trst",
      };
    case "stajerska":
    case "koroska":
      return {
        code: "GRZ",
        nameSl: "Letališče Gradec",
        city: "Gradec",
      };
    case "prekmurje":
      return {
        code: "BUD",
        nameSl: "Letališče Budimpešta",
        city: "Budimpešta",
      };
    default:
      return {
        code: "LJU",
        nameSl: "Letališče Jožeta Pučnika Ljubljana",
        city: "Ljubljana",
      };
  }
}

// ── Javni DTO (za /api/affiliate/providers — NIKOLI z ID žetoni) ──────────

export interface ProviderPublicDTO {
  id: AffiliateProviderId;
  name: string;
  category: AffiliateCategory;
  categoryLabel: AffiliateCategoryLabel;
  descSl: string;
  descEn: string;
  domain: string;
  /** Ali je kategorija provizijska (gorivo = false). */
  commissionable: boolean;
  /** Ocena provizije v % (null = neznana do pogodbe; 0 = gorivo). */
  commissionPct: number | null;
}

/** Javni seznam partnerjev (brez predlog in odstopkov). */
export function providersPublicDTO(): ProviderPublicDTO[] {
  return AFFILIATE_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    categoryLabel: AFFILIATE_CATEGORIES[p.category],
    descSl: p.descSl,
    descEn: p.descEn,
    domain: p.domain,
    commissionable: p.category !== "fuel",
    commissionPct: p.commissionPct,
  }));
}
