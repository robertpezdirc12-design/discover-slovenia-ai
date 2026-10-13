/**
 * E2E JOURNEY — celoten uporabniški tok DISCOVER → PLAN → BOOKING → NAVIGATION
 * kot testni scenarij prek ČISTIH lib funkcij (issue #1, acceptance kriterij
 * „dodani E2E testi za discover → plan → booking → navigation").
 *
 * House kanon: 0 omrežja, 0 DB, 0 DOM. Zbirka „Moja pot" je simulirana kot
 * vhodna struktura MyTripItem[] — točno to, kar v brskalniku vrne
 * myTrip.list() (bun test teče brez DOM, kjer modul ISENO poroča prazno).
 *
 * Sekvenčni scenarij „OD ODKRITJA DO ZAKLJUČENE POTI":
 *  1. DISCOVER  — prazno stanje → „Razišči Slovenijo"; izbira iz nabora 38;
 *  2. PLAN      — zbirka ≥ 2 → buildPlanFromMyTrip (vrstni red uporabnika);
 *  3. BOOKING   — searchDemoOffers → createDemoBooking (DSA-DEMO-XXXX) →
 *                 cancelDemoBooking (CANCELLED terminalen);
 *  4. NAVIGATION — go-gps veriga (razdalja/smer/ETA/odklon/napredek) +
 *                 zunanji handoff (parseRerouteBody, osmDirectionsUrl);
 *  5. ZAKLJUČEK — Go Mode aktiven → „Nadaljuj svojo pot";
 *  6. PARTNER (2.6.0) — isti načrt, rezervacija PRI partnerju (Booking.com
 *     idr.): searchPartnerOffers → createPartnerBooking (PENDING) →
 *     confirmPartnerBooking (uporabnikova atestacija) → navigacija ostane.
 *
 * Invariante čez CEL journey (zaklenjene v ločenih testih):
 *  - DETERMINIZEM: isti vhodi → isti izhodi v VSEH fazah;
 *  - ISKRENOST: brez GPS ETA ostane NEZNANO (0, nikoli izmišljen);
 *    realProviderStatus() je fail-closed — realni kanal NIKOLI ne obljubi;
 *  - KANALNA LOČENOST: demo rezervacija VEDNO nosi demo:true + kanal „demo";
 *  - PREHODI STATUSOV: veriga teče SKOZI ALLOWED_TRANSITIONS (booking.ts);
 *  - CELOVITOST PODATKOV: vsak slug postanka/ponudbe je iz nabora 38;
 *  - ATESTACIJSKA ZDRUŽLJIVOST: demo JSON preživi parseAttestationNote.
 */

import { describe, expect, test } from "bun:test";

import { DESTINATIONS, getDestination } from "../src/lib/slovenia-data";
import { myTrip } from "../src/lib/my-trip";
import {
  buildPlanFromMyTrip,
  osmDirectionsUrl,
  validatePlanGeo,
} from "../src/lib/itinerary-engine";
import {
  ETA_ROAD_FACTOR,
  ETA_SPEED_KMH,
  OFF_ROUTE_KM,
  bearingDeg,
  cardinalLabel,
  etaMinutes,
  haversineKm,
  offRouteCheck,
  osmDirectionsUrlWithOrigin,
  parseRerouteBody,
  progressAlongRoute,
  roundedPrivacy,
} from "../src/lib/go-gps";
import {
  DEMO_BOOKING_ID_PREFIX,
  DEMO_BOOKING_ID_RE,
  buildDemoNote,
  buildPartnerNote,
  cancelDemoBooking,
  cancelPartnerBooking,
  confirmPartnerBooking,
  createDemoBooking,
  createPartnerBooking,
  modifyDemoBooking,
  modifyPartnerBooking,
  parsePartnerNote,
  realProviderStatus,
  reservationChannelOf,
  resolveDemoOffer,
  searchDemoOffers,
  searchPartnerOffers,
} from "../src/lib/journey/booking-provider";
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  buildAttestationNote,
  canTransition,
  isTerminal,
  parseAttestationNote,
} from "../src/lib/journey/booking";
import { nextStepFor, type NextStepContext } from "../src/lib/next-step";
import type { MyTripItem } from "../src/lib/types";

// ─── Skupno stanje scenarija (deterministično — fiksni URI, brez ure) ──────

const NOW = new Date("2026-10-07T10:00:00Z");
const BOOKING_INPUT = { date: "2026-07-12", people: 2, name: "Ana Novak" };

const ctx = (patch: Partial<NextStepContext>): NextStepContext => ({
  myTripCount: 0,
  hasCloudTrip: false,
  hasPlan: false,
  planDays: 0,
  reservationCount: 0,
  confirmedCount: 0,
  goModeActive: false,
  ...patch,
});

const SLUGS = new Set(DESTINATIONS.map((d) => d.slug));

/**
 * DISCOVER → simulirana zbirka „Moja pot": točno struktura, ki jo v brskalniku
 * vrne myTrip.list() (refId = slug kanonske destinacije, kanon my-trip.ts).
 */
function myTripCollection(): MyTripItem[] {
  return ["ljubljana", "bled", "bohinj"].map((slug, i) => {
    const d = getDestination(slug);
    if (!d) throw new Error(`setup: slug „${slug}" ni kanonski`);
    return {
      refId: d.slug,
      name: d.name,
      kind: "destination",
      addedAt: new Date(NOW.getTime() + i * 60_000).toISOString(),
    };
  });
}

/** PLAN → osnutek načrta iz zbirke (čista funkcija itinerary-engine). */
const draft = () => buildPlanFromMyTrip(myTripCollection());

/** BOOKING → natančna demo ponudba za postanek Bled (iz iskanja, ne izmišljena). */
function exactOfferForBled() {
  const offer = searchDemoOffers("bled").find((o) => o.match === "exact");
  if (!offer) throw new Error("setup: pričakovana natančna ponudba za Bled");
  return offer;
}

/** BOOKING → potrjena demo rezervacija (strežniški simulator). */
function confirmedBooking() {
  const r = createDemoBooking(exactOfferForBled(), BOOKING_INPUT, NOW);
  if (!r.ok) throw new Error("setup: demo rezervacija mora uspeti");
  return r.booking;
}

/** NAVIGATION → prva noga načrta: prejšnji postanek (Ljubljana) + naslednji (Bled). */
function firstLeg() {
  const stops = draft().plan.days[0]!;
  return { prev: stops[0]!.coords!, next: stops[1]!.coords! };
}

/** Uporabnik na polovici noge načrta (točno na premici [prev, next]). */
function midOfLeg() {
  const { prev, next } = firstLeg();
  return { lat: (prev.lat + next.lat) / 2, lng: (prev.lng + next.lng) / 2 };
}

/** Uporabnik ~8,5 km vzhodno od noge načrta (odklon > 3 km). */
function offOfLeg() {
  const mid = midOfLeg();
  return { lat: mid.lat, lng: mid.lng + 0.15 };
}

// ─── 1. SCENARIJ: DISCOVER ─────────────────────────────────────────────────

describe("E2E 1 · DISCOVER — prazno stanje → izbira destinacij", () => {
  test("prazen obiskovalec: pomočnik predlaga „Razišči Slovenijo“ → /destinacije", () => {
    const s = nextStepFor(ctx({}));
    expect(s).not.toBeNull();
    expect(s!.id).toBe("explore-first");
    expect(s!.title).toBe("Razišči Slovenijo");
    expect(s!.ctaHref).toBe("/destinacije");
    expect(s!.reason.length).toBeGreaterThan(10);
  });

  test("zbirka „Moja pot“ v okolju brez DOM ostane ISENO prazna (nikoli izmišljena)", () => {
    // bun test teče brez brskalnika — localStorage ne obstaja in modul iskreno
    // poroča prazno zbirko (isti kanon kot na strežniku/SSR).
    expect(myTrip.list()).toEqual([]);
    expect(myTrip.count()).toBe(0);
    expect(myTrip.has("bled")).toBe(false);
  });

  test("izbira iz kanonskega nabora: 74 destinacij, getDestination(„bled“) z veljavnimi koordinatami", () => {
    const bled = getDestination("bled");
    expect(bled).toBeDefined();
    expect(bled!.slug).toBe("bled");
    expect(bled!.name).toBe("Bled");
    expect(bled!.coords.lat).toBeGreaterThan(45);
    expect(bled!.coords.lat).toBeLessThan(47);
    expect(bled!.coords.lng).toBeGreaterThan(13);
    expect(bled!.coords.lng).toBeLessThan(17);
    // Nabor kot vhod celotnega journeya: 38 enkratnih slugov, končne
    // koordinate znotraj cel Balkan (#41 F1).
    expect(DESTINATIONS.length).toBe(74);
    expect(new Set(DESTINATIONS.map((d) => d.slug)).size).toBe(74);
    expect(
      DESTINATIONS.every(
        (d) =>
          Number.isFinite(d.coords.lat) &&
          Number.isFinite(d.coords.lng) &&
          d.coords.lat >= 38 &&
          d.coords.lat <= 48 &&
          d.coords.lng >= 12 &&
          d.coords.lng <= 29
      )
    ).toBe(true);
  });
});

// ─── 2. SCENARIJ: PLAN ─────────────────────────────────────────────────────

describe("E2E 2 · PLAN — zbirka → osnutek načrta (buildPlanFromMyTrip)", () => {
  test("zbirka 3 destinacij zgradi 1-dnevni načrt: vrstni red uporabnika, koordinate, urnik od 09:00", () => {
    const { plan, unmatched } = draft();
    expect(unmatched).toEqual([]);
    expect(plan.days.length).toBe(1);
    expect(plan.dayTitles!.length).toBe(1);
    const stops = plan.days[0]!;
    expect(stops.length).toBe(3);
    // Vrstni red uporabnika se spoštuje (kanon osnutka iz zbirke).
    expect(stops.map((s) => s.slug)).toEqual(["ljubljana", "bled", "bohinj"]);
    // Vsak postanek ima koordinate (geo vhod za navigacijsko fazo).
    expect(
      stops.every(
        (s) =>
          !!s.coords && Number.isFinite(s.coords!.lat) && Number.isFinite(s.coords!.lng)
      )
    ).toBe(true);
    // Urnik: prvi postanek 09:00, vsi časi HH:MM in naraščajo.
    expect(stops[0]!.time).toBe("09:00");
    expect(stops.every((s) => /^\d{2}:\d{2}$/.test(s.time ?? ""))).toBe(true);
    expect(stops[1]!.time! > stops[0]!.time!).toBe(true);
    expect(stops[2]!.time! > stops[1]!.time!).toBe(true);
    // Cena je vsota kanonskih cen na osebo (20 + 25 + 15).
    expect(plan.totalCost).toBe(60);
  });

  test("zbirka ≥ 2 destinaciji brez načrta: pomočnik predlaga „Zgradi načrt iz zbirke“ → /nacrtuj", () => {
    const s = nextStepFor(ctx({ myTripCount: 3 }));
    expect(s!.id).toBe("build-plan");
    expect(s!.title).toBe("Zgradi načrt iz zbirke");
    expect(s!.ctaHref).toBe("/nacrtuj");
    expect(s!.reason).toContain("3 dodane destinacije");
    expect(s!.reason).toContain("brez načrta");
  });

  test("iskrenost osnutka: nekanonski zapis ostane v „unmatched“; geo validacija razkrije preobremenjen dan", () => {
    const custom: MyTripItem = {
      refId: "zasebni-spomin",
      name: "Zasebni spomin",
      kind: "custom",
      addedAt: NOW.toISOString(),
    };
    const { plan, unmatched } = buildPlanFromMyTrip([...myTripCollection(), custom]);
    expect(unmatched.length).toBe(1);
    expect(unmatched[0]!.refId).toBe("zasebni-spomin");
    expect(plan.days[0]!.map((s) => s.slug)).toEqual(["ljubljana", "bled", "bohinj"]);
    // Iskrena plast NAD osnutkom: 3 po 270 min + vožnje → dan je preobremenjen
    // (najmanj opozorilo; osnutek je osnutek — „preveri izvedljivost").
    const geo = validatePlanGeo(draft().plan);
    expect(geo.worst).not.toBe("ok");
    expect(geo.issues.some((i) => i.rule === "day_overload")).toBe(true);
  });
});

// ─── 3. SCENARIJ: BOOKING ──────────────────────────────────────────────────

describe("E2E 3 · BOOKING — načrt → ponudba → demo rezervacija → preklic", () => {
  test("načrt brez rezervacij: pomočnik predlaga „Rezerviraj vnaprej“ → /trznica", () => {
    const { plan } = draft();
    const s = nextStepFor(
      ctx({ hasPlan: true, planDays: plan.days.length, reservationCount: 0 })
    );
    expect(s!.id).toBe("book-ahead");
    expect(s!.title).toBe("Rezerviraj vnaprej");
    expect(s!.ctaHref).toBe("/trznica");
    expect(s!.reason).toContain("1-dnevni načrt");
  });

  test("searchDemoOffers za postanke načrta → vsak ima ≥ 1 ponudbo; Bled prvo natančno", () => {
    const stops = draft().plan.days[0]!;
    for (const stop of stops) {
      const offers = searchDemoOffers(stop.slug!);
      expect(offers.length).toBeGreaterThanOrEqual(1);
      for (const o of offers) expect(o.pricePerPerson).toBeGreaterThan(0);
    }
    const exact = exactOfferForBled();
    expect(exact.match).toBe("exact");
    expect(exact.destinationSlug).toBe("bled");
    // Ponudba je ZA postanek NAŠEGA načrta (povezava med fazama PLAN → BOOKING).
    expect(stops.some((s) => s.slug === exact.destinationSlug)).toBe(true);
    expect(exact.currency).toBe("EUR");
  });

  test("createDemoBooking → CONFIRMED s številko DSA-DEMO-XXXX (kanal demo, izrecno razkrito)", () => {
    const b = confirmedBooking();
    expect(b.status).toBe("CONFIRMED");
    expect(b.providerBookingId).toMatch(DEMO_BOOKING_ID_RE);
    expect(b.providerBookingId.startsWith(DEMO_BOOKING_ID_PREFIX)).toBe(true);
    expect(b.date).toBe(BOOKING_INPUT.date);
    expect(b.people).toBe(2);
    // Cena = kanonska cena ponudbe × število ljudi (nikudar ne izmišljena).
    expect(b.pricePerPerson).toBeGreaterThan(0);
    expect(b.price).toBe(b.pricePerPerson * 2);
  });

  test("cancelDemoBooking → CANCELLED terminalen (brez povratkov v življenjskem ciklu)", () => {
    const c = cancelDemoBooking(confirmedBooking());
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.booking.status).toBe("CANCELLED");
    expect(isTerminal(c.booking.status)).toBe(true);
    // Ponovni preklic istega zapisa je zavrnjen (iz terminalnega stanja ni izhoda).
    expect(cancelDemoBooking(c.booking).ok).toBe(false);
  });
});

// ─── 4. SCENARIJ: NAVIGATION ───────────────────────────────────────────────

describe("E2E 4 · NAVIGATION — živi GPS proti naslednjemu postanku", () => {
  test("razdalja do naslednjega postanka > 0; ETA ocena premočrtna ×1,3 pri ~55 km/h", () => {
    const { prev, next } = firstLeg();
    const user = midOfLeg();
    const straight = haversineKm(user, next);
    expect(straight).toBeGreaterThan(0);
    expect(straight).toBeLessThan(haversineKm(prev, next)); // cilj je še pred nami
    const eta = etaMinutes(straight);
    expect(eta).toBeGreaterThan(0);
    expect(eta).toBe(Math.round(((straight * ETA_ROAD_FACTOR) / ETA_SPEED_KMH) * 60));
  });

  test("smer (bearing) veljavna 0–360; s sredine noge proti Bledu SZ/NW", () => {
    const deg = bearingDeg(midOfLeg(), firstLeg().next);
    expect(deg).toBeGreaterThanOrEqual(0);
    expect(deg).toBeLessThan(360);
    expect(deg).toBeGreaterThan(300); // ~318° po kanonu LJ→Bled
    expect(deg).toBeLessThan(335);
    expect(cardinalLabel(deg, "sl")).toBe("SZ");
    expect(cardinalLabel(deg, "en")).toBe("NW");
  });

  test("offRouteCheck: na poti (noga načrta [prejšnji, naslednji]) false; > 3 km stran true", () => {
    const { prev, next } = firstLeg();
    const on = offRouteCheck(midOfLeg(), next, [prev, next]);
    expect(on.offRoute).toBe(false);
    expect(on.basis).toBe("route");
    expect(on.deviationKm).toBeLessThanOrEqual(OFF_ROUTE_KM);
    const off = offRouteCheck(offOfLeg(), next, [prev, next]);
    expect(off.offRoute).toBe(true);
    expect(off.deviationKm).toBeGreaterThan(OFF_ROUTE_KM);
  });

  test("progressAlongRoute: na startu 0, na sredini poti 50, na cilju 100", () => {
    const { prev, next } = firstLeg();
    expect(progressAlongRoute(prev, prev, next)).toBe(0);
    expect(progressAlongRoute(midOfLeg(), prev, next)).toBe(50);
    expect(progressAlongRoute(next, prev, next)).toBe(100);
  });

  test("zunanji handoff: parseRerouteBody({from: GPS, to: „bled“}) veljaven; OSM URL iz koordinat načrta", () => {
    // Preračun poti: uporabniška fiksacija gre ven SAMO zaokrožena na 4 decimale (~11 m).
    const mid = midOfLeg();
    const gpsFix = { lat: mid.lat + 0.00001234, lng: mid.lng + 0.14987654 };
    const body = parseRerouteBody({ from: roundedPrivacy(gpsFix), to: "bled" }, SLUGS);
    expect(body).not.toBeNull();
    expect(body!.to).toBe("bled");
    expect(body!.from.lat).toBe(46.2126);
    expect(body!.from.lng).toBe(14.45);
    // Navigacijski gumb: OSM directions s koordinatama naslednjega postanka.
    const { next } = firstLeg();
    expect(osmDirectionsUrl(next)).toBe(
      `https://www.openstreetmap.org/directions?to=${next.lat}%2C${next.lng}`
    );
    // Z živim GPS tudi oblika z izhodiščem (isti zunanji handoff kanon).
    expect(osmDirectionsUrlWithOrigin(mid, next)).toContain(
      `from=${mid.lat}%2C${mid.lng}`
    );
  });
});

// ─── 5. SCENARIJ: ZAKLJUČEK ────────────────────────────────────────────────

describe("E2E 5 · ZAKLJUČEK — od priprave na pot do Go Mode", () => {
  test("po potrjeni rezervaciji → „Pripravi se na pot“; Go Mode aktiven → „Nadaljuj svojo pot“", () => {
    const afterBooking = ctx({
      hasPlan: true,
      planDays: 1,
      reservationCount: 1,
      confirmedCount: 1,
    });
    const prep = nextStepFor(afterBooking);
    expect(prep!.id).toBe("prepare-go");
    expect(prep!.ctaHref).toBe("/na-poti");
    const onTheRoad = nextStepFor(ctx({ ...afterBooking, goModeActive: true }));
    expect(onTheRoad!.id).toBe("go-resume");
    expect(onTheRoad!.title).toBe("Nadaljuj svojo pot");
    expect(onTheRoad!.ctaHref).toBe("/na-poti");
  });
});

// ─── INVARIANTE: DETERMINIZEM ──────────────────────────────────────────────

describe("E2E invarianta · DETERMINIZEM — isti vhodi → isti izhodi (vse faze)", () => {
  test("plan, booking in next-step: ponovljeni klici dajo identične izide", () => {
    expect(buildPlanFromMyTrip(myTripCollection())).toEqual(
      buildPlanFromMyTrip(myTripCollection())
    );
    const a = createDemoBooking(exactOfferForBled(), BOOKING_INPUT, NOW);
    const b = createDemoBooking(exactOfferForBled(), BOOKING_INPUT, NOW);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.booking).toEqual(b.booking); // vključno s številko DSA-DEMO-XXXX
    const c = ctx({ myTripCount: 3 });
    expect(nextStepFor(c)).toEqual(nextStepFor(c));
  });

  test("cel journey dvakrat izpeljan → identični artefakti (slugi, cena, št. rezervacije, ETA, napredek)", () => {
    const runJourney = () => {
      const items = myTripCollection(); // DISCOVER
      const { plan } = buildPlanFromMyTrip(items); // PLAN
      const stops = plan.days[0]!;
      const nextStop = stops[1]!;
      const offer = searchDemoOffers(nextStop.slug!).find((o) => o.match === "exact")!;
      const r = createDemoBooking(offer, BOOKING_INPUT, NOW); // BOOKING
      if (!r.ok) throw new Error("setup: journey booking");
      const { prev, next } = { prev: stops[0]!.coords!, next: nextStop.coords! };
      return {
        slugs: stops.map((s) => s.slug),
        totalCost: plan.totalCost,
        bookingId: r.booking.providerBookingId,
        bookingStatus: r.booking.status,
        eta: etaMinutes(haversineKm(midOfLeg(), next)), // NAVIGATION
        bearing: Math.round(bearingDeg(midOfLeg(), next)),
        progress: progressAlongRoute(midOfLeg(), prev, next),
        offRoute: offRouteCheck(offOfLeg(), next, [prev, next]).offRoute,
      };
    };
    expect(runJourney()).toEqual(runJourney());
  });
});

// ─── INVARIANTE: ISKRENOST ─────────────────────────────────────────────────

describe("E2E invarianta · ISKRENOST — brez GPS in brez poverilnic NIČ ni izmišljeno", () => {
  test("brez GPS ETA ostane NEZNANO (etaMinutes → 0); brez geometrije odklon ni izmišljen", () => {
    // Neznana/negativna/NaN razdalja = „fiksacije ni“ → funkcija NE izmisli časa
    // (UI v tem stanju izrecno prikazuje ETA NEZNANO).
    expect(etaMinutes(0)).toBe(0);
    expect(etaMinutes(-42)).toBe(0);
    expect(etaMinutes(Number.NaN)).toBe(0);
    expect(etaMinutes(Number.POSITIVE_INFINITY)).toBe(0);
    // Brez routeCoords odklon NI izmerjen — iskrena degradacija na bazo
    // „straight“ z odklonom 0 (razkrito, nikoli pristransko ugibanje).
    const bare = offRouteCheck(offOfLeg(), firstLeg().next);
    expect(bare.basis).toBe("straight");
    expect(bare.deviationKm).toBe(0);
    expect(bare.offRoute).toBe(false);
  });

  test("realProviderStatus je fail-closed: configured:false — realni kanal NIKOLI ne obljubi", () => {
    const s = realProviderStatus();
    expect(s.channel).toBe("real");
    expect(s.configured).toBe(false); // literal false (0 poverilnic = 0 laži)
    expect(s.reason.length).toBeGreaterThan(20);
    expect(realProviderStatus()).toEqual(s); // deterministično odklon
  });
});

// ─── INVARIANTE: KANALNA LOČENOST ──────────────────────────────────────────

describe("E2E invarianta · KANALNA LOČENOST — demo se NIKOLI ne ponaša kot realen", () => {
  test("demo rezervacija VEDNO nosi demo:true + kanal „demo“ (ob potrditvi in po preklicu)", () => {
    const b = confirmedBooking();
    expect(b.channel).toBe("demo");
    expect(b.demo).toBe(true);
    const c = cancelDemoBooking(b);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.booking.channel).toBe("demo");
    expect(c.booking.demo).toBe(true);
    // Razkritje preživi tudi zapis v `note` (kanal razpoznan iz zapisa).
    expect(reservationChannelOf(buildDemoNote(b))).toBe("demo");
    expect(reservationChannelOf(buildDemoNote(c.booking))).toBe("demo");
  });

  test("atestacijska združljivost: demo JSON preživi parseAttestationNote; kanal demo ≠ uporabniška atestacija", () => {
    const b = confirmedBooking();
    const att = parseAttestationNote(buildDemoNote(b));
    expect(att).not.toBeNull();
    expect(att!.source).toBe("USER");
    expect(att!.providerBookingId).toBe(b.providerBookingId);
    expect(att!.confirmedPrice).toBe(b.price);
    // Kontrast: navadna uporabniška atestacija NI demo (kanala se ne mešata).
    const userAtt = buildAttestationNote({
      source: "USER",
      providerBookingId: "HOTEL-BLED-114",
      confirmedPrice: 90,
    });
    expect(reservationChannelOf(userAtt)).toBe("user");
  });
});

// ─── INVARIANTE: PREHODI STATUSOV ──────────────────────────────────────────

describe("E2E invarianta · PREHODI STATUSOV — booking veriga spoštuje ALLOWED_TRANSITIONS", () => {
  test("matrika kanona: CONFIRMED→CANCELLED dovoljen; CANCELLED→CONFIRMED ZAVRNJEN", () => {
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(assertTransition("CANCELLED", "CONFIRMED").ok).toBe(false);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]); // terminalen = brez izhodov
    expect(isTerminal("CANCELLED")).toBe(true);
  });

  test("cel cikel demo rezervacije CONFIRMED→MODIFIED→CANCELLED ostane znotraj matrike", () => {
    const b = confirmedBooking();
    const m = modifyDemoBooking(b, { people: 3 });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(canTransition("CONFIRMED", "MODIFIED")).toBe(true);
    expect(m.booking.status).toBe("MODIFIED");
    expect(m.booking.providerBookingId).toBe(b.providerBookingId); // stabilna št.
    expect(m.booking.price).toBe(m.booking.pricePerPerson * 3);
    const c = cancelDemoBooking(m.booking);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(canTransition("MODIFIED", "CANCELLED")).toBe(true);
    // Po preklicu nič več (tudi sprememba odpove — terminalno stanje).
    expect(modifyDemoBooking(c.booking, { people: 2 }).ok).toBe(false);
  });
});

// ─── INVARIANTE: CELOVITOST PODATKOV ───────────────────────────────────────

describe("E2E invarianta · CELOVITOST PODATKOV — vse izhaja iz kanonskega nabora 74", () => {
  test("načrt iz VSEH 74 destinacij: vsak postanek veljaven slug + koordinate; ponudbe nosijo samo kanonske slug-e", () => {
    const all: MyTripItem[] = DESTINATIONS.map((d, i) => ({
      refId: d.slug,
      name: d.name,
      kind: "destination",
      addedAt: new Date(NOW.getTime() + i * 60_000).toISOString(),
    }));
    const { plan, unmatched } = buildPlanFromMyTrip(all);
    expect(unmatched).toEqual([]);
    const stops = plan.days[0]!;
    expect(stops.length).toBe(74);
    expect(new Set(stops.map((s) => s.slug)).size).toBe(74); // brez dvojnikov
    expect(
      stops.every(
        (s) => SLUGS.has(s.slug!) && getDestination(s.slug!) !== undefined && !!s.coords
      )
    ).toBe(true);
    expect(plan.totalCost).toBeGreaterThan(0);
    // Booking faza: ponudbe iz lastnih izdelkov nosijo SAMO kanonske slug-e.
    for (const o of searchDemoOffers("bled")) {
      expect(SLUGS.has(o.destinationSlug)).toBe(true);
    }
  });
});

// ─── ROBNI PRIMERI ─────────────────────────────────────────────────────────

describe("E2E robni primeri — iskrene meje", () => {
  test("PRAZNA zbirka → načrt PRAZEN (days [], dayTitles []) — nič izmišljenih dni", () => {
    const { plan, unmatched } = buildPlanFromMyTrip([]);
    expect(plan.days).toEqual([]);
    expect(plan.dayTitles).toEqual([]);
    expect(unmatched).toEqual([]);
    expect(plan.totalCost).toBe(0);
  });

  test("neveljaven slug v reroute telesu → parseRerouteBody zavrne (null)", () => {
    const mid = midOfLeg();
    expect(parseRerouteBody({ from: mid, to: "atlantida" }, SLUGS)).toBeNull();
    expect(parseRerouteBody({ from: mid, to: "" }, SLUGS)).toBeNull();
    expect(parseRerouteBody({ from: mid }, SLUGS)).toBeNull();
    expect(parseRerouteBody({ from: { lat: 90.1, lng: 14.3 }, to: "bled" }, SLUGS)).toBeNull();
    expect(parseRerouteBody({ from: { lat: 46.2, lng: 200 }, to: "bled" }, SLUGS)).toBeNull();
    expect(parseRerouteBody(null, SLUGS)).toBeNull();
  });

  test("ponudbe za neobstoječo destinacijo → PRAZNA množica zadetkov ZA TA postanek", () => {
    const offers = searchDemoOffers("atlantida");
    // Nič se ne izmišljuje: nobena ponudba ne trdi, da je ZA ta postanek.
    expect(offers.filter((o) => o.match === "exact" || o.match === "region")).toEqual([]);
    for (const o of offers) {
      expect(o.match).toBe("suggested"); // iskreno dopolnilo, ne vezano na postanek
      expect(o.destinationSlug).not.toBe("atlantida"); // nikoli izmišljen slug
      expect(SLUGS.has(o.destinationSlug)).toBe(true); // lastne destinacije
    }
    // Neobstoječ ID ponudbe se ne razreši (null — ne izmišljene cene).
    expect(resolveDemoOffer("ne-obstojeca-ponudba")).toBeNull();
  });
});

// ─── 6. PARTNER SEGMENT (2.6.0 — vzorec MindTrip) ───────────────────────────

/**
 * PARTNER kanal (2.6.0): realna rezervacija PRI partnerju (Booking.com,
 * GetYourGuide, Kiwi, Rentalcars, Omio) prek vodenih povezav
 * /api/affiliate/go. Aplikacija sledi stanju: PENDING (čaka partnerjevo
 * potrditev) → CONFIRMED (uporabnikova atestacija s številko + ceno iz
 * potrdila) → MODIFIED/CANCELLED (dejavnost teče pri partnerju).
 * Isti načrt iz SCENARIJA 2 — le rezervacijski kanal je partner, ne demo.
 */
describe("E2E 6 · PARTNER — načrt → partner booking → navigacija", () => {
  /** Partner ponudba Booking.com za postanek Bled NAŠEGA načrta. */
  function partnerOfferForBled() {
    const offer = searchPartnerOffers("bled").find((o) => o.providerId === "booking");
    if (!offer) throw new Error("setup: pričakovana partner ponudba za Bled");
    return offer;
  }

  /** Sveža PENDING partner rezervacija za postanek načrta. */
  function partnerPending() {
    const r = createPartnerBooking(partnerOfferForBled(), BOOKING_INPUT, NOW);
    if (!r.ok) throw new Error("setup: partner rezervacija mora uspeti");
    return r.booking;
  }

  test("plan → partner iskanje za postanek načrta: 9 ponudb (P0-F), vse vezane na dest=bled", () => {
    const stops = draft().plan.days[0]!;
    const bledStop = stops.find((s) => s.slug === "bled")!;
    expect(bledStop).toBeDefined();
    // Iskanje po slugu postanka NAŠEGA načrta (faza PLAN → BOOKING).
    const offers = searchPartnerOffers(bledStop.slug!);
    expect(offers.length).toBe(9);
    for (const o of offers) {
      expect(o.goPath).toBe(`/api/affiliate/go?provider=${o.providerId}&dest=bled`);
      expect(o.match).toBe("destination");
      expect(o.destinationName).toBe("Bled");
      // Vodena povezava je RELATIVNA pot lastnega API-ja (žeton nikoli v klientu).
      expect(o.goPath.startsWith("/api/affiliate/go?")).toBe(true);
    }
    // Gorivo NI rezervacijska kategorija — nikoli med partner ponudbami.
    expect(offers.some((o) => o.category === "fuel")).toBe(false);
    // Leti za gorenjsko nosijo letališče regije (iskreno razkritje) — oba
    // letalska partnerja (P0-F: kiwi + skyscanner).
    const flights = offers.filter((o) => o.category === "flights");
    expect(flights.length).toBe(2);
    for (const f of flights) {
      expect(f.airport!.code).toBe("LJU");
    }
  });

  test("createPartnerBooking → PENDING (rezervacija se zgodi pri partnerju, ne pri nas)", () => {
    const b = partnerPending();
    expect(b.status).toBe("PENDING");
    expect(b.channel).toBe("partner");
    expect(b.partner).toBe(true);
    expect(b.providerBookingId).toBeNull(); // številko izstavi partner
    expect(b.confirmedPrice).toBeNull(); // ceno določi partner na svoji strani
    expect(b.date).toBe(BOOKING_INPUT.date);
    expect(b.people).toBe(BOOKING_INPUT.people);
    // Zapis v `note` je zvest tretji osebi (partnerju) — round-trip.
    const again = parsePartnerNote(buildPartnerNote(b));
    expect(again).toEqual(b);
    expect(again!.status).toBe("PENDING");
  });

  test("confirmPartnerBooking (atestacija iz potrdila) → CONFIRMED; kanal je partner", () => {
    const r = confirmPartnerBooking(partnerPending(), {
      providerBookingId: "BK-2026-114",
      confirmedPrice: 189.9,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.status).toBe("CONFIRMED");
    expect(r.booking.providerBookingId).toBe("BK-2026-114");
    expect(r.booking.confirmedPrice).toBe(189.9);
    // KLJUČNO: partner zapis nosi source:"USER", a je kanal IZRECNO partner.
    const note = buildPartnerNote(r.booking);
    expect(reservationChannelOf(note)).toBe("partner");
    expect(parsePartnerNote(note)).toEqual(r.booking);
    // Kontrast z demo fazo: kanala se NE mešata (isti načrt, dva kanala).
    expect(reservationChannelOf(buildDemoNote(confirmedBooking()))).toBe("demo");
  });

  test("navigacija: osmDirectionsUrl do postanka Bled ostane uporaben (zunanji handoff)", () => {
    // Rezervacija pri partnerju NE odvzame navigacije do postanka —
    // isti zunanji handoff kot v SCENARIJU 4.
    const { next } = firstLeg(); // naslednji postanek = Bled iz NAŠEGA načrta
    expect(next).toBeDefined();
    expect(osmDirectionsUrl(next)).toBe(
      `https://www.openstreetmap.org/directions?to=${next.lat}%2C${next.lng}`
    );
    const mid = midOfLeg();
    expect(osmDirectionsUrlWithOrigin(mid, next)).toContain(`from=${mid.lat}%2C${mid.lng}`);
    // ETA do postanka ostane ista iskrena ocena (neodvisna od kanala rezervacije).
    expect(etaMinutes(haversineKm(mid, next))).toBeGreaterThan(0);
  });

  test("cel partner cikel na našem načrtu: PENDING → CONFIRMED → MODIFIED → CANCELLED, kanal partner povsod", () => {
    const pending = partnerPending();
    const confirmed = confirmPartnerBooking(pending, {
      providerBookingId: "BK-2026-114",
      confirmedPrice: 189.9,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    const modified = modifyPartnerBooking(confirmed.booking, { people: 4 });
    expect(modified.ok).toBe(true);
    if (!modified.ok) return;
    expect(modified.booking.status).toBe("MODIFIED");
    const cancelled = cancelPartnerBooking(modified.booking);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.booking.status).toBe("CANCELLED");
    expect(isTerminal(cancelled.booking.status)).toBe(true);
    // Iskrenost čez cel cikel: vsak zapis je partner, vsaka nota razkrije partner.
    for (const b of [pending, confirmed.booking, modified.booking, cancelled.booking]) {
      expect(b.channel).toBe("partner");
      expect(b.partner).toBe(true);
      expect(reservationChannelOf(buildPartnerNote(b))).toBe("partner");
      expect(parsePartnerNote(buildPartnerNote(b))).toEqual(b);
    }
    // PENDING faza je iskreno brez atestacije; CONFIRMED jo nosi naprej.
    expect(pending.providerBookingId).toBeNull();
    expect(confirmed.booking.providerBookingId).toBe("BK-2026-114");
    expect(modified.booking.providerBookingId).toBe("BK-2026-114");
  });
});
