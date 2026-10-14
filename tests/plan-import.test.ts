/**
 * PLAN-IMPORT BATERIJA (POLIR4, izdaja 2.31.0) — UVOZ KML/GPX NA /nacrtuj.
 * ============================================================================
 *  · ročni kurzorski tokenizer: entitete (imenovane/številčne), CDATA,
 *    komentarji z lažnimi oznakami (NE smejo zadeti), samo-zapiranje,
 *    vgnezdeni Folder, neujoščene oznake → iskrena napaka, BOM/presledki
 *    pred korenom, besedilo pred/za korenom → zavrnjeno;
 *  · KML po URADNI strukturi (kml/Document/Placemark/name/Point/coordinates
 *    z lon,lat[,alt]; LineString = izpuščena pot; točka brez imena se ujame
 *    po bližini) in GPX po uradni shemi (wpt lat/lon + name; rte/trk =
 *    izpuščene poti);
 *  · meje: > 2 MiB zavrnjeno; > 200 točk → prvih 200 + truncated;
 *  · ujemanje: kanon DEST_NEEDLES (koreni/skloni/diakritike/izrecne oblike),
 *    bližina roadKm ≤ 2 km (1,9 km da, 2,1 km ne; Bled ↔ Vintgarska soteska
 *    se NE zamenjata), ime > koordinate, dedup po slugu, neznani Z IMENI;
 *  · determinizem: 10× globoko enak izhod;
 *  · ZRCALO KANONA: uvoz je klientanski, kanon match.ts pa strežniški
 *    (advisor/context → node:fs) → plan-import nosi zrcalo tabele igel +
 *    iskalnika, katerega enakost s kanonom je TUKAJ zaklenjena 1:1
 *    (tabela + baterija sklonov/diakritik/lažnih pozitivov + exhaustivno
 *    čez vsa imena registra) — tiho odmikanje je nemogoče;
 *  · source-contract view.tsx: skriti input (accept/sr-only/reset), gumb z
 *    L ključem, FileReader + readAsText in 0 fetch V UVOZNEM HANDLERJU;
 *  · L10N: vsi novi ključi ×6 jezikov dobesedno.
 *
 * Kanon: 0 omrežja, 0 AI, 0 DOMParserja — isti vhod → isti izhod.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { roadKm } from "@/lib/itinerary-engine";
import { DESTINATIONS } from "@/lib/slovenia-data";
import {
  DEST_NEEDLES,
  findDestinationMentions,
} from "@/lib/start-anywhere/match";
import {
  COORD_MATCH_KM,
  DEST_NEEDLES_MIRROR,
  IMPORT_MAX_CHARS,
  IMPORT_MAX_POINTS,
  deriveImportSuggestion,
  findDestinationMentionsMirror,
  matchImportPlacemarks,
  parseImportFile,
  type ImportMatch,
} from "@/lib/plan-import";

const VIEW = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/nacrtuj/view.tsx"),
  "utf8",
);

const PLAN_IMPORT = readFileSync(
  join(import.meta.dir, "../src/lib/plan-import.ts"),
  "utf8",
);

/** Vsi podprti jeziki (kanon izdelka). */
const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;

// ── fiksni vzorci (uradni strukturi) ───────────────────────────────────────

/** KML vzorec PO URADNI REFERENCI: kml/Document/Placemark + name + Point. */
const KML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Moji kraji</name>
    <Style id="ikona"/>
    <Placemark>
      <name>Bled</name>
      <Point><coordinates>14.0944,46.3683,500</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>Vintgar</name>
      <Point><coordinates>14.1167,46.4,434</coordinates></Point>
    </Placemark>
    <Placemark>
      <Point><coordinates>13.8833,46.2833</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>Pohod po Karavankah</name>
      <LineString><coordinates>14.10,46.40 14.20,46.45</coordinates></LineString>
    </Placemark>
  </Document>
</kml>`;

/** GPX vzorec PO URADNI SHEMI: wpt z lat/lon + neobveznim name; rte/trk. */
const GPX_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Testni izvoz</name></metadata>
  <wpt lat="46.3683" lon="14.0944"><name>Bled</name><ele>500</ele></wpt>
  <wpt lat="45.5233" lon="13.5676"/>
  <rte><name>Moja ruta</name><rtept lat="46.05" lon="14.50"/></rte>
  <trk><name>Sled</name><trkseg><trkpt lat="46.10" lon="14.40"/></trkseg></trk>
</gpx>`;

/** Koordinate registra (vir resnice — nič izmišljenega). */
function destCoords(slug: string): { lat: number; lng: number } {
  const d = DESTINATIONS.find((x) => x.slug === slug);
  if (!d) throw new Error(`slug ${slug} ni v registru`);
  return d.coords;
}

/** Zadetek po slugu (ali null). */
function hit(mr: { matched: ImportMatch[] }, slug: string): ImportMatch | null {
  return mr.matched.find((m) => m.slug === slug) ?? null;
}

// ── ROČNI KURZORSKI TOKENIZER ──────────────────────────────────────────────

describe("plan-import — ročni kurzorski tokenizer XML", () => {
  test("entitete v imenu: &amp; in številčne (&#66;/&#x42;) se dekodirajo", () => {
    const kml =
      "<kml><Document><Placemark><name>Bled &amp; Bohinj</name><Point><coordinates>14.0944,46.3683</coordinates></Point></Placemark>" +
      "<Placemark><name>&#66;led</name><Point><coordinates>14.1,46.4</coordinates></Point></Placemark>" +
      "<Placemark><name>&#x42;ohinj</name><Point><coordinates>13.8833,46.2833</coordinates></Point></Placemark>" +
      "</Document></kml>";
    const p = parseImportFile(kml);
    expect(p.error).toBeNull();
    expect(p.placemarks[0]?.name).toBe("Bled & Bohinj");
    expect(p.placemarks[1]?.name).toBe("Bled");
    expect(p.placemarks[2]?.name).toBe("Bohinj");
  });

  test("CDATA ime se prebere dobesedno", () => {
    const kml =
      "<kml><Placemark><name><![CDATA[Moja hiša ob jezeru]]></name><Point><coordinates>14.1,46.4</coordinates></Point></Placemark></kml>";
    const p = parseImportFile(kml);
    expect(p.error).toBeNull();
    expect(p.placemarks[0]?.name).toBe("Moja hiša ob jezeru");
  });

  test("komentar z lažnim <Placemark> NE sme zadeti (Piran ostane izven)", () => {
    const kml = `<kml><Document>
      <!-- lažni: <Placemark><name>Piran</name><Point><coordinates>13.5676,45.5233</coordinates></Point></Placemark> -->
      <Placemark><name>Bled</name><Point><coordinates>14.0944,46.3683</coordinates></Point></Placemark>
    </Document></kml>`;
    const p = parseImportFile(kml);
    expect(p.error).toBeNull();
    expect(p.placemarks).toHaveLength(1);
    expect(p.placemarks[0]?.name).toBe("Bled");
    const mr = matchImportPlacemarks(p.placemarks);
    expect(hit(mr, "bled")).not.toBeNull();
    expect(hit(mr, "piran")).toBeNull(); // lažni Placemark v komentarju NE obstaja
  });

  test("samo-zapiranje <tag/> (Style, Folder) ne zlomi strukture", () => {
    const kml =
      '<kml><Document><Style id="s"/><Folder/><Placemark><name>Bled</name><Point><coordinates>14.0944,46.3683</coordinates></Point></Placemark></Document></kml>';
    const p = parseImportFile(kml);
    expect(p.error).toBeNull();
    expect(p.placemarks).toHaveLength(1);
    expect(p.placemarks[0]?.name).toBe("Bled");
  });

  test("vgnezdeni Folder: Placemark globoko v kml/Document/Folder/Folder", () => {
    const kml =
      "<kml><Document><Folder><Folder><Placemark><name>Vintgar</name><Point><coordinates>14.1167,46.4</coordinates></Point></Placemark></Folder></Folder></Document></kml>";
    const p = parseImportFile(kml);
    expect(p.error).toBeNull();
    expect(p.placemarks).toHaveLength(1);
    expect(matchImportPlacemarks(p.placemarks).matched[0]?.slug).toBe("vintgarska-soteska");
  });

  test("neujoščene oznake → iskrena napaka (ne tiho)", () => {
    const p = parseImportFile("<kml><Document></kml>");
    expect(p.format).toBeNull();
    expect(p.error).toContain("razčleniti");
    expect(p.error).toContain("Neujoščeni oznaki");
    const p2 = parseImportFile("<kml><Placemark><name>x");
    expect(p2.error).not.toBeNull();
    const p3 = parseImportFile("<kml></Document></kml>");
    expect(p3.error).not.toBeNull();
  });

  test("BOM in presledki pred korenom dovoljeni; besedilo pred korenom zavrnjeno", () => {
    const p = parseImportFile("﻿   \n\t<kml><Placemark><name>Bled</name></Placemark></kml>  \n");
    expect(p.error).toBeNull();
    expect(p.placemarks[0]?.name).toBe("Bled");
    const p2 = parseImportFile("junk<kml/>");
    expect(p2.error).toContain("Besedilo pred korenskim elementom");
    const p3 = parseImportFile("<gpx/>junk");
    expect(p3.error).toContain("za korenskim elementom");
  });

  test("procesna navodila, DOCTYPE, komentar za korenom in atributi v enojnih narekovajih", () => {
    const p = parseImportFile(
      '<?xml version="1.0"?>\n<!DOCTYPE gpx>\n<gpx><wpt lat=\'46.3683\' lon=\'14.0944\'><name>Bled</name></wpt></gpx><!-- n -->\n'
    );
    expect(p.error).toBeNull();
    expect(p.format).toBe("gpx");
    expect(p.placemarks[0]?.name).toBe("Bled");
    // atribut BREZ narekovajev → iskrena napaka (XML zahteva narekovaje)
    const p2 = parseImportFile("<gpx><wpt lat=46.3683 lon=14.0944/></gpx>");
    expect(p2.error).toContain("narekovajih");
    // neznana entiteta → iskrena napaka
    const p3 = parseImportFile("<gpx><wpt><name>&napaka;</name></wpt></gpx>");
    expect(p3.error).not.toBeNull();
  });
});

// ── KML PO URADNI STRUKTURI ────────────────────────────────────────────────

describe("plan-import — KML po uradni strukturi", () => {
  test("vzorec: 3 točke + 1 LineString pot; vrstni red koordinat lon,lat[,alt]", () => {
    const p = parseImportFile(KML_SAMPLE);
    expect(p.error).toBeNull();
    expect(p.format).toBe("kml");
    expect(p.placemarks).toHaveLength(3);
    expect(p.skippedPaths).toBe(1); // LineString Placemark = POT, ne točka
    expect(p.truncated).toBe(false);
    // KML piše lon,lat — izhod mora biti [lat, lon] (Bled 46.3683 N, 14.0944 E)
    expect(p.placemarks[0]?.coords).toEqual([46.3683, 14.0944]);
    expect(p.placemarks[0]?.order).toBe(1);
    expect(p.placemarks[2]?.name).toBeNull(); // Placemark brez imena (samo Point)
  });

  test("ujemanje vzorca: Bled (stem), Vintgar (exact), točka brez imena po bližini", () => {
    const p = parseImportFile(KML_SAMPLE);
    const mr = matchImportPlacemarks(p.placemarks);
    expect(mr.matched).toHaveLength(3);
    expect(mr.unmatchedNames).toEqual([]);
    expect(mr.duplicateCount).toBe(0);

    const bled = hit(mr, "bled");
    expect(bled?.kind).toBe("stem");
    expect(bled?.needle).toBe("bled");
    expect(bled?.evidence).toBe("bled"); // dokaz iz datoteke same

    const vintgar = hit(mr, "vintgarska-soteska");
    expect(vintgar?.kind).toBe("exact");
    expect(vintgar?.needle).toBe("vintgar");

    const bohinj = hit(mr, "bohinj");
    expect(bohinj?.kind).toBe("coords"); // brez imena → bližina koordinat
    expect(bohinj?.evidence).toBe("≈ 0,0 km od Bohinj");
    expect(bohinj?.needle).toBeUndefined();
  });

  test("Placemark z LineString se NE uvozi — iskren števec izpuščenih poti", () => {
    const kml =
      "<kml><Placemark><name>Pot</name><LineString><coordinates>14.1,46.4 14.2,46.45</coordinates></LineString></Placemark>" +
      "<Placemark><name>Poligon</name><Polygon><outerBoundaryIs><LinearRing><coordinates>14.1,46.4 14.2,46.45 14.15,46.35 14.1,46.4</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>";
    const p = parseImportFile(kml);
    expect(p.placemarks).toHaveLength(0);
    expect(p.skippedPaths).toBe(2);
  });
});

// ── GPX PO URADNI SHEMI ────────────────────────────────────────────────────

describe("plan-import — GPX po uradni shemi", () => {
  test("vzorec: wpt z imenom, wpt brez imena, rte in trk izpuščeni kot poti", () => {
    const p = parseImportFile(GPX_SAMPLE);
    expect(p.error).toBeNull();
    expect(p.format).toBe("gpx");
    expect(p.placemarks).toHaveLength(2);
    expect(p.skippedPaths).toBe(2); // rte (z rtept) + trk (s trkseg/trkpt)
    expect(p.placemarks[0]?.name).toBe("Bled");
    expect(p.placemarks[0]?.coords).toEqual([46.3683, 14.0944]);
    expect(p.placemarks[1]?.name).toBeNull();
    expect(p.placemarks[1]?.coords).toEqual([45.5233, 13.5676]);
  });

  test("ujemanje vzorca: Bled po imenu, brezimni wpt → Piran po bližini", () => {
    const p = parseImportFile(GPX_SAMPLE);
    const mr = matchImportPlacemarks(p.placemarks);
    expect(mr.matched).toHaveLength(2);
    expect(hit(mr, "bled")?.kind).toBe("stem");
    const piran = hit(mr, "piran");
    expect(piran?.kind).toBe("coords");
    expect(piran?.evidence).toBe("≈ 0,0 km od Piran");
    // metadata/name ni wpt ime — nič od njega ne sme priti v zadetke
    expect(mr.unmatchedNames).toEqual([]);
  });

  test("samo wpt so točke: rtept/trkpt se NE uvozijo (niti po imenu)", () => {
    const gpx =
      '<gpx><rte><rtept lat="46.05" lon="14.50"><name>Bled</name></rtept></rte>' +
      '<trk><trkseg><trkpt lat="46.10" lon="14.40"><name>Piran</name></trkpt></trkseg></trk></gpx>';
    const p = parseImportFile(gpx);
    expect(p.placemarks).toHaveLength(0);
    expect(p.skippedPaths).toBe(2);
    expect(matchImportPlacemarks(p.placemarks).matched).toHaveLength(0);
  });
});

// ── MEJE (ISKRENE) ─────────────────────────────────────────────────────────

describe("plan-import — meje (2 MiB, 200 točk, prazna datoteka)", () => {
  test("besedilo > 2 MiB → iskrena zavrnitev (format null)", () => {
    const big = "<gpx>" + "a".repeat(IMPORT_MAX_CHARS) + "</gpx>";
    expect(big.length).toBeGreaterThan(IMPORT_MAX_CHARS);
    const p = parseImportFile(big);
    expect(p.format).toBeNull();
    expect(p.error).toContain("prevelika");
    expect(p.placemarks).toHaveLength(0);
  });

  test("točno 2 MiB še gre skozi (meja vključujoča)", () => {
    const pad = " ".repeat(IMPORT_MAX_CHARS - "<gpx></gpx>".length);
    const p = parseImportFile(`<gpx>${pad}</gpx>`);
    expect(p.error).toBeNull();
    expect(p.format).toBe("gpx");
  });

  test("201 točk → prvih 200 + truncated (iskren odrez, vrstni red ohranjen)", () => {
    const wpt = `<wpt lat="46.1" lon="14.1"/>`;
    const p = parseImportFile(`<gpx>${wpt.repeat(IMPORT_MAX_POINTS + 1)}</gpx>`);
    expect(p.placemarks).toHaveLength(IMPORT_MAX_POINTS);
    expect(p.truncated).toBe(true);
    expect(p.placemarks[0]?.order).toBe(1);
    expect(p.placemarks[IMPORT_MAX_POINTS - 1]?.order).toBe(IMPORT_MAX_POINTS);
    // točno 200 → brez odreza
    const q = parseImportFile(`<gpx>${wpt.repeat(IMPORT_MAX_POINTS)}</gpx>`);
    expect(q.placemarks).toHaveLength(IMPORT_MAX_POINTS);
    expect(q.truncated).toBe(false);
  });

  test("prazna datoteka / samo presledki / neznan korenski element → format null", () => {
    expect(parseImportFile("").format).toBeNull();
    expect(parseImportFile("").error).toContain("prazna");
    expect(parseImportFile("   \n  ").error).toContain("korenski element");
    const p = parseImportFile("<rss><item/></rss>");
    expect(p.format).toBeNull();
    expect(p.error).toContain("kml");
    expect(p.error).toContain("gpx");
  });
});

// ── UJEMANJE PO KANONU ─────────────────────────────────────────────────────

describe("plan-import — ujemanje: ime (DEST_NEEDLES) pred koordinatami", () => {
  test("koreni in skloni: „Bled“ → bled, „na Bledu“ → bled, „Vintgar“ → vintgarska-soteska", () => {
    const mr = matchImportPlacemarks([
      { name: "Bled", coords: null, order: 1 },
      { name: "na Bledu", coords: null, order: 2 },
      { name: "Vintgar", coords: null, order: 3 },
    ]);
    expect(mr.matched[0]?.slug).toBe("bled");
    expect(mr.matched[0]?.kind).toBe("stem");
    expect(mr.matched[0]?.evidence).toBe("bled");
    expect(mr.matched[1]?.slug).toBe("vintgarska-soteska"); // „na Bledu“ je dedup
    expect(mr.matched[1]?.kind).toBe("exact");
    expect(mr.duplicateCount).toBe(1); // drugi Bled = ponovitev, iskreno
  });

  test("diakritike po kanonu stripDiacritics: „Ljubljánski grad“ → ljubljana", () => {
    const mr = matchImportPlacemarks([{ name: "Ljubljánski grad", coords: null, order: 1 }]);
    expect(mr.matched[0]?.slug).toBe("ljubljana");
    expect(mr.matched[0]?.kind).toBe("stem");
    expect(mr.matched[0]?.evidence).toBe("ljubljanski");
  });

  test("ime ima PREDNOST pred koordinatami (Piran po imenu, ne Bled po bližini)", () => {
    const bled = destCoords("bled");
    const mr = matchImportPlacemarks([
      { name: "Piran", coords: [bled.lat, bled.lng], order: 1 },
    ]);
    expect(mr.matched).toHaveLength(1);
    expect(mr.matched[0]?.slug).toBe("piran");
    expect(mr.matched[0]?.kind).toBe("stem");
  });
});

describe("plan-import — ujemanje: bližina koordinat (roadKm ≤ 2 km)", () => {
  test("točka ~1,5 km od Bohinja → bohinj (kind coords, dokaz ≈ km)", () => {
    // 46.293676 = Bohinj + 0,010376° latitude → roadKm ≈ 1,4999 (preverjeno)
    const bohinj = destCoords("bohinj");
    const point = { lat: 46.293676, lng: bohinj.lng };
    expect(roadKm(point, bohinj)).toBeLessThan(COORD_MATCH_KM);
    const mr = matchImportPlacemarks([{ name: null, coords: [point.lat, point.lng], order: 1 }]);
    expect(mr.matched[0]?.slug).toBe("bohinj");
    expect(mr.matched[0]?.kind).toBe("coords");
    expect(mr.matched[0]?.evidence).toBe("≈ 1,5 km od Bohinj");
  });

  test("prag: 1,89 km še zadene, 2,12 km NE (≤ 2 km)", () => {
    const bohinj = destCoords("bohinj");
    const notri = matchImportPlacemarks([
      { name: null, coords: [46.2964, bohinj.lng], order: 1 },
    ]);
    expect(notri.matched[0]?.slug).toBe("bohinj");
    const ven = matchImportPlacemarks([
      { name: null, coords: [46.298, bohinj.lng], order: 1 },
    ]);
    expect(ven.matched).toHaveLength(0);
    expect(ven.unmatchedNames).toEqual(["(točka brez imena)"]);
  });

  test("Bled ↔ Vintgarska soteska se NE zamenjata (≈ 5 roadKm > prag 2 km)", () => {
    const bled = destCoords("bled");
    const vintgar = destCoords("vintgarska-soteska");
    expect(roadKm(bled, vintgar)).toBeGreaterThan(COORD_MATCH_KM);
    // točka TOČNO med njima (~2,5 roadKm od obeh) ne sme zadelti nobenega
    const mid = { lat: (bled.lat + vintgar.lat) / 2, lng: (bled.lng + vintgar.lng) / 2 };
    const mr = matchImportPlacemarks([{ name: null, coords: [mid.lat, mid.lng], order: 1 }]);
    expect(mr.matched).toHaveLength(0);
    expect(mr.unmatchedNames).toEqual(["(točka brez imena)"]);
  });

  test("oddaljena pošteno poročana točka: 5 km od vsega → unmatched z imenom", () => {
    const mr = matchImportPlacemarks([
      { name: "Moja hiša", coords: [47.0, 17.0], order: 1 },
      { name: "Nek drugi kotiček", coords: null, order: 2 },
    ]);
    expect(mr.matched).toHaveLength(0);
    expect(mr.unmatchedNames).toEqual(["Moja hiša", "Nek drugi kotiček"]);
  });

  test("dedup po slugu: 2× Bled (ime + koordinata) → 1 zadetek + duplicateCount 1", () => {
    const bled = destCoords("bled");
    const mr = matchImportPlacemarks([
      { name: "Bled", coords: null, order: 1 },
      { name: null, coords: [bled.lat, bled.lng], order: 2 },
      { name: "Vintgar", coords: null, order: 3 },
    ]);
    expect(mr.matched.map((m) => m.slug)).toEqual(["bled", "vintgarska-soteska"]);
    expect(mr.duplicateCount).toBe(1);
    expect(mr.unmatchedNames).toEqual([]);
  });

  test("brez imena in brez koordinat → „(točka brez imena)“ (nikoli tiho)", () => {
    const mr = matchImportPlacemarks([{ name: null, coords: null, order: 1 }]);
    expect(mr.matched).toHaveLength(0);
    expect(mr.unmatchedNames).toEqual(["(točka brez imena)"]);
  });

  test("izpeljava predloga PONOVNO UPORABI kanon suggest (interesi/regija)", () => {
    // Bled (jezero) + Vintgarska soteska (soteska) → Gorenjska
    const mr = matchImportPlacemarks([
      { name: "Bled", coords: null, order: 1 },
      { name: "Vintgar", coords: null, order: 2 },
    ]);
    const sug = deriveImportSuggestion(mr.matched);
    expect(sug.interests).toEqual(["jezero", "soteska"]);
    expect(sug.region).toBe("gorenjska");
    // Piran (obala → morje) → Primorska
    const mr2 = matchImportPlacemarks([{ name: "Piran", coords: null, order: 1 }]);
    const sug2 = deriveImportSuggestion(mr2.matched);
    expect(sug2.interests).toEqual(["morje"]);
    expect(sug2.region).toBe("primorska");
  });
});

// ── DETERMINIZEM ───────────────────────────────────────────────────────────

describe("plan-import — determinizem (10× globoko enako)", () => {
  test("isti vhod → isti izhod (razčlenitev + ujemanje + predlog, 10×)", () => {
    // vzorec z entitetami, CDATA, komentarji, potjo, dedupom in neznanimi
    const kml = `<?xml version="1.0"?>
<kml><Document>
  <!-- <Placemark><name>Piran</name></Placemark> -->
  <Placemark><name>Bled &amp; Bohinj</name><Point><coordinates>14.0944,46.3683,500</coordinates></Point></Placemark>
  <Placemark><name><![CDATA[Moja hiša]]></name><Point><coordinates>16.9,47.0</coordinates></Point></Placemark>
  <Placemark><Point><coordinates>13.8833,46.2833</coordinates></Point></Placemark>
  <Placemark><name>na Bledu</name><Point><coordinates>13.8833,46.2833</coordinates></Point></Placemark>
  <Placemark><name>Pot</name><LineString><coordinates>14.1,46.4 14.2,46.45</coordinates></LineString></Placemark>
</Document></kml>`;
    const run = () => JSON.stringify({
      parse: parseImportFile(kml),
      match: matchImportPlacemarks(parseImportFile(kml).placemarks),
      sug: deriveImportSuggestion(matchImportPlacemarks(parseImportFile(kml).placemarks).matched),
    });
    const first = run();
    for (let k = 0; k < 10; k++) {
      expect(run()).toBe(first);
    }
    // in vsebina ostane POŠTENA: bled (ime) + bohinj (bližina brezimne točke),
    // „na Bledu“ ujame bled po IMENU (ime > koordinate) → je ponovitev;
    // „Moja hiša“ je predaleč od vsega; LineString je izpuščena pot.
    const p = parseImportFile(kml);
    const mr = matchImportPlacemarks(p.placemarks);
    expect(mr.matched.map((m) => m.slug)).toEqual(["bled", "bohinj"]);
    expect(mr.matched[1]?.evidence).toBe("≈ 0,0 km od Bohinj");
    expect(mr.unmatchedNames).toEqual(["Moja hiša"]);
    expect(p.skippedPaths).toBe(1);
    expect(mr.duplicateCount).toBe(1);
    // dedup IME: „na Bledu“ je zadel bled po imenu kljub koordinatam na Bohinju
    expect(mr.matched[0]?.evidence).toBe("bled");
  });
});

// ── ZRCALO KANONA (zaklep 1:1 na start-anywhere/match) ───────────────────

describe("plan-import — ZRCALO KANONA DEST_NEEDLES (zaklep na match.ts)", () => {
  test("tabela zrcala je bitno (deep) enaka kanonu DEST_NEEDLES", () => {
    expect(DEST_NEEDLES_MIRROR).toEqual(DEST_NEEDLES);
    expect(DEST_NEEDLES_MIRROR).toHaveLength(DEST_NEEDLES.length);
  });

  test("iskalnik zrcala se obnaša ENAKO — skloni, diakritike, lažni pozitivi", () => {
    const battery = [
      "Bled", "na Bledu", "Bled & Bohinj", "po Ljubljani", "Ljubljánski grad",
      "Vintgar", "v Vintgarju,", "Vintgarska soteska", "Postojni jami",
      "v Postojnski jami", "soci", "ob Soci", "Pula", "v Puli",
      "pulover", "socialna omrežja", "Novo mesto", "v novem mestu",
      "novomeški muzej", "mesto", "plitvicama", "Plitvička jezera",
      "Caporetto", "Rogaška Slatina", "Murska Sobota", "Slovenj Gradec",
      "Ptuj", "Celje", "Nova Gorica", "Kobarid", "Triglav", "Bohinj",
      "Piran", "Portorož", "Maribor", "Lendava", "Otočec", "Crnomelj",
      "Rijeka", "Zadar", "Split", "Hvar", "Dubrovnik", "Kotor", "Budva",
      "Podgorica", "Durmitor", "Tirana", "Berat", "Gjirokastra",
      "Saranda", "Škofja Loka", "miza",
    ];
    for (const t of battery) {
      expect(
        findDestinationMentionsMirror(t),
        `zrcalo ≠ kanon pri: „${t}“`,
      ).toEqual(findDestinationMentions(t));
    }
    // lažni pozitivi kanona ostanejo lažni pozitivi tudi v zrcalu
    expect(findDestinationMentionsMirror("pulover")).toHaveLength(0);
    expect(findDestinationMentionsMirror("socialna omrežja")).toHaveLength(0);
    expect(findDestinationMentionsMirror("Škofja Loka")).toHaveLength(0);
  });

  test("exhaustivno: vsa imena registra + vse izrecne oblike igel", () => {
    for (const d of DESTINATIONS) {
      expect(findDestinationMentionsMirror(d.name)).toEqual(
        findDestinationMentions(d.name),
      );
    }
    for (const n of DEST_NEEDLES) {
      for (const phrase of n.exact ?? []) {
        expect(findDestinationMentionsMirror(phrase)).toEqual(
          findDestinationMentions(phrase),
        );
      }
    }
  });
});

// ── SOURCE-CONTRACT VIEW.TSX (uvoz 100 % klientanski) ──────────────────────

describe("plan-import — source-contract view.tsx (0 omrežja v uvozu)", () => {
  /** Blok uvoznega handlerja (od definicije do naslednje funkcije). */
  const handler = VIEW.slice(
    VIEW.indexOf("const onImportFile"),
    VIEW.indexOf("const applyStartAnywhere"),
  );

  test("uvozni handler obstaja in kliče kanon plan-import", () => {
    expect(handler).toContain("parseImportFile(");
    expect(handler).toContain("matchImportPlacemarks(");
    expect(handler).toContain("deriveImportSuggestion(");
  });

  test("0 fetch v uvoznem handlerju — datoteka NE zapusti brskalnika", () => {
    expect(handler).not.toContain("fetch(");
    expect(handler).not.toContain("XMLHttpRequest");
    expect(handler).toContain("new FileReader("); // branjе IZKLJUČNO klientansko
    expect(handler).toContain("reader.readAsText(file)");
  });

  test("skriti datotečni vhod: accept .kml/.gpx/.xml, sr-only, reset value", () => {
    expect(VIEW).toContain('accept=".kml,.gpx,.xml"');
    expect(VIEW).toContain('className="sr-only"');
    expect(handler).toContain('e.target.value = ""'); // reset: ista datoteka znova
  });

  test("gumb „Uvozi KML/GPX“ z L ključem in ikono FileUp (lucide)", () => {
    expect(VIEW).toContain("FileUp"); // uvoz ikone iz lucide-react
    expect(VIEW).toContain("pick(l, L.importButton)");
    expect(VIEW).toContain("importInputRef.current?.click()");
  });

  test("rezultat uvoza vstopi v ISTI SaResult tok (source kind import)", () => {
    expect(VIEW).toContain('kind: "import"');
    expect(VIEW).toContain("unmatchedNames: mr.unmatchedNames");
    expect(VIEW).toContain("skippedPaths: parsed.skippedPaths");
    expect(VIEW).toContain("duplicateCount: mr.duplicateCount");
    expect(VIEW).toContain("setSaResult(");
    expect(VIEW).toContain("setSaApplied(false)");
  });

  test("0 zadetkov → iskrena napaka (importNoMatch), brez načrta", () => {
    expect(handler).toContain("L.importNoMatch");
    expect(handler).toContain("mr.matched.length === 0");
  });

  test("pogodba čistosti modula: 0 fetch/omrežja, 0 Math.random/Date.now, 0 DOMParser", () => {
    expect(PLAN_IMPORT).not.toContain("fetch(");
    expect(PLAN_IMPORT).not.toContain("Math.random");
    expect(PLAN_IMPORT).not.toContain("Date.now");
    expect(PLAN_IMPORT).not.toContain("new DOMParser");
    expect(PLAN_IMPORT).not.toContain("window.");
  });

  test("PONOVNA UPORABA kanonov: deriveSuggestion (suggest), roadKm (engine), SAMO-TIPI uvoz match.ts", () => {
    expect(PLAN_IMPORT).toContain("deriveSuggestion"); // kanon suggest.ts (klientansko varen)
    expect(PLAN_IMPORT).toContain("roadKm"); // kanon projektne razdalje (engine)
    // vrednostni uvoz match.ts bi v brskalniški paket potegnil node:fs
    // (advisor/context → sto/content) → uvoz je SAMO-TIPEN (izbrisan ob buildu)
    expect(PLAN_IMPORT).toContain(
      'import type {\n  DestinationMention,\n  DestNeedle,\n} from "@/lib/start-anywhere/match";',
    );
    expect(PLAN_IMPORT).not.toContain("import {\n  findDestinationMentions");
    // igle niso izmišljene: zrcalo je zaklenjeno na kanon (testi zrcala zgoraj)
    expect(PLAN_IMPORT).toContain("DEST_NEEDLES_MIRROR");
  });
});

// ── L10N ×6 (dobesedno) ────────────────────────────────────────────────────

describe("plan-import — L10N: novi ključi ×6 jezikov dobesedno", () => {
  type Anchors = Record<(typeof LANGS)[number], string>;

  /** Ključ → 6 jezikovnih sider (razpoznavni del niza v izvorni kodi). */
  const KEYS: Record<string, Anchors> = {
    importButton: {
      sl: "Uvozi KML/GPX",
      en: "Import KML/GPX",
      it: "Importa KML/GPX",
      de: "KML/GPX importieren",
      fr: "Importer KML/GPX",
      es: "Importar KML/GPX",
    },
    importSource: {
      sl: "Uvožena datoteka",
      en: "Imported ${f.toUpperCase()} file",
      it: "File ${f.toUpperCase()} importato",
      de: "Importierte ${f.toUpperCase()}-Datei",
      fr: "Fichier ${f.toUpperCase()} importé",
      es: "Archivo ${f.toUpperCase()} importado",
    },
    importUnmatched: {
      sl: "Niso v registru: ${names.join(\", \")}",
      en: "Not in the register: ${names.join(\", \")}",
      it: "Non nel registro: ${names.join(\", \")}",
      de: "Nicht im Register: ${names.join(\", \")}",
      fr: "Pas dans le registre : ${names.join(\", \")}",
      es: "No están en el registro: ${names.join(\", \")}",
    },
    importSkippedPaths: {
      sl: "Izpuščene poti (niso kraji): ${n}.",
      en: "Skipped paths (not places): ${n}.",
      it: "Percorsi saltati (non luoghi): ${n}.",
      de: "Übersprungene Pfade (keine Orte): ${n}.",
      fr: "Itinéraires ignorés (pas des lieux) : ${n}.",
      es: "Rutas omitidas (no lugares): ${n}.",
    },
    importDuplicates: {
      sl: "Ponovljene točke: ${n} — isti kraj je upoštevan samo enkrat.",
      en: "Repeated points: ${n} — the same place is counted only once.",
      it: "Punti ripetuti: ${n} — lo stesso luogo è contato una sola volta.",
      de: "Wiederholte Punkte: ${n} — derselbe Ort wird nur einmal gezählt.",
      fr: "Points répétés : ${n} — un même lieu n'est compté qu'une seule fois.",
      es: "Puntos repetidos: ${n} — el mismo lugar se cuenta solo una vez.",
    },
    importTruncated: {
      sl: "Datoteka ima več kot 200 točk — upoštevanih je prvih 200.",
      en: "The file has more than 200 points — the first 200 are used.",
      it: "Il file ha più di 200 punti — vengono usati i primi 200.",
      de: "Die Datei hat mehr als 200 Punkte — die ersten 200 werden verwendet.",
      fr: "Le fichier contient plus de 200 points — les 200 premiers sont utilisés.",
      es: "El archivo tiene más de 200 puntos — se usan los primeros 200.",
    },
    importNoMatch: {
      sl: "V datoteki nisem prepoznal nobenega kraja iz registra (74 destinacij).",
      en: "No place from the register (74 destinations) was recognized in the file.",
      it: "Nel file non è stato riconosciuto nessun luogo del registro (74 destinazioni).",
      de: "In der Datei wurde kein Ort aus dem Register (74 Reiseziele) erkannt.",
      fr: "Aucun lieu du registre (74 destinations) n'a été reconnu dans le fichier.",
      es: "No se reconoció ningún lugar del registro (74 destinos) en el archivo.",
    },
    importReadError: {
      sl: "Datoteke ni bilo mogoče prebrati — poskusi znova.",
      en: "The file could not be read — please try again.",
      it: "Impossibile leggere il file — riprova.",
      de: "Die Datei konnte nicht gelesen werden — bitte erneut versuchen.",
      fr: "Le fichier n'a pas pu être lu — veuillez réessayer.",
      es: "No se pudo leer el archivo — inténtalo de nuevo.",
    },
    importPrivacy: {
      sl: "Obdelava v brskalniku — datoteka ne zapusti naprave.",
      en: "Processed in the browser — the file never leaves your device.",
      it: "Elaborazione nel browser — il file non lascia il dispositivo.",
      de: "Verarbeitung im Browser — die Datei verlässt dein Gerät nicht.",
      fr: "Traitement dans le navigateur — le fichier ne quitte pas l'appareil.",
      es: "Procesado en el navegador — el archivo no sale del dispositivo.",
    },
    importOriginNote: {
      sl: "Uvoženi kraji so izhodišče načrta (interesi in regija), ne prisilna pot",
      en: "Imported places are the plan's starting point (interests and region), not a forced route",
      it: "I luoghi importati sono il punto di partenza del piano (interessi e regione), non un itinerario forzato",
      de: "Importierte Orte sind der Ausgangspunkt des Plans (Interessen und Region), keine erzwungene Route",
      fr: "Les lieux importés sont le point de départ du plan (centres d'intérêt et région), pas un itinéraire imposé",
      es: "Los lugares importados son el punto de partida del plan (intereses y región), no una ruta forzada",
    },
  };

  test("vseh 10 novih ključev po vseh 6 jezikih (dobesedni sidri)", () => {
    expect(Object.keys(KEYS)).toHaveLength(10);
    for (const [key, anchors] of Object.entries(KEYS)) {
      for (const lang of LANGS) {
        expect(
          VIEW.includes(anchors[lang]),
          `ključ ${key} [${lang}] manjka sidro: ${anchors[lang]}`,
        ).toBe(true);
      }
    }
  });

  test("slovenski prevod prikaza vira uvoza (1 točka / 2 točki / 5 točk)", () => {
    // množinska logika je v izvorni kodi (n % 100) — sidra dobesedno
    expect(VIEW).toContain('n % 100 === 1 ? "točka" : n % 100 === 2 ? "točki"');
    expect(VIEW).toContain('n % 100 === 3 || n % 100 === 4 ? "točke" : "točk"');
  });
});
