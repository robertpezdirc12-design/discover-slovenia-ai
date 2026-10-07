/**
 * AFFILIATE-PROVIDERS — čisti register rezervacijskih partnerjev (v2.5.0).
 *
 * Analiza vzorca MindTrip (mindtrip.ai, raziskano 2026-10-08 prek spletne
 * raziskave): njihova ponudba je ZMOŽNOST REZERVACIJE po celotnem
 * zemljevidu (stays/Booking.com 6 %, izkušnje/Viator 8 %, Priceline 6 %,
 * leti, rent-a-car) + provizijski dnevnik (Creator Hub: pending/completed/
 * history) + izplačila T+3 meseci po bivanju, 28. v mesecu.
 *
 * Ta register je SLOVENSKI odgovor: pošten, fail-closed in testabilen.
 *
 * KANONI (skladno s projektom):
 *  · ČISTA LOGIKA — brez process.env, brez db, brez stranskih učinkov;
 *    env (AFFILIATE_*_ID) bere IZKLJUČNO strežniški sloj ob KLICU
 *    (glej src/lib/affiliate-server.ts + /api/affiliate/go).
 *  · ISKRENOST — partner brez ID-ja še vedno preusmeri na JAVNO iskanje
 *    (uporabniku koristno), klik pa se zabeleži z affiliateActive:false,
 *    da lastnik vidi povpraševanje, ki ga (še) ne monizira.
 *  · PROVIZIJSKI ODSTOTKI so POGODBENI in se spreminjajo — zato so v
 *    registru vidno označeni kot ocena (estimate) iz javno dostopnih
 *    pogojev partnerskih programov, nikoli kot obljuba.
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
  | "fuel"; // bencinske črpalke — brez provizije

export interface AffiliateCategoryLabel {
  sl: string;
  en: string;
}

export const AFFILIATE_CATEGORIES: Record<
  AffiliateCategory,
  AffiliateCategoryLabel
> = {
  stays: { sl: "Nastanitve", en: "Stays" },
  experiences: { sl: "Doživetja", en: "Experiences" },
  flights: { sl: "Letalske karte", en: "Flights" },
  car: { sl: "Rent-a-car", en: "Car rental" },
  transfers: { sl: "Prevozi", en: "Transfers" },
  fuel: { sl: "Bencinske", en: "Fuel" },
};

// ── Registrski vnos partnerja ──────────────────────────────────────────────

export type AffiliateProviderId =
  | "booking"
  | "getyourguide"
  | "kiwi"
  | "rentalcars"
  | "omio"
  | "osm-fuel";

export interface AffiliateProviderDef {
  id: AffiliateProviderId;
  /** Javno ime partnerja. */
  name: string;
  category: AffiliateCategory;
  /** Ocena provizije v % (pogodbena — glej kanon zgoraj). 0 = brez provizije. */
  commissionPct: number;
  /** Kratek slovenski opis ponudbe partnerja. */
  descSl: string;
  descEn: string;
  /** Env spremenljivka z partnerjevim ID (brana SAMO na strežniku). */
  envId: string;
  /** Env spremenljivka z opisno predlogo povezave (neobvezna pregl. za lastnika). */
  envTmpl: string;
  /** Privzeta javna predloga povezave — {dest} se nadomesti z imenom kraja. */
  publicTmpl: string;
  /** Predloga z žetonom — {id} = partnerjev ID, {dest} = ime kraja. */
  affiliateTmpl: string;
  /** Domena partnerja (za prikaz uporabniku — "odpre pri …"). */
  domain: string;
}

/**
 * Register partnerjev. Zmrznjen (Object.freeze) — prirejanje registrskih
 * vnosov v produkciji je napaka, ne lastnost.
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

// ── Gradnja povezave (čista) ───────────────────────────────────────────────

export interface BuildLinkInput {
  provider: AffiliateProviderDef;
  /** Ime kraja/destinacije (npr. "Bled"). Prazno → izpusti {dest}. */
  destName?: string | null;
  /** Partnerjev ID ali null, kadar program še ni aktiviran. */
  affiliateId?: string | null;
  /** Lastnikova predloga iz env (podpora {id} in {dest}); prireja privzeto. */
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

/** URL-nadomestitev {dest} in {id} (oba encodeURIComponent — varno za query). */
export function applyTemplate(
  tmpl: string,
  destName: string | null,
  affiliateId: string | null,
): string {
  let out = tmpl;
  if (destName) {
    out = out.replaceAll("{dest}", encodeURIComponent(destName));
  }
  if (affiliateId) {
    out = out.replaceAll("{id}", encodeURIComponent(affiliateId));
  }
  // Iskrenost: če predloga zahteva {dest}, ga ni pa ni bilo, počistimo
  // ostanek parametra, da URL ne vsebuje dobesednega "{dest}".
  if (!destName) {
    out = out
      .replaceAll("={dest}", "=")
      .replaceAll("&{dest}", "")
      .replaceAll("{dest}", "");
  }
  return out;
}

/**
 * Izgradi povezavo do partnerja. Vrsta reda (najvišja prednost prva):
 *  1. lastnikova predloga (env) — z ID, če je podan;
 *  2. privzeta provizijska predloga — če je ID podan;
 *  3. javna predloga — brez ID (partner koristen, klik zabeležen neaktiven).
 *
 * Za gorivo (osm-fuel) vrne javno domeno OpenStreetMap (ni rezervacija).
 */
export function buildPartnerLink(input: BuildLinkInput): BuiltLink {
  const { provider } = input;
  const destName = input.destName?.trim() || null;
  const affiliateId = input.affiliateId?.trim() || null;

  if (provider.category === "fuel") {
    return {
      url: "https://www.openstreetmap.org/",
      affiliateActive: false,
      tmpl: "public",
    };
  }

  if (input.tmplOverride?.trim()) {
    return {
      url: applyTemplate(input.tmplOverride, destName, affiliateId),
      affiliateActive: Boolean(affiliateId),
      tmpl: "override",
    };
  }
  if (affiliateId) {
    return {
      url: applyTemplate(provider.affiliateTmpl, destName, affiliateId),
      affiliateActive: true,
      tmpl: "affiliate",
    };
  }
  return {
    url: applyTemplate(provider.publicTmpl, destName, null),
    affiliateActive: false,
    tmpl: "public",
  };
}

// ── Ocena provizije (iz zneska rezervacije) ────────────────────────────────

export interface CommissionEstimate {
  /** Osnova (vrednost rezervacije). */
  baseEur: number;
  /** Ocenjena provizija (zaokroženo na 2 decimalki). */
  commissionEur: number;
  /** Odstopek v % (iz registra — ocena, ne obljuba). */
  pct: number;
}

/** Ocene provizije za dano vrednost rezervacije (negativne → 0). */
export function estimateCommission(
  provider: AffiliateProviderDef,
  baseEur: number,
): CommissionEstimate {
  const base = Number.isFinite(baseEur) && baseEur > 0 ? baseEur : 0;
  const pct = provider.commissionPct;
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
  }));
}
