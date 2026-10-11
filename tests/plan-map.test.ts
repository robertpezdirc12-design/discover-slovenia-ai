import { describe, expect, test } from "bun:test";

import { buildItinerary } from "@/lib/itinerary-engine";
import {
  DAY_COLORS,
  planMapData,
  planMapLines,
  type DayGeometry,
} from "@/lib/plan-map-data";
import type { TripStop } from "@/lib/types";

/**
 * POLIR2 B (2.29.0) — zemljevid ob načrtu (PlanMap): čisti podatkovni
 * modul plan-map-data + source-contract komponente plan-map.
 * POLIR3 A (2.30.0) — VOZLJIVA POT: logika polne/črtkane črte (planMapLines
 * na čistem izhodu planMapData + simuliran odgovor proxyja) + source-contract
 * ENEGA samega omrežnega klica komponente (fetch SAMO na relativni
 * /api/plan/directions — zunanji URL-ji prepovedani).
 *
 * Kanon (enak kot tests/nacrtuj-polir.test.ts):
 *  - planMapData: ČISTA funkcija — vrstni red markerjev po dneh/postankih,
 *    dayLines samo za dneve z ≥ 2 točkama, iskren števec izpuščenih,
 *    determinizem 10×, prazni dnevi, nemutabilnost vhoda;
 *  - source-contract na plan-map.tsx (komponenta se NE importira — uvoz
 *    leaflet modula zahteva window; zaklenimo strukturo izvorne kode);
 *  - i18n: vsi novi L10N ključi ×6 popolni (VSE opombe pod zemljevidom
 *    so preverjene dobesedno po jezikih — premočrtna, vozljiva, izpuščeni);
 *  - round-trip čistost: planMapData(BuildItinerary izhoda) — motor
 *    vedno daje coords, zato je števec izpuščenih 0 in markerji pokrijejo
 *    vse postanke (preverjeno na 3 načrtih);
 *  - 0 omrežja: ta baterija ne uporablja fetch-a (mock proxyja živi šele
 *    v tests/plan-directions.test.ts).
 */

const COMPONENT = "src/components/plan/plan-map.tsx";

async function componentSrc(): Promise<string> {
  return Bun.file(COMPONENT).text();
}

const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;

/** Pomožni konstruktor postanka (čim manjša ponovljiva vadnica). */
function stop(
  partial: Partial<TripStop> & { id: string; name: string }
): TripStop {
  return {
    time: null,
    durationMin: 60,
    cost: 0,
    kind: "custom",
    ...partial,
  };
}

/** Fiksni 4-dnevni načrt z vsemi robnimi primeri (preskočen postanek,
 *  prazen dan, dan z 1 točko, dan z 3 točkami). */
const DAYS: TripStop[][] = [
  [
    stop({
      id: "a1",
      name: "Bled",
      time: "09:00",
      coords: { lat: 46.36, lng: 14.11 },
    }),
    stop({
      id: "a2",
      name: "Bohinj",
      time: "13:00",
      coords: { lat: 46.29, lng: 13.84 },
    }),
    stop({ id: "a3", name: "Brez koordinat", time: "17:00" }), // brez coords
  ],
  [], // prazen dan (iskreno ostane brez markerjev)
  [
    stop({
      id: "c1",
      name: "Piran",
      coords: { lat: 45.53, lng: 13.57 },
    }),
  ],
  [
    stop({
      id: "d1",
      name: "Maribor",
      time: "10:00",
      coords: { lat: 46.56, lng: 15.65 },
    }),
    stop({
      id: "d2",
      name: "Ptuj",
      time: "14:00",
      coords: { lat: 46.42, lng: 15.87 },
    }),
    stop({
      id: "d3",
      name: "Celje",
      time: null,
      coords: { lat: 46.24, lng: 15.27 },
    }),
  ],
];

// ── planMapData: čista izpeljava ───────────────────────────────────────────

describe("PLAN-MAP-DATA — čista izpeljava", () => {
  test("① markerji: vsi postanki s coords, po vrstnem redu dni in postankov", () => {
    const data = planMapData(DAYS);
    expect(data.markers.map((m) => m.id)).toEqual([
      "a1",
      "a2",
      "c1",
      "d1",
      "d2",
      "d3",
    ]);
    // dayIdx sledi indeksom dni vhoda (prazni dan ohrani luknjo v 1)
    expect(data.markers.map((m) => m.dayIdx)).toEqual([0, 0, 2, 3, 3, 3]);
    // orderInDay: gosta zaporedja PRIKAZANIH postankov znotraj dneva
    expect(data.markers.map((m) => m.orderInDay)).toEqual([0, 1, 0, 0, 1, 2]);
    // time se prenese (null ostane null — iskrenostni kanon)
    expect(data.markers.map((m) => m.time)).toEqual([
      "09:00",
      "13:00",
      null,
      "10:00",
      "14:00",
      null,
    ]);
    // ime + koordinati se preneseta
    expect(data.markers[0].name).toBe("Bled");
    expect(data.markers[0].coords).toEqual({ lat: 46.36, lng: 14.11 });
  });

  test("② dayLines: samo dnevi z ≥ 2 točkama, points v vrstnem redu", () => {
    const data = planMapData(DAYS);
    expect(data.dayLines.map((l) => l.dayIdx)).toEqual([0, 3]);
    expect(data.dayLines[0].points).toEqual([
      { lat: 46.36, lng: 14.11 },
      { lat: 46.29, lng: 13.84 },
    ]);
    expect(data.dayLines[1].points.map((p) => p.lat)).toEqual([
      46.56, 46.42, 46.24,
    ]);
  });

  test("③ skippedNoCoords: iskren števec postankov brez coords", () => {
    expect(planMapData(DAYS).skippedNoCoords).toBe(1);
    // več izpuščenih po dneveh se sešteje
    const two = [
      [stop({ id: "x1", name: "A" }), stop({ id: "x2", name: "B" })],
      [stop({ id: "x3", name: "C" })],
    ];
    expect(planMapData(two).skippedNoCoords).toBe(3);
  });

  test("④ determinizem: isti vhod → isti izhod (10×)", () => {
    const first = JSON.stringify(planMapData(DAYS));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(planMapData(DAYS))).toBe(first);
    }
  });

  test("⑤ prazen načrt in prazni dnevi (iskreno prazno stanje)", () => {
    expect(planMapData([])).toEqual({
      markers: [],
      dayLines: [],
      skippedNoCoords: 0,
    });
    expect(planMapData([[], [], []])).toEqual({
      markers: [],
      dayLines: [],
      skippedNoCoords: 0,
    });
  });

  test("⑥ nemutabilnost vhoda (globoka primerjava pred/po klicu)", () => {
    const snapshot = JSON.stringify(DAYS);
    planMapData(DAYS);
    expect(JSON.stringify(DAYS)).toBe(snapshot);
  });

  test("⑦ izhod ne deli objektov z vhodom (mutacija izhoda ne dotakne vhoda)", () => {
    const data = planMapData(DAYS);
    data.markers[0].coords.lat = 0;
    data.markers[0].name = "spremenjeno";
    expect(DAYS[0][0].coords?.lat).toBe(46.36);
    expect(DAYS[0][0].name).toBe("Bled");
  });
});

// ── DAY_COLORS: paleta 8 dni ───────────────────────────────────────────────

describe("DAY_COLORS — paleta 8 dni (brez modro-indigo družine)", () => {
  test("⑧ 8 barv, vse unikatne, vse hex #rrggbb", () => {
    expect(DAY_COLORS.length).toBe(8);
    expect(new Set(DAY_COLORS).size).toBe(8);
    for (const c of DAY_COLORS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test("⑨ NOBENA barva ni iz prepovedane modro-indigo množice", () => {
    // Izrecen seznam (naloga + Tailwind blue/sky/indigo 600–900): tema
    // aplikacije je modro-indigo — barve dni so PODATKOVNA vizualizacija
    // in morajo biti ločene od nje.
    const FORBIDDEN = [
      "#0369a1", // sky-700 (iz naloge)
      "#2563eb", // blue-600 (iz naloge)
      "#4f46e5", // indigo-600 (iz naloge)
      "#4338ca", // indigo-700 (iz naloge)
      "#6366f1", // indigo-500 (iz naloge)
      "#3730a3", // indigo-800 (iz naloge)
      "#1d4ed8", // blue-700
      "#1e40af", // blue-800
      "#1e3a8a", // blue-900
      "#0284c7", // sky-600
      "#075985", // sky-800
      "#0c4a6e", // sky-900
      "#312e81", // indigo-900
      "#4c1d95", // violet-900 (indigo-vijolični rob)
    ];
    for (const f of FORBIDDEN) {
      expect(DAY_COLORS).not.toContain(f);
    }
  });
});

// ── source-contract komponente (branje izvorne kode, 0 importov) ──────────

describe("PLAN-MAP — source-contract komponente", () => {
  test("⑩ struktura: use client, OSM ploščice + atribucija, črtkane in POLNE črte, export", async () => {
    const src = await componentSrc();
    expect(src).toContain('"use client"');
    expect(src).toContain("tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(src).toContain("https://www.openstreetmap.org/copyright");
    expect(src).toContain("OpenStreetMap</a>");
    // črtkana premočrtna povezava (iskrenost: ne vozljiva pot)
    expect(src).toContain('dashArray: "6 8"');
    // POLNA črta iz dejanske OSRM geometry (POLIR3 A)
    expect(src).toContain("weight: 4");
    expect(src).toContain("opacity: 0.9");
    expect(src).toContain("export function PlanMap");
    // i18n kanon + sinhronizacija seznam ↔ zemljevid
    expect(src).toContain("useLocale");
    expect(src).toContain("onMarkerClick");
    expect(src).toContain("highlightId");
    // tooltip po DOM kanonu (XSS)
    expect(src).toContain("document.createElement");
    // usklajeno s travel-map: scrollWheelZoom + fitBounds + center
    expect(src).toContain("scrollWheelZoom");
    expect(src).toContain("fitBounds");
    expect(src).toContain("padding: [24, 24]");
    expect(src).toContain("[46.15, 14.99]");
    // Leaflet css + divIcon brez slikovnih ikon (bundler past)
    expect(src).toContain('import "leaflet/dist/leaflet.css"');
    expect(src).toContain("L.divIcon");
  });

  test("⑪ varnost: NI innerHTML; fetch SAMO na relativni /api/plan/directions (0 zunanjih URL-jev)", async () => {
    const src = await componentSrc();
    expect(src).not.toContain("innerHTML");
    // POLIR3 A: edini omrežni klic komponente = lastni strežniški proxy
    // (RELATIVNA pot — kanon vremenskega proxyja)
    expect(src).toContain('fetch("/api/plan/directions"');
    expect(src).toContain('method: "POST"');
    // ZATRDNA PREPOVED: nobena vrstica s fetch( ne sme kazati zunaj —
    // OSRM kliče IZKLJUČNO strežniški proxy, komponenta nikoli neposredno
    const fetchLines = src.split("\n").filter((ln) => ln.includes("fetch("));
    expect(fetchLines.length).toBeGreaterThan(0);
    for (const ln of fetchLines) {
      expect(ln).toContain('"/api/plan/directions"');
    }
    expect(src).not.toContain("router.project-osrm.org");
    expect(src).not.toContain('fetch("http');
    // stanje poti VEZANO NA REFERENCO dni (kanon predogleda 2.29.0 — brez
    // setState v efektu) + zastareli odgovori se ignorirajo
    expect(src).toContain("forDays");
    expect(src).toContain("cancelled = true");
    // nalaganje ne blokira: dan z vrzeljo (postanek brez coords) se NE
    // pošlje — ostane črtkan (iskrenost, dokumentirano v dayCoords)
    expect(src).toContain("if (!s.coords) return null;");
  });

  test("⑫ tooltip gradimo izključno prek textContent; html divIcona je samo statična številka", async () => {
    const src = await componentSrc();
    // med DOM ustvarjanjem in vezavo tooltipa SMEMO samo textContent
    const domStart = src.indexOf("document.createElement");
    expect(domStart).toBeGreaterThan(-1);
    const domBlock = src.slice(domStart, src.indexOf("bindTooltip", domStart));
    expect(domBlock).toContain("textContent");
    // html divIcona ne sme vsebovati imena postanka (uporabniški vnos)
    const htmlStart = src.indexOf("html:");
    expect(htmlStart).toBeGreaterThan(-1);
    const htmlBlock = src.slice(htmlStart, src.indexOf("iconSize", htmlStart));
    expect(htmlBlock).not.toContain(".name");
    expect(htmlBlock).toContain("${dayIdx + 1}"); // samo statična številka
  });
});

// ── i18n: vsi novi ključi ×6 popolni ──────────────────────────────────────

describe("PLAN-MAP — i18n: vsi novi ključi imajo 6 jezikov", () => {
  const NEW_L10N_KEYS = [
    "mapLabel",
    "straightNote",
    "routedNote",
    "skippedNote",
    "dayLabel",
    "noTime",
  ] as const;

  test("⑬ L10N slovar: vsak novi ključ ima sl+en+it+de+fr+es", async () => {
    const src = await componentSrc();
    for (const key of NEW_L10N_KEYS) {
      const start = src.indexOf(`${key}: {`);
      expect(start).toBeGreaterThan(-1);
      const block = src.slice(start, src.indexOf("\n  },", start));
      for (const lang of LANGS) {
        expect(block).toContain(`${lang}:`);
      }
    }
  });

  test("⑭ opomba pod zemljevidom ×6 (premočrtne povezave + vir OSM)", async () => {
    const src = await componentSrc();
    // sl je dobeseden kanon; ostali jeziki po značilnem delčku prevoda
    expect(src).toContain(
      "Povezave so premočrtne (ne vozljiva pot) · Podatki: OpenStreetMap"
    );
    for (const fragment of [
      "not a drivable route", // en
      "non un percorso percorribile", // it
      "keine befahrbare Route", // de
      "pas un itinéraire routable", // fr
      "no una ruta transitable", // es
    ]) {
      expect(src).toContain(fragment);
    }
  });

  test("⑲ opomba o VOZLJIVI poti ×6 (POLIR3 A: OSRM/OpenStreetMap + urnik ostaja ocena)", async () => {
    const src = await componentSrc();
    // sl je dobeseden kanon (niz iz specifikacije POLIR3 A)
    expect(src).toContain(
      "Vozljiva pot (OSRM/OpenStreetMap); urnik načrta ostaja ocena."
    );
    for (const fragment of [
      "Drivable route (OSRM/OpenStreetMap)", // en
      "Percorso percorribile (OSRM/OpenStreetMap)", // it
      "Befahrbare Route (OSRM/OpenStreetMap)", // de
      "Itinéraire routable (OSRM/OpenStreetMap)", // fr
      "Ruta transitable (OSRM/OpenStreetMap)", // es
      // urnik OSTAJA OCENA — iskrenost v vseh jezikih
      "urnik načrta ostaja ocena", // sl
      "the plan's schedule remains an estimate", // en
      "orario del piano resta una stima", // it
      "Zeitplan des Plans bleibt eine Schätzung", // de
      "horaire du plan reste une estimation", // fr
      "horario del plan sigue siendo una estimación", // es
    ]) {
      expect(src).toContain(fragment);
    }
    // opombe se prikazujeta po pogojih planMapLines.notes (mešano = OBE)
    expect(src).toContain("lineState.notes.routed");
    expect(src).toContain("lineState.notes.straight");
  });

  test("⑮ opomba o izpuščenih postankih ×6 (množina prek funkcije (n)=>niz)", async () => {
    const src = await componentSrc();
    for (const fragment of [
      "brez znanih koordinat ni prikazan", // sl
      "without known coordinates", // en
      "senza coordinate note", // it
      "ohne bekannte Koordinaten", // de
      "sans coordonnées connues", // fr
      "sin coordenadas conocidas", // es
    ]) {
      expect(src).toContain(fragment);
    }
  });

  test("⑯ tooltip dneva ×6 (Dan/Day/Giorno/Tag/Jour/Día + »brez ure«)", async () => {
    const src = await componentSrc();
    for (const [day, noTime] of [
      ["Dan ${n}", "brez ure"],
      ["Day ${n}", "no time"],
      ["Giorno ${n}", "senza orario"],
      ["Tag ${n}", "ohne Uhrzeit"],
      ["Jour ${n}", "sans horaire"],
      ["Día ${n}", "sin hora"],
    ] as const) {
      expect(src).toContain(day);
      expect(src).toContain(`"${noTime}"`);
    }
  });
});

// ── round-trip čistost: planMapData(BuildItinerary izhoda) ────────────────

describe("PLAN-MAP — round-trip z motorjem (buildItinerary)", () => {
  const QUERIES: ReadonlyArray<{
    interests: string[];
    days: number;
    region?: string;
  }> = [
    { interests: ["jezero", "mesto"], days: 3, region: "gorenjska" },
    { interests: ["smučanje", "gora"], days: 5 },
    { interests: ["vino"], days: 2, region: "stajerska" },
  ];

  test("⑰ motor vedno da coords: markerji pokrijejo VSE postanke, 0 izpuščenih", () => {
    for (const q of QUERIES) {
      const plan = buildItinerary({ ...q, locale: "sl" });
      const all = plan.days.flat();
      expect(all.length).toBeGreaterThan(0);
      for (const s of all) {
        expect(s.coords).toBeDefined(); // predpostavka: motor daje coords
      }
      const data = planMapData(plan.days);
      expect(data.markers.length).toBe(all.length);
      expect(data.skippedNoCoords).toBe(0);
      // povezave: točno dnevi z ≥ 2 postankoma (vsi imajo coords)
      expect(data.dayLines.length).toBe(
        plan.days.filter((d) => d.length >= 2).length
      );
    }
  });

  test("⑱ markerji so 1:1 z načrtom (isti vrstni red id-jev, gosta zaporedja po dneh)", () => {
    for (const q of QUERIES) {
      const plan = buildItinerary({ ...q, locale: "sl" });
      const data = planMapData(plan.days);
      // isti vrstni red id-jev kot načrt (dnevi in postanki po vrsti)
      expect(data.markers.map((m) => m.id)).toEqual(
        plan.days.flat().map((s) => s.id)
      );
      // orderInDay: gosto 0..k-1 znotraj vsakega dneva
      for (let d = 0; d < plan.days.length; d++) {
        const inDay = data.markers.filter((m) => m.dayIdx === d);
        expect(inDay.map((m) => m.orderInDay)).toEqual(
          inDay.map((_, i) => i)
        );
      }
    }
  });
});

// ── POLIR3 A: logika POLNE/ČRTKANE črte (planMapLines + simuliran odgovor) ──
//
// Čista logika iz plan-map-data.ts na ČISTEM izhodu planMapData(DAYS) +
// simuliran odgovor proxyja /api/plan/directions (brez Leafleta — komponenta
// ni uvožena). ISKRENOST: polna črta IZKLJUČNO iz dejanske geometry.

describe("PLAN-MAP — POLIR3 A: polna/črtkana logika (planMapLines + simuliran odgovor)", () => {
  /** Simuliran odgovor proxyja za DAN 0 (Bled→Bohinj): geometry [lat, lon]. */
  const ROUTE_DAY0: [number, number][] = [
    [46.3701, 14.0958],
    [46.3802, 14.107],
    [46.2833, 13.8833],
  ];
  /** Simuliran odgovor za DAN 3 (Maribor→Ptuj→Celje). */
  const ROUTE_DAY3: [number, number][] = [
    [46.56, 15.65],
    [46.42, 15.87],
    [46.24, 15.27],
  ];

  test("⑳ brez odgovora (nalaganje/napaka/proxy padel): VSE črte ČRTKANE, samo opomba premočrtne", () => {
    const data = planMapData(DAYS);
    const st = planMapLines(data, {});
    expect(st.lines.map((l) => l.solid)).toEqual([false, false]);
    expect(st.notes).toEqual({ routed: false, straight: true });
    // točke črtkane črte = premočrtne točke postankov (iz planMapData)
    expect(st.lines[0].points).toEqual([
      [46.36, 14.11],
      [46.29, 13.84],
    ]);
    expect(st.lines[1].points).toEqual([
      [46.56, 15.65],
      [46.42, 15.87],
      [46.24, 15.27],
    ]);
  });

  test("㉑ vsi dnevi usmerjeni: VSE črte POLNE iz geometry, SAMO opomba vozljiva", () => {
    const data = planMapData(DAYS);
    const st = planMapLines(data, { 0: ROUTE_DAY0, 3: ROUTE_DAY3 });
    expect(st.lines.map((l) => l.solid)).toEqual([true, true]);
    expect(st.notes).toEqual({ routed: true, straight: false });
    // polna črta = DEJANSKA OSRM geometry ([lat, lon]), ne premočrtne točke
    expect(st.lines[0].points).toEqual(ROUTE_DAY0);
    expect(st.lines[1].points).toEqual(ROUTE_DAY3);
  });

  test("㉒ mešano (dan 0 usmerjen, dan 3 padel/črta manjka): OBE opombi, polna + črtkana", () => {
    const data = planMapData(DAYS);
    const st = planMapLines(data, { 0: ROUTE_DAY0 });
    expect(st.lines[0].solid).toBe(true); // polna iz geometry
    expect(st.lines[1].solid).toBe(false); // črtkana premočrtna
    expect(st.notes).toEqual({ routed: true, straight: true });
  });

  test("㉓ dan z manjkajočo koordinato sredinskega postanka OSTANE črtkan (iskrenost)", () => {
    // Dan [A(coords), B(brez coords), C(coords)]: planMapData nariše črto
    // [A, C], a dan NI upravičen do usmerjanja (vrzel) — odjemalec ga ne
    // pošlje, zato odgovora za njega ni in črta ostane črtkana.
    const days: TripStop[][] = [
      [
        stop({ id: "m1", name: "A", coords: { lat: 46.36, lng: 14.11 } }),
        stop({ id: "m2", name: "Brez koordinat" }),
        stop({ id: "m3", name: "C", coords: { lat: 46.29, lng: 13.84 } }),
      ],
    ];
    const st = planMapLines(planMapData(days), {});
    expect(st.lines.length).toBe(1); // premočrtna črta [A, C] obstaja
    expect(st.lines[0].solid).toBe(false); // a OSTANE črtkana (iskrenost)
    expect(st.lines[0].points).toEqual([
      [46.36, 14.11],
      [46.29, 13.84],
    ]);
    expect(st.notes).toEqual({ routed: false, straight: true });
  });

  test("㉔ obrambna: geometry z < 2 točkama se NE šteje za vozljivo pot", () => {
    const data = planMapData(DAYS);
    const st = planMapLines(data, { 0: [[46.36, 14.11]] });
    expect(st.lines[0].solid).toBe(false);
    expect(st.notes.routed).toBe(false);
  });

  test("㉕ čistost: izhod ne deli tabel z vhodom (mutacija izhoda ne dotakne geometry)", () => {
    const geometry: [number, number][] = [
      [46.36, 14.11],
      [46.29, 13.84],
    ];
    const data = planMapData(DAYS);
    const st = planMapLines(data, { 0: geometry });
    expect(st.lines[0].solid).toBe(true);
    st.lines[0].points[0][0] = 0; // mutacija izhoda
    expect(geometry[0][0]).toBe(46.36); // vhod nedotaknjen
  });

  test("㉖ determinizem: isti vhod → isti izhod (10×)", () => {
    const data = planMapData(DAYS);
    const routed: Record<number, DayGeometry> = { 0: ROUTE_DAY0 };
    const first = JSON.stringify(planMapLines(data, routed));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(planMapLines(data, routed))).toBe(first);
    }
  });
});

