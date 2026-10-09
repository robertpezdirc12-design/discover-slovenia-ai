/**
 * I18N-CORE-ACTIVATION (4-c, PRODUCT-AUDIT §9) — jedrska 6-jezična vrata.
 *
 * Do 2.20.0 so bila jedra (itinerary-engine, weather, statusLabel,
 * trip-dates, go-gps) binarna sl/en: it/de/fr/es uporabniki so dobili
 * SLOVENSKI načrt, datume in smeri. Ta pogodba zaklene:
 *  ① PlannerLang = 6 jezikov (načrt v jeziku uporabnika)
 *  ② weatherLabel 6 jezikov (WMO slovar + fallback)
 *  ③ statusLabel 6 jezikov (STATUS_LABELS register)
 *  ④ trip-dates 6 jezikov (tedni/meseci — sl/en izhodi identični kanonu)
 *  ⑤ go-gps kardinalne smeri 6 jezikov
 *  ⑥ INTL_DATE_LOCALE enota (vsa datum vrata zbirajo po istem slovarju)
 *  ⑦ FR register = tu (harmonizacija vous → tu, 2.21.0)
 *  ⑧ asPickLocale vrata (neznano → sl, iskren fallback)
 */

import { describe, expect, test } from "bun:test";
import {
  buildItinerary,
  buildPlanFromMyTrip,
  formatMoney,
  validatePlanGeo,
  type PlannerQuery,
} from "../src/lib/itinerary-engine";
import { weatherLabel } from "../src/lib/weather";
import { statusLabel } from "../src/lib/journey/booking";
import {
  formatDateLong,
  formatDateShort,
  weekdayLong,
  weekdayShort,
} from "../src/lib/trip-dates";
import { cardinalLabel, cardinalName } from "../src/lib/go-gps";
import { asPickLocale } from "../src/lib/i18n-pick";
import { INTL_DATE_LOCALE, intlDateLocale } from "../src/lib/intl-locale";

const baseQuery: PlannerQuery = {
  interests: ["gradovi"],
  days: 2,
  region: "gorenjska",
};

// ── ① Jedro načrta govori jezik uporabnika ─────────────────────────────────

describe("i18n-core (4-c): PlannerLang 6 jezikov", () => {
  test("naslov načrta po jeziku (it/de/fr/es niso več slovenščina)", () => {
    expect(buildItinerary(baseQuery).title).toMatch(/^Načrt: /);
    expect(buildItinerary({ ...baseQuery, locale: "en" }).title).toMatch(/^Plan: /);
    expect(buildItinerary({ ...baseQuery, locale: "it" }).title).toMatch(/^Piano: /);
    expect(buildItinerary({ ...baseQuery, locale: "de" }).title).toMatch(/^Plan: /);
    expect(buildItinerary({ ...baseQuery, locale: "fr" }).title).toMatch(/^Itinéraire : /);
    expect(buildItinerary({ ...baseQuery, locale: "es" }).title).toMatch(/^Plan: /);
  });

  test("naslovi dni po jeziku (Dan/Day/Giorno/Tag/Jour/Día)", () => {
    const first = (locale: "sl" | "it" | "de" | "fr" | "es"): string => {
      const plan = buildItinerary({ ...baseQuery, locale });
      const t = (plan.dayTitles ?? [])[0];
      return t === undefined ? "" : t;
    };
    expect(first("sl")).toMatch(/^Dan 1 · /);
    expect(first("it")).toMatch(/^Giorno 1 · /);
    expect(first("de")).toMatch(/^Tag 1 · /);
    expect(first("fr")).toMatch(/^Jour 1 · /);
    expect(first("es")).toMatch(/^Día 1 · /);
  });

  test("povzetek po jeziku (določilniki prevoda, ne slovenščina)", () => {
    expect(buildItinerary({ ...baseQuery, locale: "it" }).summary).toContain("Piano deterministico");
    expect(buildItinerary({ ...baseQuery, locale: "de" }).summary).toContain("Deterministischer Plan");
    expect(buildItinerary({ ...baseQuery, locale: "fr" }).summary).toContain("Itinéraire déterministe");
    expect(buildItinerary({ ...baseQuery, locale: "es" }).summary).toContain("Plan determinista");
  });

  test("jezik NE spremeni strukture postankov (determinizem čez locale)", () => {
    const sl = buildItinerary(baseQuery);
    for (const locale of ["en", "it", "de", "fr", "es"] as const) {
      const p = buildItinerary({ ...baseQuery, locale });
      expect(JSON.stringify(p.days.map((d) => d.map((s) => s.slug)))).toBe(
        JSON.stringify(sl.days.map((d) => d.map((s) => s.slug)))
      );
      expect(p.totalCost).toBe(sl.totalCost);
    }
  });

  test("osnutek iz zbirke po jeziku (draftTitle/draftDayTitle)", () => {
    const items = [
      { refId: "bled", name: "Bled", kind: "destination" as const, addedAt: "2026-10-01" },
    ];
    expect(buildPlanFromMyTrip(items).plan.title).toBe("Osnutek: Moja pot");
    expect(buildPlanFromMyTrip(items, "it").plan.title).toBe("Bozza: Il mio viaggio");
    expect(buildPlanFromMyTrip(items, "fr").plan.title).toBe("Brouillon : Mon voyage");
    expect(buildPlanFromMyTrip(items, "es").plan.title).toBe("Borrador: Mi viaje");
  });

  test("formatMoney: € pred številom SAMO v EN (ostali za njo)", () => {
    expect(formatMoney(49, "en")).toBe("€49");
    expect(formatMoney(49, "sl")).toBe("49 €");
    expect(formatMoney(49, "it")).toBe("49 €");
    expect(formatMoney(49, "de")).toBe("49 €");
    expect(formatMoney(49, "fr")).toBe("49 €");
    expect(formatMoney(49, "es")).toBe("49 €");
  });

  test("geo validacija sporočila po jeziku (GEO_MSG slovar)", () => {
    const plan = buildItinerary({ ...baseQuery, days: 1 });
    const slGeo = validatePlanGeo(plan);
    const itGeo = validatePlanGeo(plan, "it");
    if (slGeo.issues.length > 0) {
      // isti sprožilci, različni jeziki (preverba na prvi izdaji issue)
      expect(itGeo.issues.length).toBe(slGeo.issues.length);
      expect(itGeo.issues[0].message).not.toBe(slGeo.issues[0].message);
    }
  });
});

// ── ② Vreme ────────────────────────────────────────────────────────────────

describe("i18n-core (4-c): weatherLabel 6 jezikov", () => {
  test("WMO oznake po jeziku (sneg kot težaven prevod)", () => {
    expect(weatherLabel(71, "sl")).toBe("sneg");
    expect(weatherLabel(71, "en")).toBe("snow");
    expect(weatherLabel(71, "it")).toBe("neve");
    expect(weatherLabel(71, "de")).toBe("schnee");
    expect(weatherLabel(71, "fr")).toBe("neige");
    expect(weatherLabel(71, "es")).toBe("nieve");
  });

  test("neznana koda → iskren fallback po jeziku (nikoli angleščina za ne-EN)", () => {
    expect(weatherLabel(42, "sl")).toBe("vreme");
    expect(weatherLabel(42, "en")).toBe("weather");
    expect(weatherLabel(42, "it")).toBe("meteo");
    expect(weatherLabel(42, "de")).toBe("Wetter");
    expect(weatherLabel(42, "fr")).toBe("météo");
    expect(weatherLabel(42, "es")).toBe("tiempo");
  });
});

// ── ③ Statusi rezervacij ───────────────────────────────────────────────────

describe("i18n-core (4-c): statusLabel 6 jezikov", () => {
  test("CONFIRMED po vseh jezikih (register STATUS_LABELS)", () => {
    expect(statusLabel("CONFIRMED", "sl")).toBe("Potrjeno");
    expect(statusLabel("CONFIRMED", "en")).toBe("Confirmed");
    expect(statusLabel("CONFIRMED", "it")).toBe("Confermato");
    expect(statusLabel("CONFIRMED", "de")).toBe("Bestätigt");
    expect(statusLabel("CONFIRMED", "fr")).toBe("Confirmé");
    expect(statusLabel("CONFIRMED", "es")).toBe("Confirmado");
  });

  test("neznan status ostane surov (iskrenost čez vse jezike)", () => {
    expect(statusLabel("MISTERIJ", "it")).toBe("MISTERIJ");
  });
});

// ── ④ Datumi (ročni kanon — sl/en izhodi identični predhodniku) ────────────

describe("i18n-core (4-c): trip-dates 6 jezikov", () => {
  test("tedni po jeziku (2026-10-09 = petek)", () => {
    expect(weekdayShort("2026-10-09", "sl")).toBe("pet");
    expect(weekdayLong("2026-10-09", "sl")).toBe("petek");
    expect(weekdayLong("2026-10-09", "en")).toBe("Friday");
    expect(weekdayLong("2026-10-09", "it")).toBe("venerdì");
    expect(weekdayLong("2026-10-09", "de")).toBe("Freitag");
    expect(weekdayLong("2026-10-09", "fr")).toBe("vendredi");
    expect(weekdayLong("2026-10-09", "es")).toBe("viernes");
  });

  test("formati datumov po jeziku (sl genitiv, en mesec-prvi, es dvojni 'de')", () => {
    expect(formatDateShort("2026-10-17", "sl")).toBe("17. okt 2026");
    expect(formatDateShort("2026-10-17", "en")).toBe("Oct 17, 2026");
    expect(formatDateLong("2026-10-17", "sl")).toBe("17. oktobra 2026");
    expect(formatDateLong("2026-10-17", "en")).toBe("October 17, 2026");
    expect(formatDateLong("2026-10-17", "it")).toBe("17 ottobre 2026");
    expect(formatDateLong("2026-10-17", "de")).toBe("17. Oktober 2026");
    expect(formatDateLong("2026-10-17", "fr")).toBe("17 octobre 2026");
    expect(formatDateLong("2026-10-17", "es")).toBe("17 de octubre de 2026");
  });
});

// ── ⑤ Kardinalne smeri (Go Mode) ───────────────────────────────────────────

describe("i18n-core (4-c): go-gps kardinali 6 jezikov", () => {
  test("sever in vzhod po jeziku (V/O/E konvencije)", () => {
    expect(cardinalLabel(0, "sl")).toBe("S");
    expect(cardinalLabel(0, "en")).toBe("N");
    expect(cardinalLabel(0, "it")).toBe("N");
    expect(cardinalLabel(90, "sl")).toBe("V");
    expect(cardinalLabel(90, "it")).toBe("E");
    expect(cardinalLabel(90, "de")).toBe("O");
    expect(cardinalName(0, "sl")).toBe("sever");
    expect(cardinalName(0, "de")).toBe("Norden");
    expect(cardinalName(180, "fr")).toBe("sud");
    expect(cardinalName(270, "es")).toBe("oeste");
  });
});

// ── ⑥ Datumski Intl slovar ─────────────────────────────────────────────────

describe("i18n-core (4-c): INTL_DATE_LOCALE enota", () => {
  test("vseh 6 jezikov ima svoj Intl tag", () => {
    expect(Object.keys(INTL_DATE_LOCALE).sort()).toEqual(
      ["de", "en", "es", "fr", "it", "sl"].sort()
    );
    expect(INTL_DATE_LOCALE.sl).toBe("sl-SI");
    expect(INTL_DATE_LOCALE.en).toBe("en-GB");
    expect(INTL_DATE_LOCALE.it).toBe("it-IT");
    expect(INTL_DATE_LOCALE.de).toBe("de-DE");
    expect(INTL_DATE_LOCALE.fr).toBe("fr-FR");
    expect(INTL_DATE_LOCALE.es).toBe("es-ES");
  });

  test("intlDateLocale: neznano → sl-SI (fallback, ne ugibanje)", () => {
    expect(intlDateLocale("it")).toBe("it-IT");
    expect(intlDateLocale("xx")).toBe("sl-SI");
    expect(intlDateLocale(undefined)).toBe("sl-SI");
  });
});

// ── ⑦ FR register = tu (harmonizacija 2.21.0) ──────────────────────────────

describe("i18n-core (4-c): FR register harmonizacija (tu, ne vous)", () => {
  test("v FR nizih v src ni več vous-oblik (razven samostalnika rendez-vous)", async () => {
    // rekurzivni scan src .ts/.tsx — isti vzorec kot i18n-quadrilingual ①
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const e of await Array.fromAsync(new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: dir }))) {
        files.push(`${dir}/${e}`);
      }
    };
    await walk("src");
    expect(files.length).toBeGreaterThan(50); // varnostni prag
    const vousRe =
      /\b(vous|votre|vos|Vérifiez|Écrivez|Choisissez|Essayez|effacez|réessayez|Planifiez|Souhaitez|Découvrez|composez|partez|Cliquez|Consultez|appuyez|utilisez)\b/;
    const offenders: string[] = [];
    for (const f of files) {
      const text = await Bun.file(f).text();
      for (const line of text.split("\n")) {
        if (!line.includes('fr: "')) continue;
        // odrežemo vsebino FR niza (do zaključnega narekovaja pred , ali })
        const m = line.match(/fr: "([^"]*)"/);
        if (m && vousRe.test(m[1].replace(/rendez-vous/g, ""))) {
          offenders.push(`${f}: ${m[1].slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── ⑧ Vrata normalizacije ──────────────────────────────────────────────────

describe("i18n-core (4-c): asPickLocale vrata", () => {
  test("veljavni jeziki grejo skozi, neznano → sl", () => {
    expect(asPickLocale("sl")).toBe("sl");
    expect(asPickLocale("en")).toBe("en");
    expect(asPickLocale("it")).toBe("it");
    expect(asPickLocale("de")).toBe("de");
    expect(asPickLocale("fr")).toBe("fr");
    expect(asPickLocale("es")).toBe("es");
    expect(asPickLocale("hr")).toBe("sl");
    expect(asPickLocale("")).toBe("sl");
    expect(asPickLocale(undefined)).toBe("sl");
    expect(asPickLocale(null)).toBe("sl");
  });
});
