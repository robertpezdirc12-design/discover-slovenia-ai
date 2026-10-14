/**
 * PLAN-IMPORT — UVOZ KML/GPX NA /nacrtuj (POLIR4, izdaja 2.31.0).
 * ============================================================================
 * Uporabnik uvozi seznam krajev (KML iz Google My Maps / shranjenih mest,
 * GPX iz pohodniških/kolesarskih orodij) kot IZHODIŠČE načrta — vzporedno
 * s povezavo/besedilom Start Anywhere (2.25.0).
 *
 * Kanoni:
 *  · 0 AI, 0 žetonov, 0 OMREŽJA: razčlenitev in ujemanje tečeta IZKLJUČNO
 *    v brskalniku — datoteka NE ZAPUSTI naprave (noben fetch, noben API);
 *  · DETERMINIZEM: isti vhod → isti izhod; vrstni red = vrstni red točk v
 *    datoteki; kanoničen vrstni red registra pri ujemanju (nikoli naključno);
 *  · ROČNI KURZORSKI TOKENIZER XML podnaborja (precedens:
 *    journey/reservation-import.ts): bun nima DOMParserja, regex čez celo
 *    datoteko pa je krhek — bralnik znakov s kurzorjem podpira komentarje
 *    <!-- -->, CDATA, entitete (&amp; &lt; &gt; &quot; &apos; &#NN; &#xNN;),
 *    atribute v narekovajih, samo-zapiranje <tag/> in vgnezdenje;
 *  · ISKRENOST: neujoščene oznake/predolga datoteka/neznan format → odkrita
 *    napaka (nikoli tiho); poti (KML LineString/Polygon, GPX rte/trk) se NE
 *    uvozijo, ampak se iskerno preštejejo; neznane točke se pokažejo Z IMENI;
 *    dokaz ujemanja izhaja iz datoteke same (ime/bližina), nikoli ugibanje;
 *  · UJEMANJE: najprej IME prek kanona DEST_NEEDLES (start-anywhere/match —
 *    slovenski skloni, izrecne oblike, 0 novih tabel), šele nato KOORDINATE
 *    (najbližja destinacija registra po roadKm — kanon projektne razdalje —
 *    s pragom ≤ 2 km, da soseda (Bled ↔ Vintgarska soteska ≈ 5 roadKm) ne
 *    zamenjamo); dedup po slugu (drugi zadetek na isti kraj se iskerno
 *    prešteje v duplicateCount);
 *  · PREDLOG: interesi/regija se izpeljejo prek obstoječega deriveSuggestion
 *    (start-anywhere/suggest — 0 nove logike).
 *
 * POZOR — ZRCALO KANONA DEST_NEEDLES (iskreno dokumentirano odstopanje):
 *  kanon start-anywhere/match.ts danes ŽIVI na strežniški poti — njegova
 *  uvozna veriga vleče advisor/context → sto/content → node:fs/promises,
 *  katerega brskalniški paket NE zmore (živo dokazano na /nacrtuj, turbo
 *  dev: „chunking context does not support external modules"). Ker je uvoz
 *  zahtevan 100 % klientanski (0 fetch — datoteka ne zapusti brskalnika),
 *  ta modul nosi ZRCALJENO kopijo tabele igel + iskalnika (spodaj), ki jo
 *  test tests/plan-import.test.ts ZAKLENE na kanon 1:1 (enakost tabel +
 *  enakost obnašanja findDestinationMentions čez baterijo sklonov in
 *  lažnih pozitivov) — zrcalo NE more tiho odmikniti od kanona. Ko bo
 *  kanon kdaj odsvobojen odvisnosti node:fs, se zrcalo izbriše in uvoz
 *  pošlje naravnost v match.ts (javni izhod tega modula se NE spremeni).
 *
 * Uradni referenci (raziskava 2026-10-12-polir4.md):
 *  · KML: <Placemark> (vgnezden v kml/Document/Folder) → prvi <name> +
 *    <Point><coordinates>lon,lat[,alt]</coordinates> (VRSTNI RED lon,lat!);
 *    Placemark z LineString/Polygon je POT, ne točka;
 *  · GPX: <wpt lat="…" lon="…"> z neobveznim <name>; rtept/trkpt so točke
 *    POTI — za uvoz seznamov krajev je wpt kanonska oblika (rte/trk štejemo
 *    kot izpuščene poti, 1 pot = 1 števec, vzporedno s KML).
 */

import { DESTINATIONS, type Destination } from "@/lib/slovenia-data";
// SAMO TIPI iz start-anywhere/match — uvoz tipov se ob buildu izbriše
// (vrednostni uvoz bi v brskalniški paket potegnil node:fs — glej POZOR
// zgoraj); enak vzorec kot start-anywhere/suggest.ts.
import type {
  DestinationMention,
  DestNeedle,
} from "@/lib/start-anywhere/match";
// suggest.ts je klientansko varen (edini vrednostni uvoz je slovenia-data).
import { deriveSuggestion, type Suggestion } from "@/lib/start-anywhere/suggest";
import { roadKm } from "@/lib/itinerary-engine";

// ── meje (iskrene, dokumentirane) ──────────────────────────────────────────

/** Zgornja meja dolžine besedila (znakov ≈ 2 MiB) — varna klientanska. */
export const IMPORT_MAX_CHARS = 2 * 1024 * 1024;

/** Največje število uvoženih točk (več → prvih 200 + iskrena opomba). */
export const IMPORT_MAX_POINTS = 200;

/** Prag koordinatnega ujemanja (roadKm): bližje od tega = isti kraj. */
export const COORD_MATCH_KM = 2;

// ── javni tipi ─────────────────────────────────────────────────────────────

/** Format uvoza (avtodetekcija po korenskem elementu). */
export type ImportFormat = "kml" | "gpx";

/** Ena točka iz datoteke (KML Placemark/Point ali GPX wpt). */
export interface ImportPlacemark {
  /** Ime točke (prvi <name>), če je — sicer null (iskreno). */
  name: string | null;
  /** [širina (lat), dolžina (lon)] — sicer null (točka brez/uporabnih koordinat). */
  coords: [number, number] | null;
  /** 1-osnovni vrstni red v datoteki (določen PRED morebitnim odrezom). */
  order: number;
}

/** Rezultat razčlenitve datoteke (vedno iskren — napaka ali podatki). */
export interface ImportParseResult {
  /** "kml" | "gpx" | null (null = format neznan/napaka). */
  format: ImportFormat | null;
  /** Točke (≤ IMPORT_MAX_POINTS; > 200 → prvih 200). */
  placemarks: ImportPlacemark[];
  /** Izpuščene POTI (KML LineString/Polygon Placemark; GPX rte/trk) — iskren števec. */
  skippedPaths: number;
  /** true, če je bilo datoteko treba odrezati na 200 točk. */
  truncated: boolean;
  /** Iskrena napaka v slovenščini (null = razčlenitev uspela). */
  error: string | null;
}

/** Zadetek uvožene točke na destinacijo registra (oblika SaResult.matches). */
export interface ImportMatch {
  slug: string;
  name: string;
  type: string;
  region: string;
  /** Dokaz iz datoteke same: zadeto besedilo ali „≈ X km od Y" (ocena). */
  evidence: string;
  /** Igla kanona DEST_NEEDLES (manjka pri koordinatnem ujemanju). */
  needle?: string;
  /** Vrsta ujemanja: koren / izrecna oblika / bližina koordinat. */
  kind: "stem" | "exact" | "coords";
}

/** Rezultat ujemanja točk proti registru 74 destinacij. */
export interface ImportMatchResult {
  /** Zadeti kraji (vrstni red = vrstni red točk v datoteki; dedup po slugu). */
  matched: ImportMatch[];
  /** Imena točk, ki jih register NE pozna (nikoli tiho izpuščene). */
  unmatchedNames: string[];
  /** Število dodatnih točk na ŽE upoštevan kraj (iskren števec). */
  duplicateCount: number;
}

// ── ročni kurzorski tokenizer XML podnaborja ───────────────────────────────

/** Vozel XML (ime, atributi (male črke ključev), otroci, direktno besedilo). */
interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Zlep direktnih besedilnih/CDATA segmentov (komentarji izpuščeni). */
  text: string;
}

/** Zgornja meja globine vgnezdenja (kml/Document/Folder/Placemark ≈ 6). */
const MAX_DEPTH = 100;

type XmlFail = { ok: false; error: string };
type XmlDoc = { ok: true; root: XmlNode } | XmlFail;
type XmlElem = { ok: true; node: XmlNode } | XmlFail;

const WS = " \t\r\n";

function isWs(c: string): boolean {
  return WS.includes(c);
}

/** Prvi znak imena oznake: ASCII črka, podčrtaj ali dvopičje (imenski prostor). */
function isNameStart(c: string): boolean {
  return /[A-Za-z_:]/.test(c);
}

/** Nadaljnji znaki imena oznake. */
function isNameChar(c: string): boolean {
  return /[A-Za-z0-9_:.\-]/.test(c);
}

/**
 * Dekodiraj entitete v kratkem segmentu (besedilo/atribut).
 * Podprto: &amp; &lt; &gt; &quot; &apos; &#NN; &#xNN; — ob neznani,
 * nedokončani ali nedovoljeni entiteti vrne null (klicalej iskreno
 * poroča). CDATA se NE dekodira (dosledno z XML).
 */
function decodeEntities(s: string): string | null {
  if (!s.includes("&")) return s;
  let out = "";
  let j = 0;
  while (j < s.length) {
    const c = s[j];
    if (c !== "&") {
      out += c;
      j++;
      continue;
    }
    const semi = s.indexOf(";", j + 1);
    // entiteta mora biti zaključena in kratka (&#x10FFFF; = 10 znakov)
    if (semi < 0 || semi - j > 10) return null;
    const ent = s.slice(j + 1, semi);
    let ch: string | null = null;
    if (ent === "amp") ch = "&";
    else if (ent === "lt") ch = "<";
    else if (ent === "gt") ch = ">";
    else if (ent === "quot") ch = '"';
    else if (ent === "apos") ch = "'";
    else if (/^#\d{1,7}$/.test(ent) || /^#[xX][0-9a-fA-F]{1,6}$/.test(ent)) {
      const code =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : Number(ent.slice(1));
      // prepovedane kontrolne kode (razen tab/LF/CR), nadomestne in > U+10FFFF
      if (
        !Number.isInteger(code) ||
        code > 0x10ffff ||
        (code >= 0xd800 && code <= 0xdfff) ||
        (code < 0x20 && code !== 0x9 && code !== 0xa && code !== 0xd)
      ) {
        return null;
      }
      ch = String.fromCodePoint(code);
    }
    if (ch === null) return null; // neznana entiteta — ne ugibamo
    out += ch;
    j = semi + 1;
  }
  return out;
}

/**
 * ROČNI KURZORSKI PARSER XML (podnabor za KML/GPX; 0 DOMParserja, 0 regexa
 * čez celo datoteko — kurzor znak za znakom). Stroga pravila (iskrene
 * napake):
 *  · pred korenskim elementom samo BOM/presledki + <?…?>, <!--…-->, <!DOCTYPE …>;
 *  · za korenskim elementom samo presledki + komentarji/procesna navodila;
 *  · natančno EN korenski element; neujoščene oznake → napaka;
 *  · atributi OBVEZNO v narekovajih ("…"/'…'), brez podvajanja;
 *  · globina ≤ MAX_DEPTH (zagrenjene datoteke ne razstrešejo sklada).
 */
function parseXml(text: string): XmlDoc {
  let i = 0;
  const n = text.length;
  const fail = (error: string): XmlFail => ({ ok: false, error });

  const skipWs = () => {
    while (i < n && isWs(text[i])) i++;
  };

  /** Preskoči konstrukcijo od kurzorja do zaključka (vrne null ali napako). */
  const skipUntil = (end: string, error: string): string | null => {
    const idx = text.indexOf(end, i);
    if (idx < 0) return error;
    i = idx + end.length;
    return null;
  };

  /** Prebere ime oznake od kurzorja (kurzor zaustavljen na 1. znaku imena). */
  const readName = (): string | null => {
    if (i >= n || !isNameStart(text[i])) return null;
    let j = i + 1;
    while (j < n && isNameChar(text[j])) j++;
    const name = text.slice(i, j);
    i = j;
    return name;
  };

  /** Preskoči <!DOCTYPE …> (z možnim notranjim naborom […]) pred korenom. */
  const skipDoctype = (): string | null => {
    let j = i + 2;
    let bracket = false;
    while (j < n) {
      const c = text[j];
      if (bracket) {
        if (c === "]") bracket = false;
      } else if (c === "[") bracket = true;
      else if (c === ">") {
        i = j + 1;
        return null;
      }
      j++;
    }
    return "Nedokončana deklaracija <!DOCTYPE …>.";
  };

  /** Prebere en element (odprto oznako) z otroki — rekurzivno, po kurzorju. */
  const parseElement = (depth: number): XmlElem => {
    if (text.startsWith("</", i)) {
      return fail(`Nepričakovana zaključna oznaka ${text.slice(i, i + 24)} … brez odprte.`);
    }
    i++; // preskoči "<"
    const name = readName();
    if (name === null) return fail("Neveljavno ime oznake (pričakovana črka/_/:).");
    const attrs: Record<string, string> = {};

    // ── atributi do ">" ali "/>"
    for (;;) {
      skipWs();
      if (i >= n) return fail(`Nedokončana oznaka <${name}> — manjka ">".`);
      const c = text[i];
      if (c === ">") {
        i++;
        break;
      }
      if (c === "/") {
        if (i + 1 < n && text[i + 1] === ">") {
          i += 2;
          return { ok: true, node: { name, attrs, children: [], text: "" } }; // samo-zapiranje <tag/>
        }
        return fail(`Nepričakovan znak "/" v oznaki <${name}>.`);
      }
      // atribut: ime = vrednost
      const attrName = readName();
      if (attrName === null) return fail(`Neveljaven atribut v oznaki <${name}>.`);
      skipWs();
      if (text[i] !== "=") {
        return fail(`Atribut „${attrName}" v <${name}> nima vrednosti (pričakovan "=").`);
      }
      i++;
      skipWs();
      const quote = text[i];
      if (quote !== '"' && quote !== "'") {
        return fail(`Vrednost atributa „${attrName}" v <${name}> mora biti v narekovajih.`);
      }
      i++;
      const close = text.indexOf(quote, i);
      if (close < 0) return fail(`Nedokončana vrednost atributa „${attrName}" v <${name}>.`);
      const raw = text.slice(i, close);
      i = close + 1;
      const decoded = decodeEntities(raw);
      if (decoded === null) {
        return fail(`Neveljavna entiteta v atributu „${attrName}" (oznaka <${name}>).`);
      }
      const key = attrName.toLowerCase();
      if (key in attrs) return fail(`Podvojen atribut „${attrName}" v <${name}>.`);
      attrs[key] = decoded;
    }

    // ── vsebina do ujemajoče zaključne oznake
    if (depth >= MAX_DEPTH) return fail(`Preveliko vgnezdenje XML (meja ${MAX_DEPTH}).`);
    const children: XmlNode[] = [];
    const textParts: string[] = [];
    for (;;) {
      if (i >= n) return fail(`Nedokončana oznaka <${name}> — manjka </${name}>.`);
      if (text.startsWith("<!--", i)) {
        const err = skipUntil("-->", "Nedokončan komentar <!-- … -->.");
        if (err) return fail(err);
        continue; // komentarji se IZPUSTIJO (tudi z lažnimi oznakami znotraj)
      }
      if (text.startsWith("<![CDATA[", i)) {
        const close = text.indexOf("]]>", i + 9);
        if (close < 0) return fail("Nedokončan CDATA.");
        textParts.push(text.slice(i + 9, close)); // dobesedno, BREZ dekodiranja
        i = close + 3;
        continue;
      }
      if (text.startsWith("<?", i)) {
        const err = skipUntil("?>", "Nedokončano procesno navodilo <? … ?>.");
        if (err) return fail(err);
        continue;
      }
      if (text.startsWith("<!", i)) {
        return fail(`Nepričakovana konstrukcija <!…> znotraj <${name}>.`);
      }
      if (text.startsWith("</", i)) {
        i += 2;
        const closeName = readName();
        if (closeName === null) return fail("Neveljavno ime zaključne oznake.");
        skipWs();
        if (text[i] !== ">") return fail(`Nedokončena zaključna oznaka </${closeName}>.`);
        i++;
        if (closeName.toLowerCase() !== name.toLowerCase()) {
          return fail(`Neujoščeni oznaki: pričakovana </${name}>, najdena </${closeName}>.`);
        }
        break; // usklajeno zaprtje
      }
      if (text[i] === "<") {
        const child = parseElement(depth + 1);
        if (!child.ok) return child;
        children.push(child.node);
        continue;
      }
      // besedilo do naslednjega "<" (entitete se dekodirajo)
      const next = text.indexOf("<", i);
      const end = next < 0 ? n : next;
      const decoded = decodeEntities(text.slice(i, end));
      if (decoded === null) return fail("Neveljavna ali neznana entiteta v besedilu.");
      textParts.push(decoded);
      i = end;
    }
    return { ok: true, node: { name, attrs, children, text: textParts.join("") } };
  };

  // ── pred korenskim elementom: BOM + presledki + PI/komentar/DOCTYPE
  if (text.charCodeAt(0) === 0xfeff) i = 1; // BOM je izrecno dovoljen
  for (;;) {
    skipWs();
    if (i >= n) return fail("Prazen dokument — korenski element manjka.");
    if (!text.startsWith("<", i)) {
      return fail("Besedilo pred korenskim elementom ni dovoljeno (dovoljeni so samo presledki/BOM).");
    }
    if (text.startsWith("<?", i)) {
      const err = skipUntil("?>", "Nedokončano procesno navodilo <? … ?>.");
      if (err) return fail(err);
    } else if (text.startsWith("<!--", i)) {
      const err = skipUntil("-->", "Nedokončan komentar <!-- … -->.");
      if (err) return fail(err);
    } else if (text.startsWith("<![CDATA[", i)) {
      return fail("CDATA pred korenskim elementom ni dovoljena.");
    } else if (text.startsWith("<!", i)) {
      const err = skipDoctype();
      if (err) return fail(err);
    } else {
      break; // korenska oznaka
    }
  }

  // ── natančno EN korenski element
  const rootRes = parseElement(0);
  if (!rootRes.ok) return rootRes;
  const root = rootRes.node;

  // ── za korenom: samo presledki + komentarji/procesna navodila (XML Misc)
  for (;;) {
    skipWs();
    if (i >= n) break;
    if (text.startsWith("<!--", i)) {
      const err = skipUntil("-->", "Nedokončan komentar <!-- … -->.");
      if (err) return fail(err);
    } else if (text.startsWith("<?", i)) {
      const err = skipUntil("?>", "Nedokončano procesno navodilo <? … ?>.");
      if (err) return fail(err);
    } else {
      return fail("Vsebina za korenskim elementom ni dovoljena.");
    }
  }
  return { ok: true, root };
}

// ── pomoči za drevo (deterministično, dokumentov vrstni red) ───────────────

function tagOf(node: XmlNode): string {
  return node.name.toLowerCase();
}

function firstChildByTag(node: XmlNode, tag: string): XmlNode | null {
  for (const c of node.children) {
    if (tagOf(c) === tag) return c;
  }
  return null;
}

/** Vsi potomci z oznako (dokumentov vrstni red — globina po vrsti). */
function descendantsByTag(node: XmlNode, tag: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (n: XmlNode) => {
    for (const c of n.children) {
      if (tagOf(c) === tag) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

/** Besedilo prvega neposrednega otroka <tag> (obrezano; prazno → null). */
function textChildOrNull(node: XmlNode, tag: string): string | null {
  const child = firstChildByTag(node, tag);
  if (child === null) return null;
  const t = child.text.trim();
  return t.length > 0 ? t : null;
}

/** Veljavna decimalna številka znotraj zemljepisnih mej. */
function numInRange(v: number, min: number, max: number): boolean {
  return Number.isFinite(v) && v >= min && v <= max;
}

/** Pomoč: preslikaj številski niz (prazen/nedovoljen → null). */
function toNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null; // Number("") = 0 — past!
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

// ── KML (uradna referenca: lon,lat[,alt] v <Point><coordinates>) ───────────

/** <coordinates>lon,lat[,alt]</coordinates> → [lat, lon] (POZOR: obrat!). */
function parseKmlCoordinates(text: string): [number, number] | null {
  const tuple = text.trim().split(/\s+/)[0] ?? "";
  if (tuple.length === 0) return null;
  const parts = tuple.split(",");
  if (parts.length < 2 || parts.length > 3) return null; // brez ugibanja
  const lon = toNumber(parts[0]);
  const lat = toNumber(parts[1]);
  if (lat === null || lon === null) return null;
  if (!numInRange(lat, -90, 90) || !numInRange(lon, -180, 180)) return null;
  return [lat, lon];
}

function parseKmlPlacemarks(
  root: XmlNode
): { placemarks: ImportPlacemark[]; skippedPaths: number } {
  const placemarks: ImportPlacemark[] = [];
  let skippedPaths = 0;
  let order = 0;
  // Placemark je lahko vgnezden v kml/Document/Folder (uradna referenca) —
  // poiščemo VSE po dokumentovem vrstnem redu.
  for (const pm of descendantsByTag(root, "placemark")) {
    const name = textChildOrNull(pm, "name");
    // Prva neposredna GEOMETRIJA med otroci odloča (Point = točka;
    // LineString/Polygon = pot; MultiGeometry/Model ne prepoznamo → točka
    // brez koordinat, ki se po imenu pošteno ujema/poroča — nikoli tiho).
    let coords: [number, number] | null = null;
    let isPath = false;
    for (const child of pm.children) {
      const t = tagOf(child);
      if (t === "point") {
        const c = firstChildByTag(child, "coordinates");
        coords = c === null ? null : parseKmlCoordinates(c.text);
        break;
      }
      if (t === "linestring" || t === "polygon") {
        isPath = true;
        break;
      }
    }
    if (isPath) {
      skippedPaths++; // pot NI točka — iskren števec, ne uvoz
      continue;
    }
    order++;
    placemarks.push({ name, coords, order });
  }
  return { placemarks, skippedPaths };
}

// ── GPX (uradna shema: wpt lat/lon atributa + neobvezen <name>) ────────────

/** Atributa lat/lon wpt → [lat, lon] (manjkajoča/neveljavna → null). */
function parseGpxCoords(attrs: Record<string, string>): [number, number] | null {
  const lat = toNumber(attrs["lat"]);
  const lon = toNumber(attrs["lon"]);
  if (lat === null || lon === null) return null;
  if (!numInRange(lat, -90, 90) || !numInRange(lon, -180, 180)) return null;
  return [lat, lon];
}

function parseGpx(
  root: XmlNode
): { placemarks: ImportPlacemark[]; skippedPaths: number } {
  const placemarks: ImportPlacemark[] = [];
  let skippedPaths = 0;
  let order = 0;
  // Po shemi so wpt/rte/trk neposredni otroci <gpx> (določno, brez iskanja
  // po globini — rtept/trkpt znotraj rte/trk so točke POTI in se NE uvozijo).
  for (const child of root.children) {
    const t = tagOf(child);
    if (t === "wpt") {
      order++;
      placemarks.push({
        name: textChildOrNull(child, "name"),
        coords: parseGpxCoords(child.attrs),
        order,
      });
    } else if (t === "rte" || t === "trk") {
      skippedPaths++; // 1 pot = 1 števec (vzporedno s KML Placemark potjo)
    }
  }
  return { placemarks, skippedPaths };
}

// ── javni vstop: razčlenitev datoteke ──────────────────────────────────────

/**
 * Razčleni besedilo KML/GPX (avtodetekcija po korenskem elementu: kml/gpx).
 * ČISTA funkcija: isti vhod → isti izhod; 0 omrežja, 0 DOMParserja.
 * Napake so iskrene slovenske nize (error), nikoli tihe.
 */
export function parseImportFile(text: string): ImportParseResult {
  const empty: ImportParseResult = {
    format: null,
    placemarks: [],
    skippedPaths: 0,
    truncated: false,
    error: null,
  };
  if (typeof text !== "string" || text.length === 0) {
    return { ...empty, error: "Datoteka je prazna — nič za uvoz." };
  }
  if (text.length > IMPORT_MAX_CHARS) {
    return {
      ...empty,
      error: `Datoteka je prevelika (meja ${IMPORT_MAX_CHARS} znakov ≈ 2 MiB) — ne morem je varno razčleniti v brskalniku.`,
    };
  }
  const xml = parseXml(text);
  if (!xml.ok) {
    return { ...empty, error: `Datoteke ni bilo mogoče razčleniti: ${xml.error}` };
  }
  const rootTag = tagOf(xml.root);
  if (rootTag !== "kml" && rootTag !== "gpx") {
    return {
      ...empty,
      error: `Korenski element <${xml.root.name}> ni <kml> in ne <gpx> — ne poznam formata in ne ugibam. Podprta sta KML (Google My Maps) in GPX.`,
    };
  }
  const { placemarks, skippedPaths } =
    rootTag === "kml" ? parseKmlPlacemarks(xml.root) : parseGpx(xml.root);
  const truncated = placemarks.length > IMPORT_MAX_POINTS;
  return {
    format: rootTag,
    placemarks: truncated ? placemarks.slice(0, IMPORT_MAX_POINTS) : placemarks,
    skippedPaths,
    truncated,
    error: null,
  };
}

// ── ZRCALO KANONA DEST_NEEDLES (klientansko varno) ─────────────────────────
//
// Naslednja tabela + iskalnik sta ZRCALJENO kopijo kanona
// src/lib/start-anywhere/match.ts (DEST_NEEDLES + findDestinationMentions +
// stripDiacritics iz advisor/context). Zrcalo je NUJNO, ker vrednostni uvoz
// match.ts v brskalnik vleče advisor/context → sto/content → node:fs (živo
// dokazano: build klientske komponente pade), uvoz KML/GPX pa je po pogodbi
// 100 % klientanski. Enakost zrcala s kanonom ZAKLENEJO testi
// (tests/plan-import.test.ts): 1:1 enakost tabel + enakost obnašanja čez
// baterijo sklonov, diakritik in lažnih pozitivov — tiho odmikanje je tako
// nemogoče. Ko bo kanon osvobojen odvisnosti node:fs, se ta razdelek
// izbriše in uporabi neposreden uvoz iz match.ts.

/** Zrcaljena normalizacija (enaka advisor/context.stripDiacritics). */
function stripDiacriticsMirror(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

/**
 * ZRCALO tabele DEST_NEEDLES — 74 destinacij registra (38 + 36 balkanskih), red = vrstni red
 * registra (determinizem; prva zadeta igla velja). Vsebina MORA biti
 * bitno enaka kanonu (zaklenejo testi).
 */
export const DEST_NEEDLES_MIRROR: readonly DestNeedle[] = [
  { dest: "bled", stems: [["bled"]] },
  { dest: "bohinj", stems: [["bohinj"]] },
  { dest: "ljubljana", stems: [["ljubljan"]] },
  {
    dest: "postojnska-jama",
    stems: [["postojnsk", "jam"], ["postojn"]],
  },
  { dest: "piran", stems: [["piran"]] },
  // Soča: koren „soc“ je preveč generičen (socialni, soda) → izrecne oblike.
  {
    dest: "reka-soca",
    exact: ["soca", "soci", "soce", "soco"],
  },
  { dest: "triglav", stems: [["triglav"]] },
  // Kobarid: tudi italijansko ime Caporetto (virniki v IT jezikih).
  { dest: "kobarid", stems: [["kobarid"]], exact: ["caporetto"] },
  { dest: "maribor", stems: [["maribor"]] },
  { dest: "portoroz", stems: [["portoroz"]] },
  {
    dest: "vintgarska-soteska",
    stems: [["vintgarsk", "sotesk"]],
    exact: ["vintgar", "vintgarju", "vintgarja"],
  },
  { dest: "rogaska-slatina", stems: [["rogask", "slatin"]] },
  { dest: "ptuj", stems: [["ptuj"]] },
  { dest: "celje", stems: [["celj"]] },
  { dest: "nova-gorica", stems: [["nov", "goric"]] },
  { dest: "slovenj-gradec", stems: [["slovenj", "gradec"], ["slovenj", "gradc"]] },
  { dest: "dravograd", stems: [["dravograd"]] },
  { dest: "murska-sobota", stems: [["mursk", "sobot"]] },
  { dest: "lendava", stems: [["lendav"]] },
  // Novo mesto: „nov … mest“ bi lažno zadelo „nova mesta“ (generično) →
  // izrecne sklonjske oblike + pridevnik novomeški kot koren.
  {
    dest: "novo-mesto",
    stems: [["novomest"]],
    exact: [
      "novo mesto",
      "novega mesta",
      "novem mestu",
      "novemu mestu",
      "novim mestom",
    ],
  },
  { dest: "otocec", stems: [["otocec"]] },
  { dest: "crnomelj", stems: [["crnomelj"], ["crnomlj"]] },
  { dest: "zagreb", stems: [["zagreb"]] },
  // Plitvice: tudi samo „plitvičk*“ (Hrvaška dvojina/množina: Plitvicama).
  { dest: "plitvicka-jezera", stems: [["plitvic", "jezer"], ["plitvic"]] },
  { dest: "rijeka", stems: [["rijek"]] },
  // Pula: koren „pul“ (pulover!) → izrecne oblike.
  { dest: "pula", exact: ["pula", "puli", "pule", "pulo"] },
  { dest: "zadar", stems: [["zadar"], ["zadr"]] },
  { dest: "split", stems: [["split"]] },
  { dest: "hvar", stems: [["hvar"]] },
  { dest: "dubrovnik", stems: [["dubrovnik"]] },
  { dest: "kotor", stems: [["kotor"]] },
  { dest: "budva", stems: [["budv"]] },
  { dest: "podgorica", stems: [["podgoric"]] },
  { dest: "durmitor", stems: [["durmitor"]] },
  { dest: "tirana", stems: [["tiran"]] },
  { dest: "berat", stems: [["berat"]] },
  // Gjirokastër: SL „Gjirokaster“ in EN/IT „Gjirokastra“ — dva korena.
  { dest: "gjirokaster", stems: [["gjirokast"], ["gjirokastr"]] },
  { dest: "saranda", stems: [["sarand"]] },

  // ── Balkanska razširitev F1 (#41, 2.60.0) — 36 novih destinacij ────────
  // Bitno enaka razširitvi kanona DEST_NEEDLES (src/lib/start-anywhere/
  // match.ts); red = vrstni red registra (BA → RS → MK → XK → BG → GR).
  { dest: "sarajevo", stems: [["sarajev"]] },
  { dest: "mostar", stems: [["mostar"]] },
  { dest: "kravica", stems: [["kravic"]] },
  { dest: "jahorina", stems: [["jahorin"]] },
  { dest: "blagaj", exact: ["blagaj", "blagaja", "blagaju", "blagajem"] },
  {
    dest: "travnik",
    exact: ["travnik", "travnika", "travniku", "travnikom"],
  },
  { dest: "beograd", stems: [["beograd"]] },
  { dest: "novi-sad", stems: [["nov", "sad"]] },
  { dest: "kopaonik", stems: [["kopaonik"]] },
  { dest: "derdap", stems: [["derdap"], ["djerdap"]] },
  { dest: "sremski-karlovci", stems: [["sremski", "karlovc"]] },
  { dest: "subotica", stems: [["subotic"]] },
  { dest: "ohrid", stems: [["ohrid"]] },
  { dest: "skopje", stems: [["skopj"]] },
  { dest: "matka", stems: [["matka"]] },
  { dest: "bitola", stems: [["bitol"]] },
  {
    dest: "prespa",
    stems: [["prespansk"]],
    exact: ["prespa", "prespi", "prespah"],
  },
  { dest: "mavrovo", stems: [["mavrov"]] },
  { dest: "prizren", stems: [["prizren"]] },
  { dest: "rugova", stems: [["rugov"]] },
  {
    dest: "brezovica",
    exact: ["brezovica", "brezovice", "brezovico", "brezovici"],
  },
  { dest: "gjakova", stems: [["gjakov"], ["djakov"]] },
  { dest: "gadime", stems: [["gadime"]] },
  { dest: "prishtina", stems: [["pristina"], ["prishtina"]] },
  { dest: "sofija", stems: [["sofij"]] },
  { dest: "plovdiv", stems: [["plovdiv"]] },
  {
    dest: "rila-samostan",
    stems: [["rila", "samostan"], ["rilski", "samostan"], ["rila", "monaster"]],
    exact: ["rila", "rili", "rilo"],
  },
  { dest: "nesebar", stems: [["nesebar"], ["nessebar"]] },
  { dest: "bansko", exact: ["bansko", "bansku", "banskog", "banskem"] },
  { dest: "veliko-tarnovo", stems: [["veliko", "tarnov"], ["tarnov"]] },
  { dest: "solun", stems: [["solun"]] },
  { dest: "meteora", exact: ["meteora", "meteri", "metere", "meteoro"] },
  {
    dest: "kastoria",
    exact: ["kastoria", "kastorijo", "kastorije", "kastoriji"],
  },
  { dest: "vergina", stems: [["vergin"]] },
  { dest: "ioannina", stems: [["ioannin"]] },
  { dest: "halkidiki", stems: [["halkidik"], ["chalkidik"]] },
];

/**
 * ZRCALO iskalnika findDestinationMentions (start-anywhere/match): vse
 * destinacije registra, omenjene v besedilu — korenska zaporedja najprej,
 * nato izrecne oblike; ena destinacija = en zadetek; vrstni red = vrstni
 * red registra. Obnašanje MORA biti enako kanonu (zaklenejo testi).
 */
export function findDestinationMentionsMirror(text: string): DestinationMention[] {
  const nb = stripDiacriticsMirror(text);
  // besedilo → besede (ločila ob besedah se odstranijo: „v Vintgarju, s…“
  // → beseda „vintgarju“ — drugače izrecne oblike ob koncu stavka ne bi
  // zadeli) — enaka normalizacija kot kanon.
  const words = nb
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^[^a-z0-9]+/, "").replace(/[^a-z0-9]+$/, ""))
    .filter(Boolean);
  const padded = ` ${words.join(" ")} `;

  const out: DestinationMention[] = [];
  const seen = new Set<string>();

  for (const needle of DEST_NEEDLES_MIRROR) {
    const dest = DESTINATIONS.find((d) => d.slug === needle.dest) ?? null;
    if (!dest) continue; // pogodba: igla brez registra se preskoči (defenzivno)
    if (seen.has(needle.dest)) continue;

    // 1) korenska zaporedja: beseda[i].startsWith(koren[j]) za vse j.
    //    Prva zadeta zaporedje se šteje (dokaz); nadaljne igle iste
    //    destinacije se NE pregledujejo več (ena destinacija = en zadetek).
    if (needle.stems) {
      let found: DestinationMention | null = null;
      scan: for (const seq of needle.stems) {
        for (let i = 0; i + seq.length <= words.length; i++) {
          let ok = true;
          for (let j = 0; j < seq.length; j++) {
            if (!words[i + j].startsWith(seq[j])) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          found = {
            dest,
            needle: seq.join(" "),
            evidence: words.slice(i, i + seq.length).join(" "),
            kind: "stem",
          };
          break scan;
        }
      }
      if (found) {
        seen.add(needle.dest);
        out.push(found);
        continue;
      }
    }

    // 2) izrecne oblike: dobesedno zaporedje besed (obdano s presledki).
    if (needle.exact) {
      for (const phrase of needle.exact) {
        const p = ` ${phrase} `;
        if (padded.includes(p)) {
          seen.add(needle.dest);
          out.push({
            dest,
            needle: phrase,
            evidence: phrase,
            kind: "exact",
          });
          break;
        }
      }
    }
  }

  return out;
}

// ── javni vstop: ujemanje točk proti registru ──────────────────────────────

/** Zapiši kilometre v slovenski obliki (1,5) — deterministično. */
function fmtKm(km: number): string {
  return km.toFixed(1).replace(".", ",");
}

/**
 * Ujemi točke datoteke s kanonskim registrom 74 destinacij.
 * Vrstni red zadetkov = vrstni red točk v datoteki; dedup po slugu (drugi
 * zadetek na isti kraj se prešteje v duplicateCount — iskreno poročano).
 * Najprej IME (kanon DEST_NEEDLES — prvi zadetek, registarski vrstni red),
 * šele nato KOORDINATE (najbližja destinacija po roadKm, prag ≤ 2 km).
 * ČISTA funkcija: 0 omrežja, 0 AI, isti vhod → isti izhod.
 */
export function matchImportPlacemarks(
  placemarks: readonly ImportPlacemark[]
): ImportMatchResult {
  const matched: ImportMatch[] = [];
  const seenSlugs = new Set<string>();
  const unmatchedNames: string[] = [];
  let duplicateCount = 0;

  for (const p of placemarks) {
    let hit: ImportMatch | null = null;

    // 1) IME — zrcalo kanona DEST_NEEDLES (slovenski skloni, izrecne oblike;
    //    enakost zrcala s kanonom zaklenejo testi — glej POZOR zgoraj).
    const name = p.name !== null ? p.name.trim() : "";
    if (name.length > 0) {
      const mentions = findDestinationMentionsMirror(name);
      const first = mentions[0]; // prvi zadetek po registarskem vrstnem redu
      if (first) {
        hit = {
          slug: first.dest.slug,
          name: first.dest.name,
          type: first.dest.type,
          region: first.dest.region,
          evidence: first.evidence,
          needle: first.needle,
          kind: first.kind,
        };
      }
    }

    // 2) KOORDINATE — samo če ime ni zadelo (ime ima prednost).
    if (hit === null && p.coords !== null) {
      const point = { lat: p.coords[0], lng: p.coords[1] };
      let best: { dest: Destination; km: number } | null = null;
      for (const dest of DESTINATIONS) {
        const km = roadKm(point, dest.coords); // kanon projektne razdalje
        // strogo manjše zadržuje PRVO destinacijo registra ob izenačenju
        if (km <= COORD_MATCH_KM && (best === null || km < best.km)) {
          best = { dest, km };
        }
      }
      if (best !== null) {
        // roadKm je OCENA (premočrtne × 1,3) — dokaz to iskreno pove („≈").
        hit = {
          slug: best.dest.slug,
          name: best.dest.name,
          type: best.dest.type,
          region: best.dest.region,
          evidence: `≈ ${fmtKm(best.km)} km od ${best.dest.name}`,
          kind: "coords",
        };
      }
    }

    if (hit === null) {
      // neznana točka — pokaže se Z IMENOM (nikoli tiho izpuščena)
      unmatchedNames.push(name.length > 0 ? name : "(točka brez imena)");
      continue;
    }
    if (seenSlugs.has(hit.slug)) {
      duplicateCount++; // isti kraj že upoštevan — iskren števec
      continue;
    }
    seenSlugs.add(hit.slug);
    matched.push(hit);
  }

  return { matched, unmatchedNames, duplicateCount };
}

/**
 * Izpeljava predloga {interests, region} iz zadetkov uvoza — PONOVNA UPORABA
 * kanona start-anywhere/suggest (deriveSuggestion + TYPE_INTERESTS, 0 nove
 * logike). deriveSuggestion iz omemb bere le dest.type/dest.region; vrsta
 * ujemanja (stem/exact/coords) za izpeljavo ni relevantna — prikaz vedno
 * uporablja ImportMatch.kind, kjer koordinatni zadetki ostanejo „coords".
 */
export function deriveImportSuggestion(matches: readonly ImportMatch[]): Suggestion {
  const bySlug = new Map<string, Destination>(
    DESTINATIONS.map((d) => [d.slug, d] as const)
  );
  const mentions: DestinationMention[] = [];
  for (const m of matches) {
    const dest = bySlug.get(m.slug);
    if (!dest) continue; // pogodba: zadetki so vedno iz registra (defenzivno)
    mentions.push({
      dest,
      needle: m.needle ?? "koordinate",
      evidence: m.evidence,
      kind: m.kind === "coords" ? "exact" : m.kind,
    });
  }
  return deriveSuggestion(mentions, null);
}
