/**
 * OSM OVERPASS — testi živega POI sloja po viewportu (P0-C, issue §6).
 *
 * Pokriva:
 *  · bbox validacijo (oblika, vrstni red, zemljepisni okvirji, max
 *    površina 0,25°² — zaščita javnega vira),
 *  · deterministično izgradnjo Overpass QL (potovalno-relevantni POI),
 *  · rate limit (min 5 s med poizvedbami — injectable ura),
 *  · fail-closed: napaka omrežja na VSEH 3 zrcalih → iskrena napaka
 *    z atribucijo ODbL (nikoli izmišljeni POI, nikoli tiho prazno),
 *  · preslikavo elementov (ime obvezno, relevantne oznake omejene),
 *  · rotacijo zrcal (prvo odpove → drugo odgovori).
 *
 * Kanon: 0 omrežja (lažni fetch), injectable ura.
 */

import { describe, expect, test, beforeEach } from "bun:test";

import {
  OSM_ATTRIBUTION,
  OVERPASS_ENDPOINTS,
  OVERPASS_MAX_BBOX_AREA,
  OVERPASS_MIN_INTERVAL_MS,
  OVERPASS_POI_FILTERS,
  __resetOverpassRateLimit,
  buildOverpassQuery,
  mapOverpassElement,
  queryViewportPois,
  validateBbox,
  type FetchLike,
} from "../src/lib/supply/providers/osm/overpass";

// Lažni Response (bun:test brez omrežja).
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ── Bbox validacija ────────────────────────────────────────────────────────

describe("validateBbox — viewport validacija", () => {
  test("veljaven Bled viewport", () => {
    const v = validateBbox([46.35, 14.05, 46.42, 14.2]);
    expect(v.ok).toBe(true);
  });

  test("obratni vrstni red (n<s ali e<w) → zavrnjeno", () => {
    expect(validateBbox([46.42, 14.05, 46.35, 14.2]).ok).toBe(false);
    expect(validateBbox([46.35, 14.2, 46.42, 14.05]).ok).toBe(false);
  });

  test("izven zemljepisnih okvirov → zavrnjeno", () => {
    expect(validateBbox([-91, 14, -90, 15]).ok).toBe(false);
    expect(validateBbox([46, -181, 47, -180]).ok).toBe(false);
  });

  test("prevelika površina → zavrnjeno (zaščita javnega vira)", () => {
    // 2° × 2° = 4°² > 0,25°²
    const v = validateBbox([45, 14, 47, 16]);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("prevelik");
  });

  test("mejna površina 0,25°² je ŠE dopustna (0,5° × 0,5°)", () => {
    const v = validateBbox([46.0, 14.0, 46.5, 14.5]);
    expect(v.ok).toBe(true);
    expect(OVERPASS_MAX_BBOX_AREA).toBe(0.25);
  });

  test("ne-številske vrednosti → zavrnjeno", () => {
    expect(validateBbox([Number.NaN, 14, 46, 15]).ok).toBe(false);
    expect(validateBbox([46, 14, 46]).ok).toBe(false); // le 3 vrednosti
  });
});

// ── Overpass QL ────────────────────────────────────────────────────────────

describe("buildOverpassQuery — deterministična QL izgradnja", () => {
  test("vsebuje vse potovalne filtre + bbox + limit", () => {
    const q = buildOverpassQuery([46.35, 14.05, 46.42, 14.2]);
    for (const filter of OVERPASS_POI_FILTERS) {
      expect(q).toContain(`[${filter}]`);
    }
    expect(q).toContain("[out:json]");
    expect(q).toContain("(46.35000,14.05000,46.42000,14.20000)");
    expect(q).toContain("out center");
  });

  test("isti bbox → ista poizvedba (determinizem)", () => {
    expect(buildOverpassQuery([46.35, 14.05, 46.42, 14.2])).toBe(
      buildOverpassQuery([46.35, 14.05, 46.42, 14.2])
    );
  });

  test("turizem + hrana + narava + gorivo so pokriti", () => {
    const joined = OVERPASS_POI_FILTERS.join(" ");
    expect(joined).toContain("tourism");
    expect(joined).toContain("amenity=restaurant");
    expect(joined).toContain("natural=beach");
    expect(joined).toContain("amenity=fuel");
  });
});

// ── Preslikava elementov ──────────────────────────────────────────────────

describe("mapOverpassElement — fail-closed preslikava", () => {
  test("node z imenom in koordinatami → POI", () => {
    const poi = mapOverpassElement({
      type: "node",
      id: 1,
      lat: 46.36,
      lon: 14.11,
      tags: { name: "Blejski otok", tourism: "attraction" },
    });
    expect(poi).not.toBeNull();
    expect(poi!.name).toBe("Blejski otok");
    expect(poi!.kind).toBe("tourism");
    expect(poi!.tags.tourism).toBe("attraction");
  });

  test("way s centerjem → POI (center.lat/lon)", () => {
    const poi = mapOverpassElement({
      type: "way",
      id: 2,
      center: { lat: 46.36, lon: 14.11 },
      tags: { name: "Plaža Grajsko jezero", natural: "beach" },
    });
    expect(poi).not.toBeNull();
    expect(poi!.latitude).toBe(46.36);
    expect(poi!.kind).toBe("natural=beach"); // vrsta se veže na filter
  });

  test("BREZ imena → null (POI brez imena ni uporaben za sloj)", () => {
    expect(
      mapOverpassElement({ type: "node", id: 3, lat: 46, lon: 14, tags: { tourism: "hotel" } })
    ).toBeNull();
  });

  test("brez koordinat → null", () => {
    expect(
      mapOverpassElement({ type: "node", id: 4, tags: { name: "X" } })
    ).toBeNull();
  });

  test("oznake so OMEJENE na potovalno-relevantne (contact:* odpade)", () => {
    const poi = mapOverpassElement({
      type: "node",
      id: 5,
      lat: 46,
      lon: 14,
      tags: {
        name: "Kavarna",
        amenity: "cafe",
        cuisine: "coffee",
        "contact:phone": "+386 1 000 00 00",
        phone: "tajna",
      },
    });
    expect(poi!.tags).toEqual({ amenity: "cafe", cuisine: "coffee" });
  });
});

// ── Poizvedba (lažni fetch) ────────────────────────────────────────────────

describe("queryViewportPois — lažni fetch, rate limit, fail-closed", () => {
  beforeEach(() => {
    __resetOverpassRateLimit();
  });

  const BLED: readonly number[] = [46.35, 14.05, 46.42, 14.2];

  test("uspešen odziv: POI + atribucija ODbL + endpoint", async () => {
    const fetchLike: FetchLike = () =>
      Promise.resolve(
        jsonResponse({
          elements: [
            { type: "node", id: 1, lat: 46.36, lon: 14.11, tags: { name: "Blejski otok", tourism: "attraction" } },
            { type: "node", id: 2, lat: 46.36, lon: 14.1, tags: { tourism: "viewpoint" } }, // brez imena
          ],
        })
      );
    const r = await queryViewportPois(BLED, { fetchLike, ignoreRateLimit: true });
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.pois.length).toBe(1);
      expect(r.pois[0].name).toBe("Blejski otok");
      expect(r.attribution).toBe(OSM_ATTRIBUTION);
      expect(r.endpoint).toContain("overpass-api.de");
    }
  });

  test("rotacija zrcal: prvo zrcalo 500 → drugo odgovori", async () => {
    let klic = 0;
    const fetchLike: FetchLike = () => {
      klic += 1;
      return klic === 1
        ? Promise.resolve(jsonResponse({}, 500))
        : Promise.resolve(jsonResponse({ elements: [] }));
    };
    const r = await queryViewportPois(BLED, { fetchLike, ignoreRateLimit: true });
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.endpoint).toContain("kumi.systems");
    }
  });

  test("fail-closed: VSA zrcala odpovejo → iskrena napaka z atribucijo", async () => {
    const fetchLike: FetchLike = () =>
      Promise.resolve(jsonResponse({}, 503));
    const r = await queryViewportPois(BLED, { fetchLike, ignoreRateLimit: true });
    expect(r.status).toBe("error");
    if (r.status === "error") {
      expect(r.reason).toContain("Overpass nedosegljiv");
      expect(r.reason).toContain(String(OVERPASS_ENDPOINTS.length));
      expect(r.attribution).toBe(OSM_ATTRIBUTION); // ODbL tudi ob napaki
    }
  });

  test("omrežna izjema se šteje po zrcalih (brez metanja)", async () => {
    const fetchLike: FetchLike = () => Promise.reject(new Error("ECONNREFUSED"));
    const r = await queryViewportPois(BLED, { fetchLike, ignoreRateLimit: true });
    expect(r.status).toBe("error");
    if (r.status === "error") {
      expect(r.reason).toContain("ECONNREFUSED");
    }
  });

  test("neveljaven bbox → napaka PRED omrežjem (0 klicev)", async () => {
    let klici = 0;
    const fetchLike: FetchLike = () => {
      klici += 1;
      return Promise.resolve(jsonResponse({}));
    };
    const r = await queryViewportPois([45, 14, 47, 16], { fetchLike }); // prevelik
    expect(r.status).toBe("error");
    expect(klici).toBe(0);
  });

  test("rate limit: druga poizvedba prehitro → iskrena zavrnitev", async () => {
    let cas = 1_000_000;
    const clock = () => cas;
    const fetchLike: FetchLike = () => Promise.resolve(jsonResponse({ elements: [] }));

    const prva = await queryViewportPois(BLED, { fetchLike, clock });
    expect(prva.status).toBe("ok");

    cas += 1_000; // samo 1 s od prve poizvedbe
    const druga = await queryViewportPois(BLED, { fetchLike, clock });
    expect(druga.status).toBe("error");
    if (druga.status === "error") {
      expect(druga.reason).toContain("prehitro");
      expect(OVERPASS_MIN_INTERVAL_MS).toBe(5000);
    }
  });

  test("rate limit: po 5 s je poizvedba spet dovoljena", async () => {
    let cas = 1_000_000;
    const clock = () => cas;
    const fetchLike: FetchLike = () => Promise.resolve(jsonResponse({ elements: [] }));

    await queryViewportPois(BLED, { fetchLike, clock });
    cas += OVERPASS_MIN_INTERVAL_MS + 1;
    const druga = await queryViewportPois(BLED, { fetchLike, clock });
    expect(druga.status).toBe("ok");
  });
});
