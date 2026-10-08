/**
 * GEO-BBOX — skupna geo validacija za P0-H (partner listingi, konzultacije).
 *
 * Isti okvirji držav kot FSQ loader (src/lib/supply/providers/fsq/dataset.ts)
 * — kanon: koordinata MORA pasti v prijavljeno državo, sicer odklon
 * (čezmejne laži se zavrejo). Iskrenost: brez koordinate je vrstica
 * veljavna (null) — nikoli ne izmišljamo lokacije.
 */

/** Geo okvirji držav (bbox: [south, west, north, east]). */
export const GEO_COUNTRY_BBOXES: Readonly<
  Record<string, readonly [number, number, number, number]>
> = Object.freeze({
  SI: [45.4, 13.3, 46.9, 16.6],
  HR: [42.3, 13.4, 46.6, 19.5],
  ME: [41.8, 18.3, 43.6, 20.4],
  AL: [39.6, 19.2, 42.7, 21.1],
});

/** Vse podprte države (prikazni vrstni red). */
export const GEO_COUNTRIES: readonly string[] = Object.keys(GEO_COUNTRY_BBOXES);

export interface GeoPin {
  lat: number;
  lng: number;
}

export type GeoPinResult =
  | { ok: true; value: GeoPin | null; country: string | null }
  | { ok: false; error: string };

/**
 * Ali točka leži znotraj bbox-a države (inkluzivno na robovih).
 *
 * POZOR: okvirji sosednjih držav se PREKRIVAJO (SI vzhodni rob 16.6°
 * sega čez Zagreb; HR obseg pokriva tudi Boko Kotorsko) — funkcija vrne
 * PRVI zadetek po vrstnem redu SI·HR·ME·AL. Za validacijo vnosa
 * (validateGeoPin) je pomembno samo, da točka pade v KATERIKOLI podprt
 * okvir; dodelitev države je informativna, na mejah dvoumna.
 */
export function pointInCountryBbox(lat: number, lng: number): string | null {
  for (const [code, box] of Object.entries(GEO_COUNTRY_BBOXES)) {
    const [south, west, north, east] = box;
    if (lat >= south && lat <= north && lng >= west && lng <= east) {
      return code;
    }
  }
  return null;
}

/**
 * Validacija geo pin-a partnerjevega vnosa:
 *  - oba null/undefined → veljavno (lokacija ni obvezna — iskrena odsotnost);
 *  - oba prisotna, končni števili, znotraj SI·HR·ME·AL → veljavno;
 *  - samo ena, ne-številsko ali izven okvirjev → odklon z razlogom.
 */
export function validateGeoPin(lat: unknown, lng: unknown): GeoPinResult {
  const hasLat = lat !== null && lat !== undefined && lat !== "";
  const hasLng = lng !== null && lng !== undefined && lng !== "";

  if (!hasLat && !hasLng) {
    return { ok: true, value: null, country: null };
  }
  if (!hasLat || !hasLng) {
    return {
      ok: false,
      error: "Lokacija potrebuje obe koordinati (širina in dolžina).",
    };
  }

  const latNum = typeof lat === "number" ? lat : Number(lat);
  const lngNum = typeof lng === "number" ? lng : Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { ok: false, error: "Koordinati morata biti veljavni števili." };
  }

  const country = pointInCountryBbox(latNum, lngNum);
  if (!country) {
    return {
      ok: false,
      error:
        "Koordinate so izven podprtih držav (Slovenija, Hrvaška, Črna gora, Albanija).",
    };
  }
  return {
    ok: true,
    value: { lat: latNum, lng: lngNum },
    country,
  };
}
