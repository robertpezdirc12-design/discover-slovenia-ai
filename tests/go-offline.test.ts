/**
 * GO-OFFLINE (QA U12, 2026-10-11) — čista logika stanja povezave za Go
 * Mode „Na poti“ (src/lib/go-offline.ts) + VRSTA napake vremenske
 * poizvedbe (src/lib/weather.ts: fetchStopWeather, isOfflineApiBody)
 * BREZ omrežja in brez DOM-a (kanon testne hiše — glej go-gps.test.ts).
 *
 * Zaklenjene invariante (ugotovitev U12, produkcija 2.27.0):
 *  - kazatelj povezave ima VSEH 6 jezikov (sl/en/it/de/fr/es), slovenske
 *    besedile natančno „Povezano“/„Brez povezave“ (dogovor QA);
 *  - opomba offline vreme natančno „Ni povezave — vreme ni na voljo.“;
 *  - weatherNotice POŠTENO loči vzroke: odklop/omrežje → "offline",
 *    napaka servisa ob delujoči povezavi → "unavailable", prikazano
 *    vreme ali nalaganje → null (nič tihega);
 *  - showsCachedWeather: oznaka „shranjeno“ SAMO ob odklopu ob prikazanem
 *    vremenu (podatek iz časov, ko je povezava še delovala);
 *  - fetchStopWeather razloži vzrok: zavrnitev fetch ali zasilni
 *    503 { offline: true } SW-ja = "network"; 4xx/5xx/napačna oblika
 *    (strežnik je odgovoril) = "service"; uspeh → { ok: true, data }.
 */

import { afterEach, describe, expect, test } from "bun:test";

import {
  CONNECTION_LABELS,
  showsCachedWeather,
  WEATHER_CACHED_LABEL,
  WEATHER_OFFLINE_NOTE,
  weatherNotice,
  type OnlineStatus,
} from "../src/lib/go-offline";
import {
  fetchStopWeather,
  isOfflineApiBody,
  type WeatherResponse,
} from "../src/lib/weather";

/** Kanonični odgovor /api/weather ob uspehu (veljavna oblika). */
const OK_WEATHER: WeatherResponse = {
  ok: true,
  source: "open-meteo",
  fetchedAt: "2026-10-11T14:32:00.000Z",
  current: {
    time: "2026-10-11T14:32",
    temperatureC: 11.2,
    apparentC: 10.1,
    weatherCode: 45,
    windKmh: 3.4,
    precipitationMm: 0,
  },
};

const LOCALES = ["sl", "en", "it", "de", "fr", "es"] as const;

// ── OZNAKE ×6 JEZIKOV ───────────────────────────────────────────────────────

describe("go-offline: CONNECTION_LABELS (živi kazatelj povezave ×6)", () => {
  test("oba stanja imata vseh 6 jezikov (sl, en, it, de, fr, es), neprazna", () => {
    const statuses: OnlineStatus[] = ["online", "offline"];
    for (const s of statuses) {
      const dict = CONNECTION_LABELS[s];
      expect(Object.keys(dict).sort()).toEqual([...LOCALES].sort());
      for (const loc of LOCALES) {
        expect(typeof dict[loc]).toBe("string");
        expect(dict[loc].length).toBeGreaterThan(0);
      }
    }
  });

  test("slovensko besedilo natančno po dogovoru QA: „Povezano“ / „Brez povezave“", () => {
    expect(CONNECTION_LABELS.online.sl).toBe("Povezano");
    expect(CONNECTION_LABELS.offline.sl).toBe("Brez povezave");
  });

  test("prevodi so med seboj razločni (niz ni enak slovarju drugega stanja)", () => {
    for (const loc of LOCALES) {
      expect(CONNECTION_LABELS.online[loc]).not.toBe(CONNECTION_LABELS.offline[loc]);
    }
  });
});

describe("go-offline: WEATHER_OFFLINE_NOTE (iskrena opomba odklopa ×6)", () => {
  test("vseh 6 jezikov, neprazni, vsak vsebuje veznik (opomba vzroka)", () => {
    expect(Object.keys(WEATHER_OFFLINE_NOTE).sort()).toEqual([...LOCALES].sort());
    for (const loc of LOCALES) {
      const text = WEATHER_OFFLINE_NOTE[loc];
      expect(text.length).toBeGreaterThan(0);
      // „—“ nosi vzrok (ni povezave → vreme ni na voljo) v vseh jezikih
      expect(text.includes("—")).toBe(true);
    }
  });

  test("slovensko besedilo natančno: „Ni povezave — vreme ni na voljo.“", () => {
    expect(WEATHER_OFFLINE_NOTE.sl).toBe("Ni povezave — vreme ni na voljo.");
  });
});

describe("go-offline: WEATHER_CACHED_LABEL (oznaka shranjenega vremena ×6)", () => {
  test("vseh 6 jezikov so FUNKCIJE, ki vrnejo neprazen niz z uro", () => {
    expect(Object.keys(WEATHER_CACHED_LABEL).sort()).toEqual([...LOCALES].sort());
    for (const loc of LOCALES) {
      const out = WEATHER_CACHED_LABEL[loc]("14:32");
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
      expect(out.includes("14:32")).toBe(true);
    }
  });

  test("slovenščina: shranjeno ob 14:32 (čas pridobitve je del oznake)", () => {
    expect(WEATHER_CACHED_LABEL.sl("14:32")).toBe("shranjeno ob 14:32");
  });
});

// ── ČISTA ODLOČITEV: KATERA OPOMBA VELJA ────────────────────────────────────

describe("go-offline: weatherNotice (iskreno ločevanje vzrokov)", () => {
  test("prikazano vreme vedno izpodrine opombo (tudi ob napaki prej)", () => {
    expect(weatherNotice({ online: false, failureKind: "network", hasWeather: true })).toBeNull();
    expect(weatherNotice({ online: true, failureKind: "service", hasWeather: true })).toBeNull();
  });

  test("nalaganje / še brez odgovora → null (skeleton, nič tihega)", () => {
    expect(weatherNotice({ online: true, failureKind: null, hasWeather: false })).toBeNull();
    expect(weatherNotice({ online: false, failureKind: null, hasWeather: false })).toBeNull();
  });

  test("odklop naprave → \"offline\" (ne glede na vrsto napake)", () => {
    expect(weatherNotice({ online: false, failureKind: "network", hasWeather: false })).toBe("offline");
    expect(weatherNotice({ online: false, failureKind: "service", hasWeather: false })).toBe("offline");
  });

  test("omrežna napaka ob \"prijavljeni\" povezavi → \"offline\" (navigator laže; SW 503 { offline: true } / zavrnitev fetch)", () => {
    expect(weatherNotice({ online: true, failureKind: "network", hasWeather: false })).toBe("offline");
  });

  test("napaka servisa ob delujoči povezavi → \"unavailable\" (ne krivimo povezave)", () => {
    expect(weatherNotice({ online: true, failureKind: "service", hasWeather: false })).toBe("unavailable");
  });
});

describe("go-offline: showsCachedWeather (oznaka „shranjeno“ samo ob odklopu)", () => {
  test("resnična tabela: true SAMO za odklop + prikazano vreme", () => {
    expect(showsCachedWeather({ online: false, hasWeather: true })).toBe(true);
    // odklop, a vremena ni (offline opomba namesto podatka):
    expect(showsCachedWeather({ online: false, hasWeather: false })).toBe(false);
    // povezava: podatek je lahko svež (SW gre po mreži) — brez oznake:
    expect(showsCachedWeather({ online: true, hasWeather: true })).toBe(false);
    expect(showsCachedWeather({ online: true, hasWeather: false })).toBe(false);
  });
});

// ── WEATHER.TS: VRSTA NAPAKE POIZVEDBE (QA U12) ─────────────────────────────

describe("weather: isOfflineApiBody (zasilni 503 telesu SW-ja)", () => {
  test("prepozna { ok:false, offline:true } — zavrne ostale oblike", () => {
    expect(isOfflineApiBody({ ok: false, offline: true })).toBe(true);
    expect(isOfflineApiBody({ ok: false, offline: true, error: "Brez povezave — ta zahtevek je mogoč le prek mreže.", path: "/api/weather" })).toBe(true);
    // ok:true NI offline telesa (uspeh se ne sme razglasiti za odklop):
    expect(isOfflineApiBody({ ok: true, offline: true })).toBe(false);
    expect(isOfflineApiBody({ ok: false })).toBe(false);
    expect(isOfflineApiBody(null)).toBe(false);
    expect(isOfflineApiBody("offline")).toBe(false);
    expect(isOfflineApiBody(503)).toBe(false);
  });
});

describe("weather: fetchStopWeather (vrsta napake omrežje ≠ servis; maketa fetch)", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** Namesti maketo fetch (celotna zamenjava — relativni URL ne sme priti do pravega omrežja). */
  function mockFetch(handler: (url: string) => Response | Promise<Response> | never) {
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      return Promise.resolve(handler(url));
    }) as typeof fetch;
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  test("uspeh: 200 + veljavna oblika → { ok: true, data } (URL ?lat&lng)", async () => {
    let seenUrl = "";
    mockFetch((url) => {
      seenUrl = url;
      return json(200, OK_WEATHER);
    });
    const r = await fetchStopWeather(46.1, 14.1);
    expect(r).toEqual({ ok: true, data: OK_WEATHER });
    expect(seenUrl).toBe("/api/weather?lat=46.1&lng=14.1");
  });

  test("zasilni SW 503 { offline: true } → { ok: false, kind: \"network\" }", async () => {
    mockFetch(() =>
      json(503, {
        ok: false,
        offline: true,
        error: "Brez povezave — ta zahtevek je mogoč le prek mreže.",
        path: "/api/weather",
      })
    );
    expect(await fetchStopWeather(46.1, 14.1)).toEqual({ ok: false, kind: "network" });
  });

  test("503 brez telesa SW-ja (tuja napaka) → \"service\"", async () => {
    mockFetch(() => new Response("upstream unavailable", { status: 503 }));
    expect(await fetchStopWeather(46.1, 14.1)).toEqual({ ok: false, kind: "service" });
  });

  test("502 (gorovje Open-Meteo ne dosegljiv) → \"service\"", async () => {
    mockFetch(() => json(502, { error: "Vremenski servis trenutno ni dosegljiv." }));
    expect(await fetchStopWeather(46.1, 14.1)).toEqual({ ok: false, kind: "service" });
  });

  test("429 (omejitev zahtev) → \"service\"", async () => {
    mockFetch(() => json(429, { error: "Presežena omejitev zahtev (60/min)." }));
    expect(await fetchStopWeather(46.1, 14.1)).toEqual({ ok: false, kind: "service" });
  });

  test("400 (neveljavni parametra) → \"service\"", async () => {
    mockFetch(() =>
      json(400, { error: "Neveljavni ali manjkajoči parametra 'lat' in 'lng' …" })
    );
    expect(await fetchStopWeather(46.1, 14.1)).toEqual({ ok: false, kind: "service" });
  });

  test("200 z NEVELJAVNO obliko → \"service\" (nikoli izmišljenih podatkov)", async () => {
    mockFetch(() => json(200, { ok: true, source: "open-meteo", current: { temperatureC: 3 } }));
    expect(await fetchStopWeather(46.1, 14.1)).toEqual({ ok: false, kind: "service" });
  });

  test("zavrnitev fetch (brez povezave — TypeError) → \"network\"", async () => {
    globalThis.fetch = ((_url: RequestInfo | URL): Promise<Response> => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    expect(await fetchStopWeather(46.1, 14.1)).toEqual({ ok: false, kind: "network" });
  });
});
