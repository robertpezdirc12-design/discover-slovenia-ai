import { describe, expect, test } from "bun:test";

import { PICK_LOCALES } from "../src/lib/i18n-pick";
import {
  JSONLD_SITE_ORIGIN,
  eventsJsonLd,
  jsonldScriptHtml,
  softwareApplicationJsonLd,
  touristDestinationJsonLd,
} from "../src/lib/jsonld";
import { EVENTS } from "../src/lib/content-data";
import { DESTINATIONS, getDestination } from "../src/lib/slovenia-data";

/**
 * POLIR C (2.28.0) — SEO JSON-LD gradilnika (navdih MonkeyTravel rich
 * results: SoftwareApplication s featureList + TouristDestination).
 *
 * DVE PLASTI:
 *  1. ENOTE: obvezna polja schema.org, JSON.parse veljavnost, determinizem
 *     (isti vhod → isti JSON niz), varno telo skripte (ubežni '<').
 *  2. ISKRENOST (kanon repozitorija): cena "0" (načrtovanje JE brezplačno),
 *     featureList ×6 popoln in vsebuje »deterministi«/»0 AI« (varovalni pes:
 *     bodoča AI marketinška točka brez resnice takoj pade), TouristDestination
 *     samo iz kanonskih podatkov (geo 1:1, url po hreflang konvenciji) —
 *     prek VSEH 38 destinacij.
 */

describe("jsonld [enote]: SoftwareApplication (domača stran)", () => {
  test("① vsa obvezna polja schema.org obstajajo", () => {
    const ld = softwareApplicationJsonLd("sl");
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("SoftwareApplication");
    expect(ld.name).toBe("Discover Slovenia AI");
    expect(ld.applicationCategory).toBe("TravelApplication");
    expect(ld.operatingSystem).toBe("Web");
    expect(Array.isArray(ld.featureList)).toBe(true);
    expect(ld.featureList.length).toBeGreaterThan(0);
    expect(ld.inLanguage).toEqual(["sl", "en", "it", "de", "fr", "es"]);
  });

  test("② iskrena cena: offers.price = \"0\" EUR (načrtovanje je res brezplačno)", () => {
    const ld = softwareApplicationJsonLd("en");
    expect(ld.offers).toEqual({
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    });
  });

  test("③ url sledi hreflang konvenciji (sl brez predpone, en s predpono)", () => {
    expect(softwareApplicationJsonLd("sl").url).toBe(`${JSONLD_SITE_ORIGIN}/`);
    expect(softwareApplicationJsonLd("en").url).toBe(`${JSONLD_SITE_ORIGIN}/en/`);
  });

  test("④ JSON.stringify → JSON.parse round-trip je veljaven (vseh 6 jezikov)", () => {
    for (const locale of PICK_LOCALES) {
      const parsed = JSON.parse(
        JSON.stringify(softwareApplicationJsonLd(locale))
      ) as ReturnType<typeof softwareApplicationJsonLd>;
      expect(parsed.name).toBe("Discover Slovenia AI");
      expect(parsed.featureList.length).toBeGreaterThan(0);
    }
  });

  test("⑤ determinizem: isti vhod → bitno isti JSON niz", () => {
    expect(JSON.stringify(softwareApplicationJsonLd("sl"))).toBe(
      JSON.stringify(softwareApplicationJsonLd("sl"))
    );
    expect(JSON.stringify(softwareApplicationJsonLd("fr"))).toBe(
      JSON.stringify(softwareApplicationJsonLd("fr"))
    );
  });

  test("⑥ neznan locale → slovenska rezerva (iskreno, nikoli ugibanje)", () => {
    expect(JSON.stringify(softwareApplicationJsonLd("xx"))).toBe(
      JSON.stringify(softwareApplicationJsonLd("sl"))
    );
  });
});

describe("jsonld [iskrenost]: featureList ×6 jezikov", () => {
  test("⑦ popoln za vseh 6 jezikov — natanko 8 resničnih funkcij, vse neprazne", () => {
    for (const locale of PICK_LOCALES) {
      const list = softwareApplicationJsonLd(locale).featureList;
      expect(list.length).toBe(8); // zaklep: nova funkcija ali brisanje zahtevata zavesten test
      for (const f of list) {
        expect(typeof f).toBe("string");
        expect(f.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("⑧ sl featureList razglavlja determinizem in 0 AI (varovalni pes pred lažnim AI marketingom)", () => {
    const joined = softwareApplicationJsonLd("sl").featureList
      .join(" ")
      .toLowerCase();
    expect(joined).toContain("deterministi"); // Deterministični … 0 AI
    expect(joined).toContain("0 ai");
    // resnične funkcije, ki jih naloga zahteva kot dokaz:
    expect(joined).toContain("go mode");
    expect(joined).toContain("pdf");
    expect(joined).toContain(".ics");
    expect(joined).toContain("38");
    expect(joined).toContain("open-meteo");
  });

  test("⑨ enak kanon v tujih jezikih (determinističen prevod, ne slučajni niz)", () => {
    const en = softwareApplicationJsonLd("en").featureList.join(" ").toLowerCase();
    expect(en).toContain("deterministic");
    expect(en).toContain("0 ai");
    const de = softwareApplicationJsonLd("de").featureList.join(" ").toLowerCase();
    expect(de).toContain("deterministisch");
    expect(de).toContain("0 ki");
  });
});

describe("jsonld [enote]: TouristDestination (/destinacija/[slug])", () => {
  test("⑩ obvezna polja iz kanonskih podatkov (name/geo.lat/geo.lng/url/image)", () => {
    const bled = getDestination("bled")!;
    const ld = touristDestinationJsonLd(bled, "sl");
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("TouristDestination");
    expect(ld.name).toBe(bled.name);
    expect(ld.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: bled.coords.lat,
      longitude: bled.coords.lng,
    });
    expect(ld.url).toBe(`${JSONLD_SITE_ORIGIN}/destinacija/bled`);
    expect(ld.image).toBe(`${JSONLD_SITE_ORIGIN}${bled.image}`);
    expect(ld.description).toBe(bled.description);
  });

  test("⑪ url z locale predpono (en) po isti hreflang konvenciji kot meta alternates", () => {
    const bled = getDestination("bled")!;
    expect(touristDestinationJsonLd(bled, "en").url).toBe(
      `${JSONLD_SITE_ORIGIN}/en/destinacija/bled`
    );
  });

  test("⑫ determinizem: isti vhod → bitno isti JSON niz", () => {
    const bled = getDestination("bled")!;
    expect(JSON.stringify(touristDestinationJsonLd(bled, "it"))).toBe(
      JSON.stringify(touristDestinationJsonLd(bled, "it"))
    );
  });

  test("⑬ VSEH 74 destinacij zgradi veljaven JSON-LD z realnimi koordinatami", () => {
    expect(DESTINATIONS.length).toBe(74); // kanon nabora (slovenia-data.test, #41 F1)
    for (const d of DESTINATIONS) {
      const ld = touristDestinationJsonLd(d, "sl");
      const parsed = JSON.parse(JSON.stringify(ld)) as typeof ld;
      expect(parsed.name).toBe(d.name);
      // geo 1:1 iz kanonskih podatkov (nič izmišljenega):
      expect(parsed.geo.latitude).toBe(d.coords.lat);
      expect(parsed.geo.longitude).toBe(d.coords.lng);
      expect(parsed.url).toBe(`${JSONLD_SITE_ORIGIN}/destinacija/${d.slug}`);
      expect(parsed.image).toBe(`${JSONLD_SITE_ORIGIN}${d.image}`);
    }
  });
});

describe("jsonld [enote]: Event @graph (/dogodki, 2.45.0 — QA #38)", () => {
  /** Potrjeni dogodki po kanonu podatkov (iskrenostni model #38). */
  const confirmed = EVENTS.filter(
    (e) => e.dateStart !== "" && !e.dateUnconfirmed
  );
  const unconfirmed = EVENTS.filter(
    (e) => e.dateStart === "" || e.dateUnconfirmed
  );

  test("⑲ samo POTRJENI dogodki v @graph (kanonski zaklep 22/31, SDK serija 2.53.0)", () => {
    const graph = eventsJsonLd(EVENTS, "sl")["@graph"];
    // zaklep: potrditev/razveljavitev datuma zahteva zavesten test
    // (2.49.0: 18 → 20; SDK serija 2026-10-13: 20 → 22; F2 #41 2.56.0:
    // 22 → 26 — BEMUS, TIFF Solun, Sarajevo Winter, DokuFest potrjeni)
    expect(graph.length).toBe(26);
    expect(confirmed.length).toBe(26);
    expect(unconfirmed.length).toBe(EVENTS.length - 26);
    // noben nepotrjen zapis ne sme zaideti kot Event:
    const names = graph.map((g) => g.name);
    for (const u of unconfirmed) expect(names).not.toContain(u.title);
    // vsak potrjen je prisoten (1:1 po vrstnem redu dogodkov):
    expect(names).toEqual(confirmed.map((e) => e.title));
  });

  test("⑳ obvezna polja schema.org za VSE entitete (name/startDate/location/url/image/description)", () => {
    const graph = eventsJsonLd(EVENTS, "sl")["@graph"];
    for (const g of graph) {
      expect(g["@type"]).toBe("Event");
      expect(g.name.trim().length).toBeGreaterThan(0);
      expect(g.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO iz kanona
      expect(g.location["@type"]).toBe("Place");
      expect(g.location.name.trim().length).toBeGreaterThan(0);
      expect(g.location.address).toEqual({
        "@type": "PostalAddress",
        addressCountry: "SI",
      });
      expect(g.url).toBe(`${JSONLD_SITE_ORIGIN}/dogodki`);
      expect(g.image.startsWith(JSONLD_SITE_ORIGIN)).toBe(true);
      expect(g.description.trim().length).toBeGreaterThan(0);
    }
  });

  test("㉑ iskrenost: brez izmišljenega endDate in brez izmišljene cene", () => {
    const json = JSON.stringify(eventsJsonLd(EVENTS, "sl"));
    expect(json).not.toContain("endDate"); // podatki nimajo trajanja — ne ugibamo
    expect(json).not.toContain('"offers"'); // euro/euro2 niso numerična cena
    // isAccessibleForFree: true IZKLJUČNO za price "free":
    const graph = eventsJsonLd(EVENTS, "sl")["@graph"];
    const confirmedFree = confirmed.filter((e) => e.price === "free");
    const freeCount = graph.filter(
      (g) => (g as { isAccessibleForFree?: boolean }).isAccessibleForFree === true
    ).length;
    expect(freeCount).toBe(confirmedFree.length);
    expect(freeCount).toBeGreaterThan(0);
  });

  test("㉒ url sledi hreflang konvenciji (sl brez predpone, en s predpono)", () => {
    expect(eventsJsonLd(EVENTS, "sl")["@graph"][0].url).toBe(
      `${JSONLD_SITE_ORIGIN}/dogodki`
    );
    expect(eventsJsonLd(EVENTS, "en")["@graph"][0].url).toBe(
      `${JSONLD_SITE_ORIGIN}/en/dogodki`
    );
  });

  test("㉓ determinizem + veljaven ubežen JSON round-trip", () => {
    expect(JSON.stringify(eventsJsonLd(EVENTS, "sl"))).toBe(
      JSON.stringify(eventsJsonLd(EVENTS, "sl"))
    );
    const html = jsonldScriptHtml(eventsJsonLd(EVENTS, "de"));
    expect(html).not.toContain("</script>");
    const parsed = JSON.parse(html) as ReturnType<typeof eventsJsonLd>;
    // 2.49.0: 18 → 20; SDK 2026-10-13: 20 → 22; F2 #41: 22 → 26 potrjenih
    expect(parsed["@graph"].length).toBe(26);
    expect(parsed["@graph"][0].name).toBe(confirmed[0].title);
  });

  test("㉔ stranska pogodba: /dogodki izriše ld+json skripto z nonce (enak kanon kot domača stran)", async () => {
    const page = await Bun.file(
      "src/app/[locale]/dogodki/page.tsx"
    ).text();
    expect(page).toContain('type="application/ld+json"');
    expect(page).toContain("nonce={nonce}");
    expect(page).toContain('(await headers()).get("x-nonce")');
    // 2.48.0 (#38): stran poda SSR `todayIso` (Europe/Ljubljana) —
    // zaključeni dogodki izključeni iz @graph + oznaka „pretekli dogodek“.
    expect(page).toContain("eventsJsonLd(EVENTS, locale, todayIso)");
    expect(page).toContain("<EventsView todayIso={todayIso} />");
    expect(page).toContain("jsonldScriptHtml(");
    expect(page).not.toContain("__html: JSON.stringify(");
  });
});

describe("jsonld [varnost]: telo inline skripte (CSP + XHTML)", () => {
  test("⑭ jsonldScriptHtml ubeži '<' — izpis ne more vsebovati </script>", () => {
    const hostile = { description: "</script><script>alert(1)</script>" };
    const html = jsonldScriptHtml(hostile);
    expect(html).not.toContain("<");
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c");
  });

  test("⑮ ubežna oblika je še vedno veljaven JSON (parse vrne '<' nazaj)", () => {
    const html = jsonldScriptHtml(softwareApplicationJsonLd("sl"));
    const parsed = JSON.parse(html) as ReturnType<typeof softwareApplicationJsonLd>;
    expect(parsed["@type"]).toBe("SoftwareApplication");
    // destinacijski opisi (edini uporabniško-dolg niz) ostanejo berljivi:
    const bled = getDestination("bled")!;
    const destHtml = jsonldScriptHtml(touristDestinationJsonLd(bled, "sl"));
    const destParsed = JSON.parse(destHtml) as ReturnType<
      typeof touristDestinationJsonLd
    >;
    expect(destParsed.description).toBe(bled.description);
  });
});

describe("jsonld [source-contract]: strani izrisajo JSON-LD z CSP nonce", () => {
  async function src(path: string): Promise<string> {
    return Bun.file(path).text();
  }

  test("⑯ domača stran: skripta ld+json z nonce iz x-nonce (middleware)", async () => {
    const home = await src("src/app/[locale]/page.tsx");
    expect(home).toContain('type="application/ld+json"');
    expect(home).toContain("nonce={nonce}");
    expect(home).toContain('(await headers()).get("x-nonce")');
    expect(home).toContain("softwareApplicationJsonLd(locale)");
    // izključno varno telo (ubežni '<'), ne surovega JSON.stringify:
    expect(home).toContain("jsonldScriptHtml(");
    expect(home).not.toContain("__html: JSON.stringify(");
  });

  test("⑰ destinacijska stran: skripta ld+json z nonce + destinacijski podatki", async () => {
    const dest = await src("src/app/[locale]/destinacija/[slug]/page.tsx");
    expect(dest).toContain('type="application/ld+json"');
    expect(dest).toContain("nonce={nonce}");
    expect(dest).toContain('(await headers()).get("x-nonce")');
    expect(dest).toContain("touristDestinationJsonLd(d, locale)");
    expect(dest).toContain("jsonldScriptHtml(");
    expect(dest).not.toContain("__html: JSON.stringify(");
  });

  test("⑱ builderja sta čista (brez React/next/headers — primerna za teste)", async () => {
    const lib = await src("src/lib/jsonld.ts");
    expect(lib).not.toContain('"use client"');
    expect(lib).not.toContain("from \"react\"");
    expect(lib).not.toContain("from \"next/");
    expect(lib).not.toContain("dangerouslySetInnerHTML={{");
  });
});
