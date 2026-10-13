/**
 * GO-GPS — čiste izračunske funkcije žive GPS navigacije
 * (src/lib/go-gps.ts) BREZ omrežja in brez DOM (kanon testne hiše).
 *
 * Iskrenostne invariante (issue #1 področje 1):
 *  - haversine po kanonu geo-distance izvirnika (R = 6371); Ljubljana→Bled
 *    ≈ 46,9 km premočno (cestna ocena ×1,3 ≈ 61 km; realna OSRM pot je
 *    ~77 km — ocena je pošteno razkrita kot približek, nikoli izmišljena);
 *  - ETA = premočrtna ×1,3 pri ~55 km/h (neveljaven vhod → 0, nikoli izmislek);
 *  - odklon brez routeCoords NI izmišljen: baza "straight", odklon 0
 *    (razkrito); s polilinijo pa point-to-segment, prag OFF_ROUTE_KM = 3 km;
 *  - roundedPrivacy: 4 decimale (~11 m) — edina oblika, ki zapusti klienta;
 *  - parseRerouteBody: lat ±90 / lng ±180, to iz dovoljenega nabora slug-ov;
 *  - isJourneyRouteResponse: klient ne zaupa slepo žici.
 */

import { describe, expect, test } from "bun:test";

import {
  ARRIVAL_RADIUS_KM,
  arrivalCheck,
  bearingDeg,
  cardinalIndex,
  cardinalLabel,
  cardinalName,
  EARTH_RADIUS_KM,
  ETA_ROAD_FACTOR,
  ETA_SPEED_KMH,
  etaMinutes,
  geoUri,
  haversineKm,
  isJourneyRouteResponse,
  OFF_ROUTE_KM,
  offRouteCheck,
  osmDirectionsUrlWithOrigin,
  parseRerouteBody,
  pointToSegmentKm,
  progressAlongRoute,
  roundedPrivacy,
} from "../src/lib/go-gps";

const LJ = { lat: 46.0569, lng: 14.5058 };
const BLED = { lat: 46.3683, lng: 14.0944 };

/** Premica „na poti“: A → B proti severu (0,2° lat ≈ 22,1 km). */
const A = { lat: 46.0, lng: 14.0 };
const B = { lat: 46.2, lng: 14.0 };
/** ~2,3 km vzhodno od premice — še NA poti (< 3 km). */
const USER_ON = { lat: 46.1, lng: 14.03 };
/** ~4,6 km vzhodno od premice — IZVEN (> 3 km). */
const USER_OFF = { lat: 46.1, lng: 14.06 };

describe("go-gps: haversine (kanon geo-distance, R = 6371)", () => {
  test("Ljubljana→Bled ≈ 46,9 km premočno (cestna ocena ×1,3 ≈ 61 km); simetrično; 0 za isto točko", () => {
    const d = haversineKm(LJ, BLED);
    expect(d).toBeGreaterThan(46);
    expect(d).toBeLessThan(48);
    expect(EARTH_RADIUS_KM).toBe(6371);
    // Cestna ocena (ista formula kot UI): ~61 km — pošteno razkrit približek.
    expect(d * ETA_ROAD_FACTOR).toBeGreaterThan(60);
    expect(d * ETA_ROAD_FACTOR).toBeLessThan(62);
    expect(haversineKm(BLED, LJ)).toBeCloseTo(d, 8);
    expect(haversineKm(LJ, LJ)).toBe(0);
  });

  test("par po poldnevniku: 1° latituda ≈ 111 km", () => {
    const d = haversineKm({ lat: 46, lng: 14 }, { lat: 47, lng: 14 });
    expect(d).toBeGreaterThan(110.5);
    expect(d).toBeLessThan(112);
  });
});

describe("go-gps: bearing in kardinalne oznake (8 sektorjev)", () => {
  test("4 glavne smeri: sever 0°, vzhod ~90°, jug 180°, zahod ~270°", () => {
    expect(bearingDeg({ lat: 46, lng: 14 }, { lat: 46.5, lng: 14 })).toBe(0);
    expect(
      bearingDeg({ lat: 46, lng: 14 }, { lat: 46, lng: 14.5 })
    ).toBeCloseTo(90, 0);
    expect(bearingDeg({ lat: 46, lng: 14 }, { lat: 45.5, lng: 14 })).toBe(180);
    expect(
      bearingDeg({ lat: 46, lng: 14 }, { lat: 46, lng: 13.5 })
    ).toBeCloseTo(270, 0);
  });

  test("meje sektorjev (±22,5°): 22,4° = S/N, 22,6° = SV/NE, 337,4° = SZ/NW, 337,6° = S/N", () => {
    expect(cardinalLabel(22.4, "sl")).toBe("S");
    expect(cardinalLabel(22.4, "en")).toBe("N");
    expect(cardinalLabel(22.6, "sl")).toBe("SV");
    expect(cardinalLabel(22.6, "en")).toBe("NE");
    expect(cardinalLabel(337.4, "sl")).toBe("SZ");
    expect(cardinalLabel(337.4, "en")).toBe("NW");
    expect(cardinalLabel(337.6, "sl")).toBe("S");
    expect(cardinalLabel(337.6, "en")).toBe("N");
    expect(cardinalLabel(0, "sl")).toBe("S"); // 0° = sever (SL okrajšava S)
    expect(cardinalLabel(0, "en")).toBe("N");
  });

  test("diagonale 45/135/225/315 + negativni koti normalizirani (−90 = zahod)", () => {
    expect(cardinalLabel(45, "sl")).toBe("SV");
    expect(cardinalLabel(90, "sl")).toBe("V"); // 90° = vzhod
    expect(cardinalLabel(135, "en")).toBe("SE");
    expect(cardinalLabel(180, "sl")).toBe("J"); // 180° = jug
    expect(cardinalLabel(225, "en")).toBe("SW");
    expect(cardinalLabel(270, "sl")).toBe("Z"); // 270° = zahod
    expect(cardinalLabel(315, "en")).toBe("NW");
    expect(cardinalLabel(-90, "sl")).toBe("Z");
    expect(cardinalLabel(-90, "en")).toBe("W");
    expect(cardinalLabel(-22.6, "sl")).toBe("SZ");
    expect(cardinalLabel(-337, "en")).toBe("NE"); // −337° ≡ 23°
    expect(cardinalIndex(317.7)).toBe(7);
  });

  test("realni par: bearing Ljubljana→Bled ≈ 317,7° → SZ/NW; polna imena za sr-only", () => {
    const b = bearingDeg(LJ, BLED);
    expect(b).toBeCloseTo(317.7, 1);
    expect(cardinalLabel(b, "sl")).toBe("SZ");
    expect(cardinalLabel(b, "en")).toBe("NW");
    expect(cardinalName(b, "sl")).toBe("severozahod");
    expect(cardinalName(b, "en")).toBe("northwest");
    expect(cardinalName(0, "sl")).toBe("sever");
    expect(cardinalName(90, "en")).toBe("east");
    expect(cardinalName(180, "sl")).toBe("jug");
    expect(cardinalName(270, "en")).toBe("west");
  });
});

describe("go-gps: etaMinutes (cestni faktor ×1,3 pri ~55 km/h)", () => {
  test("kanon izvirnika: faktor 1,3, hitrost 55 km/h; formula round(km×1,3×60/55)", () => {
    expect(ETA_ROAD_FACTOR).toBe(1.3);
    expect(ETA_SPEED_KMH).toBe(55);
    expect(etaMinutes(50)).toBe(71); // 50×1,3 = 65 km → 65/55×60 = 70,9 → 71
    expect(etaMinutes(10)).toBe(Math.round(((10 * 1.3) / 55) * 60));
    expect(etaMinutes(100)).toBe(Math.round(((100 * 1.3) / 55) * 60));
    // LJ→Bled: 46,91 km premočno → ~61 km cestne ocene → 67 min
    expect(etaMinutes(haversineKm(LJ, BLED))).toBe(67);
  });

  test("neveljavni vhodi → 0 (nikoli izmišljenega časa)", () => {
    expect(etaMinutes(0)).toBe(0);
    expect(etaMinutes(-42)).toBe(0);
    expect(etaMinutes(Number.NaN)).toBe(0);
    expect(etaMinutes(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("go-gps: offRouteCheck (point-to-segment, prag 3 km)", () => {
  test("kanon: OFF_ROUTE_KM = 3; na poti (~2,3 km odklona) → NE izven, baza route", () => {
    expect(OFF_ROUTE_KM).toBe(3);
    const r = offRouteCheck(USER_ON, B, [A, B]);
    expect(r.basis).toBe("route");
    expect(r.deviationKm).toBeCloseTo(2.31, 1);
    expect(r.offRoute).toBe(false);
  });

  test("izven (> 3 km): odklon ~4,6 km → offRoute true, odklon razkrit", () => {
    const r = offRouteCheck(USER_OFF, B, [A, B]);
    expect(r.basis).toBe("route");
    expect(r.deviationKm).toBeCloseTo(4.63, 1);
    expect(r.deviationKm).toBeGreaterThan(OFF_ROUTE_KM);
    expect(r.offRoute).toBe(true);
  });

  test("polilinija več odsekov: točka na vozlišču → odklon ≈ 0", () => {
    const vertex = { lat: 46.1, lng: 14.1 };
    const r = offRouteCheck(vertex, B, [A, vertex, B]);
    expect(r.basis).toBe("route");
    expect(r.deviationKm).toBeLessThan(0.05);
    expect(r.offRoute).toBe(false);
  });

  test("brez routeCoords: iskrena degradacija — odklon NI izmišljen (0, baza straight)", () => {
    const r = offRouteCheck(USER_OFF, B);
    expect(r).toEqual({ offRoute: false, deviationKm: 0, basis: "straight" });
    // Tudi prazna/eno-točkovna geometrija je enaka degeneriranemu primeru.
    expect(offRouteCheck(USER_OFF, B, [])).toEqual(r);
    expect(offRouteCheck(USER_OFF, B, [A])).toEqual(r);
  });
});

describe("go-gps: progressAlongRoute (0–100, clamped)", () => {
  test("start 0 % · sredina 50 % · cilj 100 %", () => {
    expect(progressAlongRoute(A, A, B)).toBe(0);
    expect(progressAlongRoute({ lat: 46.1, lng: 14.0 }, A, B)).toBe(50);
    expect(progressAlongRoute(B, A, B)).toBe(100);
  });

  test("clamped: za startom 0 %, za ciljem 100 %; degeneriran odsek → 100 %", () => {
    expect(progressAlongRoute({ lat: 45.9, lng: 14.0 }, A, B)).toBe(0);
    expect(progressAlongRoute({ lat: 46.3, lng: 14.0 }, A, B)).toBe(100);
    expect(
      progressAlongRoute({ lat: 46.1, lng: 14.0 }, { lat: 46.1, lng: 14.0 }, {
        lat: 46.1,
        lng: 14.0,
      })
    ).toBe(100);
  });
});

describe("go-gps: pointToSegmentKm (pravokotna razdalja)", () => {
  test("~2,31 km za USER_ON; ~0 za točko na odseku", () => {
    expect(pointToSegmentKm(USER_ON, A, B)).toBeCloseTo(2.31, 1);
    expect(pointToSegmentKm({ lat: 46.1, lng: 14.0 }, A, B)).toBeLessThan(0.01);
    // Degeneriran odsek (A ≈ B): razdalja do točke A.
    expect(pointToSegmentKm(USER_ON, A, A)).toBeCloseTo(
      haversineKm(USER_ON, A),
      6
    );
  });
});

describe("go-gps: roundedPrivacy (zasebnostni kompromis ~11 m)", () => {
  test("zaokroži na 4 decimale; −0 normalizirano; vhodne točke NE spremeni", () => {
    const input = { lat: 46.123456, lng: 14.100001 };
    expect(roundedPrivacy(input)).toEqual({ lat: 46.1235, lng: 14.1 });
    expect(input).toEqual({ lat: 46.123456, lng: 14.100001 }); // nedestruktivno
    expect(roundedPrivacy({ lat: -0.00004, lng: -14.00004 })).toEqual({
      lat: 0, // −0,0000 → 0
      lng: -14,
    });
    expect(roundedPrivacy({ lat: 46.05698765, lng: 14.50581234 })).toEqual({
      lat: 46.057,
      lng: 14.5058,
    });
  });
});

describe("go-gps: osmDirectionsUrlWithOrigin (zunanji handoff)", () => {
  test("from/to sta URL kodirani v obliki OSM directions", () => {
    expect(osmDirectionsUrlWithOrigin(LJ, BLED)).toBe(
      "https://www.openstreetmap.org/directions?from=46.0569%2C14.5058&to=46.3683%2C14.0944"
    );
  });
});

describe("go-gps: parseRerouteBody (validacija from/to brez strežnika)", () => {
  const allowed = new Set(["bled", "ljubljana", "piran"]);

  test("veljavno telo (vključno z mejama lat ±90 / lng ±180); nabor sme biti tudi array", () => {
    expect(
      parseRerouteBody({ from: { lat: 46.0569, lng: 14.5058 }, to: "bled" }, allowed)
    ).toEqual({ from: { lat: 46.0569, lng: 14.5058 }, to: "bled" });
    // Meje so VKLJUČENE (enako kot izvirna geo-validacija).
    expect(
      parseRerouteBody({ from: { lat: 90, lng: -180 }, to: "piran" }, allowed)
    ).toEqual({ from: { lat: 90, lng: -180 }, to: "piran" });
    expect(
      parseRerouteBody({ from: { lat: -90, lng: 180 }, to: "ljubljana" }, allowed)
    ).toEqual({ from: { lat: -90, lng: 180 }, to: "ljubljana" });
    expect(
      parseRerouteBody({ from: { lat: 46, lng: 14 }, to: "bled" }, ["bled"])
    ).toEqual({ from: { lat: 46, lng: 14 }, to: "bled" });
  });

  test("neveljavno: obseg lat/lng, NaN, niz namesto števila, to izven nabora/prazen, manjkajoč from, ne-objekt", () => {
    expect(
      parseRerouteBody({ from: { lat: 90.1, lng: 14 }, to: "bled" }, allowed)
    ).toBeNull();
    expect(
      parseRerouteBody({ from: { lat: -90.1, lng: 14 }, to: "bled" }, allowed)
    ).toBeNull();
    expect(
      parseRerouteBody({ from: { lat: 46, lng: 180.1 }, to: "bled" }, allowed)
    ).toBeNull();
    expect(
      parseRerouteBody({ from: { lat: 46, lng: -180.1 }, to: "bled" }, allowed)
    ).toBeNull();
    expect(
      parseRerouteBody(
        { from: { lat: Number.NaN, lng: 14 }, to: "bled" },
        allowed
      )
    ).toBeNull();
    expect(
      parseRerouteBody({ from: { lat: "46", lng: 14 }, to: "bled" }, allowed)
    ).toBeNull();
    expect(
      parseRerouteBody({ from: { lat: 46, lng: 14 }, to: "saranda" }, allowed)
    ).toBeNull(); // izven dovoljenega nabora
    expect(
      parseRerouteBody({ from: { lat: 46, lng: 14 }, to: "" }, allowed)
    ).toBeNull();
    expect(parseRerouteBody({ to: "bled" }, allowed)).toBeNull(); // manjka from
    expect(parseRerouteBody({ from: { lat: 46, lng: 14 } }, allowed)).toBeNull(); // manjka to
    expect(parseRerouteBody(null, allowed)).toBeNull();
    expect(parseRerouteBody("bled", allowed)).toBeNull();
    expect(parseRerouteBody([], allowed)).toBeNull();
  });
});

describe("go-gps: isJourneyRouteResponse (straža — klient ne zaupa žici)", () => {
  const okLeg = {
    from: "gps",
    to: "bled",
    km: 61.0,
    min: 66,
    source: "osrm",
    geometry: [
      [46.0569, 14.5058],
      [46.2, 14.4],
      [46.3683, 14.0944],
    ],
  } as const;

  test("veljavna oblika faze 3 (slugs) in preračunska oblika z reroute poljem", () => {
    expect(
      isJourneyRouteResponse({
        legs: [okLeg],
        totalKm: 61.0,
        totalMin: 66,
        method: "osrm",
      })
    ).toBe(true);
    expect(
      isJourneyRouteResponse({
        legs: [{ ...okLeg, source: "heuristic", geometry: [[46, 14], [46.1, 14.1]] }],
        totalKm: 61.0,
        totalMin: 66,
        method: "heuristic",
        reroute: { from: { lat: 46.0569, lng: 14.5058 }, to: "bled" },
      })
    ).toBe(true);
    expect(
      isJourneyRouteResponse({
        legs: [okLeg, { ...okLeg, from: "bled", to: "ljubljana" }],
        totalKm: 122,
        totalMin: 132,
        method: "mixed",
      })
    ).toBe(true);
  });

  test("zavrne: prazne noge, NaN/negativne vrednosti, slab source, kratka geometrija, slab method, ne-objekt", () => {
    expect(isJourneyRouteResponse({ legs: [], totalKm: 1, totalMin: 1, method: "osrm" })).toBe(false);
    expect(
      isJourneyRouteResponse({
        legs: [{ ...okLeg, km: Number.NaN }],
        totalKm: 1,
        totalMin: 1,
        method: "osrm",
      })
    ).toBe(false);
    expect(
      isJourneyRouteResponse({
        legs: [{ ...okLeg, min: -1 }],
        totalKm: 1,
        totalMin: 1,
        method: "osrm",
      })
    ).toBe(false);
    expect(
      isJourneyRouteResponse({
        legs: [{ ...okLeg, source: "waze" }],
        totalKm: 1,
        totalMin: 1,
        method: "osrm",
      })
    ).toBe(false);
    expect(
      isJourneyRouteResponse({
        legs: [{ ...okLeg, geometry: [[46, 14]] }], // 1 točka ≠ pot
        totalKm: 1,
        totalMin: 1,
        method: "osrm",
      })
    ).toBe(false);
    expect(
      isJourneyRouteResponse({
        legs: [{ ...okLeg, geometry: [[46, 14], ["46", 14.1]] }],
        totalKm: 1,
        totalMin: 1,
        method: "osrm",
      })
    ).toBe(false);
    expect(
      isJourneyRouteResponse({ legs: [okLeg], totalKm: 1, totalMin: 1, method: "car" })
    ).toBe(false);
    expect(
      isJourneyRouteResponse({ legs: [okLeg], totalKm: "61", totalMin: 66, method: "osrm" })
    ).toBe(false);
    expect(isJourneyRouteResponse(null)).toBe(false);
    expect(isJourneyRouteResponse("ok")).toBe(false);
  });
});

// ── P0-G (issue #1 §16): geofence prihoda + geo: URI ─────────────────────

describe("go-gps: arrivalCheck — geofence prihoda (~250 m, namig ne dokaz)", () => {
  test("ARRIVAL_RADIUS_KM je kanonskih 0,25 km", () => {
    expect(ARRIVAL_RADIUS_KM).toBe(0.25);
  });

  test("točka na cilju → arrived (razdalja 0)", () => {
    const r = arrivalCheck(BLED, BLED);
    expect(r.arrived).toBe(true);
    expect(r.distanceKm).toBe(0);
  });

  test("~120 m stran (v smeri vzhoda) → arrived", () => {
    // 0,0011° lng na Bledu ≈ 0,084 km ≈ 84 m
    const blizu = { lat: BLED.lat, lng: BLED.lng + 0.0011 };
    const r = arrivalCheck(blizu, BLED);
    expect(r.arrived).toBe(true);
    expect(r.distanceKm).toBeGreaterThan(0);
    expect(r.distanceKm).toBeLessThanOrEqual(0.25);
  });

  test("~460 m stran → NI prihoda (zunaj radijusa)", () => {
    // 0,006° lng ≈ 0,46 km
    const dalec = { lat: BLED.lat, lng: BLED.lng + 0.006 };
    expect(arrivalCheck(dalec, BLED).arrived).toBe(false);
  });

  test("Ljubljana → Bled (46,9 km) očitno ni prihod", () => {
    const r = arrivalCheck(LJ, BLED);
    expect(r.arrived).toBe(false);
    expect(r.distanceKm).toBeGreaterThan(40);
  });

  test("zaokrožitev na 3 decimale (meter natančnost, stabilen zapis)", () => {
    const r = arrivalCheck({ lat: BLED.lat + 0.0012345, lng: BLED.lng }, BLED);
    expect(Number.isFinite(r.distanceKm)).toBe(true);
    // 3 decimalke pomenijo korak 1 m
    expect(Math.round(r.distanceKm * 1000) % 1).toBe(0);
  });
});

describe("go-gps: geoUri — sistemski izbirnik zemljevidov na mobilcu", () => {
  test("oblika geo:lat,lng s 6 decimalkami (~0,1 m)", () => {
    expect(geoUri(BLED)).toBe("geo:46.368300,14.094400");
  });

  test("negativne koordinate (južna/zahodna poloble) ostanejo predznačene", () => {
    expect(geoUri({ lat: -33.8688, lng: -151.2093 })).toBe(
      "geo:-33.868800,-151.209300",
    );
  });

  test("brez -0 zacinka (normalizirana ničla)", () => {
    const out = geoUri({ lat: -0.0000001, lng: 0 });
    expect(out).toBe("geo:0.000000,0.000000");
  });
});
