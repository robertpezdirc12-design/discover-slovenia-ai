import { describe, expect, test } from "bun:test";

import { buildItinerary, travelMinutes } from "@/lib/itinerary-engine";
import {
  isSameOrder,
  moveStop,
  recomputeDayTimes,
  recomputeDayTitle,
} from "@/lib/plan-reorder";
import type { TripStop } from "@/lib/types";

/**
 * POLIR2 A (2.29.0) — /nacrtuj: POVLECI-IN-SPUSTI urejanje dni (Wanderlog).
 *
 * Kanon (enak kot tests/nacrtuj-polir.test.ts):
 *  - ČISTE FUNKCIJE iz src/lib/plan-reorder.ts (0 omrežja, 0 fetch stubov);
 *  - IDEMPOTENTNOSTNA ZAKLEP: recomputeDayTimes na NEPREUREJENEM dnevu iz
 *    buildItinerary vrne IDENTIČNE čase kot motor (isti kanon urnika);
 *  - SOURCE-CONTRACT na view.tsx (UI komponente se NE importajo, zaklenemo
 *    strukturo izvorne kode — vključno z besedili vseh 6 jezikov);
 *  - i18n popolnost ×6 vseh novih ključev L.
 *
 * ID-ji postankov se po premikih OHRANIJO (npr. „dest--d0s0“ v dnevu 2):
 * id je unikatni React/dnd-kit ključ, NE pozicijska resnica (raziskava
 * 2026-10-12) — to zaklepajo testa ② in ⑦.
 */

const VIEW = "src/app/[locale]/nacrtuj/view.tsx";

async function viewSrc(): Promise<string> {
  return Bun.file(VIEW).text();
}

const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;
type Lang = (typeof LANGS)[number];

// ── fixtures: ročni dnevi (nadzor nad coords/regijami) ─────────────────────

/** Postanek fixture: coords/regija/durationMin po meri, ostalo kanonsko. */
function stop(id: string, opts: Partial<TripStop> = {}): TripStop {
  return {
    id,
    name: id.toUpperCase(),
    time: "09:00",
    durationMin: 60,
    cost: 5,
    kind: "city",
    ...opts,
  };
}

const C_BLED = { lat: 46.3683, lng: 14.0944 };
const C_LJ = { lat: 46.0569, lng: 14.5058 };
const C_PI = { lat: 45.5472, lng: 13.7303 };

const A = stop("dest--d0s0", { region: "gorenjska", coords: C_BLED, durationMin: 90 });
const B = stop("dest--d0s1", { region: "gorenjska", coords: C_LJ, durationMin: 60 });
const C = stop("dest--d1s0", { region: "primorska", coords: C_PI, durationMin: 120 });
const D = stop("dest--d1s1", { region: "gorenjska", coords: C_BLED, durationMin: 45 });

const TWO_DAYS: TripStop[][] = [
  [A, B],
  [C, D],
];

// ── engine poizvedbe za idempotentnostni zaklep (2–3 različne) ─────────────

const ENGINE_QUERIES: ReadonlyArray<{
  interests: string[];
  days: number;
  region?: string;
}> = [
  { interests: ["družina", "jezero"], days: 2, region: "gorenjska" },
  { interests: ["smučanje", "gora"], days: 5 },
  { interests: ["vino"], days: 3, region: "stajerska" },
];

// ── moveStop ───────────────────────────────────────────────────────────────

describe("POLIR2 A — moveStop (nemutabilni kanonični premik)", () => {
  test("① premik znotraj dneva (zamenjava vrstnega reda)", () => {
    const out = moveStop(TWO_DAYS, B.id, 0, 0);
    expect(out[0].map((s) => s.id)).toEqual([B.id, A.id]);
    expect(out[1].map((s) => s.id)).toEqual([C.id, D.id]); // drug dan nedotaknjen
  });

  test("② premik med dnevi — id-ji se OHRANIJO (stabilni ključi)", () => {
    const out = moveStop(TWO_DAYS, A.id, 1, 1);
    // A pristane med C in D; id ostaja „dest--d0s0“ kljub novemu dnevu —
    // id je unikatni ključ, ne pozicijska resnica.
    expect(out[0].map((s) => s.id)).toEqual([B.id]);
    expect(out[1].map((s) => s.id)).toEqual([C.id, A.id, D.id]);
    const moved = out[1].find((s) => s.id === A.id)!;
    expect(moved).toBe(A); // ISTA referenca objekta (nemutabilnost)
  });

  test("③ premik v PRAZEN dan (vstavljanje na indeks 0)", () => {
    const withEmpty: TripStop[][] = [[A, B], [C, D], []];
    const out = moveStop(withEmpty, B.id, 2, 0);
    expect(out[2].map((s) => s.id)).toEqual([B.id]);
    expect(out[0].map((s) => s.id)).toEqual([A.id]);
  });

  test("④ clamp: toIndex čez konec → konec dneva; toDay ven → rob", () => {
    const out = moveStop(TWO_DAYS, A.id, 1, 99);
    expect(out[1].map((s) => s.id)).toEqual([C.id, D.id, A.id]); // konec dneva 1
    // negativen dan → clamp na dan 0 (C se preseli z dneva 1 na začetek dneva 0):
    const negDay = moveStop(TWO_DAYS, C.id, -5, 0);
    expect(negDay[0].map((s) => s.id)).toEqual([C.id, A.id, B.id]);
    expect(negDay[1].map((s) => s.id)).toEqual([D.id]);
    // dan čez konec → clamp na ZADNJI dan (indeks 0 → začetek zadnjega dneva):
    const bigDay = moveStop(TWO_DAYS, A.id, 99, 0);
    expect(bigDay[bigDay.length - 1].map((s) => s.id)).toEqual([
      A.id,
      C.id,
      D.id,
    ]);
    const negIdx = moveStop(TWO_DAYS, A.id, 0, -3);
    expect(negIdx[0].map((s) => s.id)).toEqual([A.id, B.id]); // clamp na mesto 0
  });

  test("⑤ neobstoječ id → vrne ISTO referenco (===)", () => {
    const out = moveStop(TWO_DAYS, "neobstojec--id", 1, 0);
    expect(out).toBe(TWO_DAYS); // ista referenca, ne kopija
  });

  test("⑥ nemutabilnost vhoda (deep equal pred/po; objekti ostanejo isti)", () => {
    const before = JSON.parse(JSON.stringify(TWO_DAYS));
    const out = moveStop(TWO_DAYS, C.id, 0, 1);
    expect(JSON.parse(JSON.stringify(TWO_DAYS))).toEqual(before); // vhod nedotaknjen
    expect(out).not.toBe(TWO_DAYS);
    expect(out[0]).not.toBe(TWO_DAYS[0]);
    // objekti postankov se delijo (plitva kopija tabel, isti objekti):
    expect(out[0][0]).toBe(A);
    // vhod NI bil spremenjen s strani izhoda:
    expect(TWO_DAYS[1].map((s) => s.id)).toEqual([C.id, D.id]);
    expect(out[0].map((s) => s.id)).toEqual([A.id, C.id, B.id]);
  });

  test("⑦ determinizem 10× (isti vhod → isti izhod)", () => {
    const first = JSON.stringify(moveStop(TWO_DAYS, A.id, 1, 1));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(moveStop(TWO_DAYS, A.id, 1, 1))).toBe(first);
    }
    // zaporedni premiki (veriga) so prav tako deterministični:
    const chain = moveStop(moveStop(TWO_DAYS, A.id, 1, 1), D.id, 0, 0);
    for (let i = 0; i < 10; i++) {
      const again = moveStop(moveStop(TWO_DAYS, A.id, 1, 1), D.id, 0, 0);
      expect(JSON.stringify(again)).toBe(JSON.stringify(chain));
    }
  });
});

// ── recomputeDayTimes ─────────────────────────────────────────────────────

describe("POLIR2 A — recomputeDayTimes (kanon urnika motora)", () => {
  test("⑧ ZAKLEP idempotentnosti: NEPREUREJEN dan iz buildItinerary → IDENTIČNI časi (3 poizvedbe)", () => {
    for (const q of ENGINE_QUERIES) {
      const plan = buildItinerary({ ...q, locale: "sl" });
      expect(plan.days.length).toBeGreaterThanOrEqual(1);
      for (let d = 0; d < plan.days.length; d++) {
        const day = plan.days[d];
        expect(day.length).toBeGreaterThan(0);
        const rec = recomputeDayTimes(day);
        expect(rec.length).toBe(day.length);
        for (let i = 0; i < day.length; i++) {
          // časi so bajtno enaki motorjevim (idempotentnost kanona):
          expect(rec[i].time).toBe(day[i].time);
          // vse ostalo se ohrani (spread — isti id/trajanje/cena/coords):
          expect(rec[i].id).toBe(day[i].id);
          expect(rec[i].durationMin).toBe(day[i].durationMin);
          expect(rec[i].cost).toBe(day[i].cost);
          expect(rec[i].coords).toBe(day[i].coords);
        }
      }
    }
  });

  test("⑨ brez coords → time = null od tega postanka naprej (iskrena „ura ni znana“)", () => {
    const noCoords: TripStop[] = [
      stop("n0", { coords: C_BLED, durationMin: 60 }),
      stop("n1", { durationMin: 60 }), // BREZ coords
      stop("n2", { coords: C_LJ, durationMin: 60 }), // coords se vrne, a ura ostane neznana
      stop("n3", { coords: C_LJ, durationMin: 60 }),
    ];
    const rec = recomputeDayTimes(noCoords);
    expect(rec[0].time).toBe("09:00"); // prvi vedno 09:00
    expect(rec[1].time).toBeNull();
    expect(rec[2].time).toBeNull(); // od neznanke naprej — nikoli izmišljeno
    expect(rec[3].time).toBeNull();
    // prvi postanek brez coords (a ne prvi v dnevu) → sledi null od tam naprej:
    const first: TripStop[] = [
      stop("n0", { coords: C_BLED, durationMin: 60 }),
      stop("n1", { coords: C_BLED, durationMin: 60 }),
    ];
    expect(recomputeDayTimes(first).map((s) => s.time)).toEqual(["09:00", "10:00"]);
    // manjkajoči coords na PREJŠNJEM postanku je že dovolj:
    const second: TripStop[] = [
      stop("n0", { durationMin: 60 }), // BREZ coords
      stop("n1", { coords: C_BLED, durationMin: 60 }),
    ];
    expect(recomputeDayTimes(second).map((s) => s.time)).toEqual(["09:00", null]);
  });

  test("⑩ PREUREJEN dan: časi po kanonu motorja (09:00 + trajanja + travelMinutes)", () => {
    const plan = buildItinerary({
      interests: ["družina", "jezero"],
      days: 2,
      region: "gorenjska",
      locale: "sl",
    });
    const day = plan.days[0];
    expect(day.length).toBeGreaterThanOrEqual(2);
    // obrnemo dan (ročna preureditev) — časi se morajo preračunati po ISTEM
    // kanonu kot motor: t=540; i>0 → t += travelMinutes(prev, cur); po vsakem
    // postanku t += durationMin.
    const reversed = recomputeDayTimes([...day].reverse());
    expect(reversed[0].time).toBe("09:00"); // prvi postanek vedno 09:00
    let t = 540 + reversed[0].durationMin;
    for (let i = 1; i < reversed.length; i++) {
      t += travelMinutes(reversed[i - 1].coords!, reversed[i].coords!);
      expect(reversed[i].time).toBe(
        `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
      );
      t += reversed[i].durationMin;
    }
    // preračun je prav tako determinističen (10×):
    const first = JSON.stringify(reversed);
    for (let k = 0; k < 10; k++) {
      expect(JSON.stringify(recomputeDayTimes([...day].reverse()))).toBe(first);
    }
  });
});

// ── recomputeDayTitle ─────────────────────────────────────────────────────

describe("POLIR2 A — recomputeDayTitle („Dan N · regije“)", () => {
  test("⑪ ×6 jezikov z regijami (unikatne, po vrstnem redu pojavljanja)", () => {
    const gorenjskaPrimorska: TripStop[] = [A, C, D]; // gorenjska, primorska, gorenjska
    // oznake regij so IZ REGISTRA (regionLabel kanon: sl imena, tujim jezikom
    // eksonimi — Upper Carniola, Litorale, Oberkrain, …):
    expect(recomputeDayTitle(1, gorenjskaPrimorska, "sl")).toBe("Dan 2 · Gorenjska, Primorska");
    expect(recomputeDayTitle(1, gorenjskaPrimorska, "en")).toBe("Day 2 · Upper Carniola, Littoral");
    expect(recomputeDayTitle(1, gorenjskaPrimorska, "it")).toBe("Giorno 2 · Alta Carniola, Litorale");
    expect(recomputeDayTitle(1, gorenjskaPrimorska, "de")).toBe("Tag 2 · Oberkrain, Küstenland");
    expect(recomputeDayTitle(1, gorenjskaPrimorska, "fr")).toBe("Jour 2 · Haute-Carniole, Littoral");
    expect(recomputeDayTitle(1, gorenjskaPrimorska, "es")).toBe("Día 2 · Alta Carniola, Litoral");
  });

  test("⑫ brez regij → samo „Dan N“ (×6)", () => {
    const none: TripStop[] = [stop("x"), stop("y")]; // brez region
    for (const lang of LANGS) {
      const word = { sl: "Dan", en: "Day", it: "Giorno", de: "Tag", fr: "Jour", es: "Día" }[lang];
      expect(recomputeDayTitle(2, none, lang)).toBe(`${word} 3`);
    }
    expect(recomputeDayTitle(0, [], "sl")).toBe("Dan 1"); // prazen dan
  });

  test("⑬ dedup regij — vrstni red pojavljanja, brez ponovitev", () => {
    const mixed: TripStop[] = [
      stop("p1", { region: "primorska" }),
      stop("p2", { region: "gorenjska" }),
      stop("p3", { region: "primorska" }),
      stop("p4", { region: "gorenjska" }),
    ];
    expect(recomputeDayTitle(0, mixed, "sl")).toBe("Dan 1 · Primorska, Gorenjska");
    // regija brez zapisa v REGIONS ostane surova (regionLabel kanon) — nikoli izpust:
    const odd = [stop("p1", { region: "iz-milja" })];
    expect(recomputeDayTitle(0, odd, "sl")).toBe("Dan 1 · iz-milja");
  });
});

// ── isSameOrder ───────────────────────────────────────────────────────────

describe("POLIR2 A — isSameOrder (raven zaporedji id-jev + meje dni)", () => {
  test("⑭ true: ista struktura (sprememba časov ≠ sprememba vrstnega reda)", () => {
    expect(isSameOrder(TWO_DAYS, TWO_DAYS)).toBe(true);
    // recomputeDayTimes (nove ure) ne spremini vrstnega reda:
    const recomputed = TWO_DAYS.map((d) => recomputeDayTimes(d));
    expect(isSameOrder(TWO_DAYS, recomputed)).toBe(true);
  });

  test("⑮ false: zamenjava znotraj dneva / premik med dnevi / prenos meje", () => {
    const swapped: TripStop[][] = [[B, A], [C, D]];
    expect(isSameOrder(TWO_DAYS, swapped)).toBe(false);
    const moved: TripStop[][] = [[B], [C, D, A]];
    expect(isSameOrder(TWO_DAYS, moved)).toBe(false);
    // KLJUČNO: premik čez mejo dneva ([[A],[B]] → [[],[A,B]]) ima ENAKO
    // ravno zaporedje, a DRUGAČNO strukturo — ne sme veljati za isto:
    const before: TripStop[][] = [[A], [B]];
    const across: TripStop[][] = [[], [A, B]];
    expect(isSameOrder(before, across)).toBe(false);
    // izpraznitev dneva se prav tako šteje za spremembo:
    const emptied: TripStop[][] = [[A, B, C, D], []];
    expect(isSameOrder(TWO_DAYS, emptied)).toBe(false);
  });
});

// ── source-contract na view.tsx (DnD struktura) ───────────────────────────

describe("POLIR2 A [source-contract]: dnd-kit struktura v view.tsx", () => {
  test("⑯ jedro dnd-kit: kontekst, sensorji, strategija, ročica, cona", async () => {
    const src = await viewSrc();
    expect(src).toContain("<DndContext");
    expect(src).toContain("<SortableContext");
    expect(src).toContain("verticalListSortingStrategy");
    expect(src).toContain("KeyboardSensor");
    expect(src).toContain("sortableKeyboardCoordinates");
    expect(src).toContain("PointerSensor");
    expect(src).toContain("useSortable(");
    expect(src).toContain("useDroppable(");
    expect(src).toContain("GripVertical");
    expect(src).toContain("closestCorners");
    expect(src).toContain('activationConstraint: { distance: 8 }');
    expect(src).toContain('id: `day-${dayIdx}`'); // cona praznega dneva
    expect(src).toContain("min-h-16"); // cona: dovolj visoka za dotik
    expect(src).toContain("border-dashed"); // cona: črtkana obroba
    // BREZ <DragOverlay> (preprosto domače premikanje — po specifikaciji;
    // omemba v komentarju je dovoljena, uporaba komponente pa ne):
    expect(src).not.toContain("<DragOverlay");
  });

  test("⑰ ročica je EDINI aktivator: listeners/attributes samo na njej + print:hidden", async () => {
    const src = await viewSrc();
    const start = src.indexOf("function SortableStopRow");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("function EmptyDayDropZone", start);
    const block = src.slice(start, end);
    // standardni dnd-kit pristop: transform/transition na wrapper <li>
    expect(block).toContain("setNodeRef");
    expect(block).toContain("CSS.Translate.toString(transform)");
    // ročica: gumb z aria-label ×6 vzorca, touch-none (dnd-kit zahteva) in
    // cursor-grab/grabing; print:hidden — v natisu ročic ni.
    expect(block).toContain('aria-label={`${pick(l, L.dragHandle)}: ${stop.name}`}');
    expect(block).toContain("{...attributes}");
    expect(block).toContain("{...listeners}");
    expect(block).toContain("touch-none");
    expect(block).toContain("cursor-grab");
    expect(block).toContain("cursor-grabbing");
    expect(block).toContain("print:hidden");
    // listeners so SAMO na ročici — StopRow klic ne nosi listenerjev:
    expect(block).toContain("<StopRow stop={stop} lang={lang} />");
  });

  test("⑱ aria-live naznanilo + tipkovnična navodila (sr-only)", async () => {
    const src = await viewSrc();
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain("{announcement ?? \"\"}");
    // tipkovnična navodila so del vsakega načrta (sr-only):
    expect(src).toContain("{pick(l, L.dragKeyboardHint)}");
    // naznanilo po vzorcu „{ime} premaknjen na {dan}, mesto {m}“ (vseh 6):
    const a = src.indexOf("movedAnnouncement: {");
    expect(a).toBeGreaterThan(-1);
    // zadnji ključ L — blok zajamemo do zaključka slovarja (}, v sami
    // predlogi „${day},“ bi lažno poklical konec):
    const ablock = src.slice(a, src.indexOf("\n} as const;", a));
    for (const lang of LANGS) {
      expect(ablock).toContain(`${lang}:`);
    }
    expect(ablock).toContain("premaknjen na");
  });
});

// ── i18n popolnost (×6) vseh novih ključev + živi nizi ────────────────────

describe("POLIR2 A — i18n: vsi novi ključi imajo 6 jezikov", () => {
  const NEW_L_KEYS = [
    "manualBadge",
    "manualNote",
    "resetOrder",
    "resetOrderAria",
    "dragHandle",
    "dropHere",
    "dragKeyboardHint",
    "movedAnnouncement",
  ] as const;

  test("⑲ L slovar: vsak nov ključ ima sl+en+it+de+fr+es", async () => {
    const src = await viewSrc();
    for (const key of NEW_L_KEYS) {
      const start = src.indexOf(`${key}: {`);
      expect(start).toBeGreaterThan(-1);
      // „},“ se pojavi tudi znotraj predlog movedAnnouncement (${day}, …) —
      // zato blok zajamemo do naslednjega ključa oz. zaključka slovarja:
      const rest = src.slice(start);
      const nextKey = NEW_L_KEYS.find(
        (k) => rest.indexOf(`${k}: {`, key.length + 2) !== -1
      );
      const endConst = rest.indexOf("\n} as const;");
      const end = nextKey
        ? start + rest.indexOf(`${nextKey}: {`, key.length + 2)
        : start + endConst;
      const block = src.slice(start, end);
      for (const lang of LANGS) {
        expect(block).toContain(`${lang}:`);
      }
    }
  });

  test("⑳ značka „Ročno preurejeno“ + mikrovrstica + gumb + cona: dobesedno ×6", async () => {
    const src = await viewSrc();
    // značka (iskrenost — vidna tudi v natisu, torej BREZ print:hidden):
    for (const t of [
      'sl: "Ročno preurejeno"',
      'en: "Manually reordered"',
      'it: "Riordinato manualmente"',
      'de: "Manuell umgeordnet"',
      'fr: "Réordonné manuellement"',
      'es: "Reordenado manualmente"',
    ]) {
      expect(src).toContain(t);
    }
    // mikrovrstica (razlaga preračuna časov):
    expect(src).toContain("Vrstni red si preuredil sam; časi so preračunani (začetek 09:00 + trajanja + ocenjene vožnje).");
    expect(src).toContain("You reordered the plan yourself; times are recalculated (09:00 start + durations + estimated drives).");
    expect(src).toContain("Hai riordinato il piano tu; gli orari sono ricalcolati (inizio 09:00 + durate + tragitti stimati).");
    expect(src).toContain("Du hast die Reihenfolge selbst umgeordnet; die Zeiten werden neu berechnet (Start 09:00 + Dauern + geschätzte Fahrten).");
    expect(src).toContain("Tu as réordonné le plan toi-même ; les horaires sont recalculés (début 09:00 + durées + trajets estimés).");
    expect(src).toContain("Reordenaste el plan tú mismo; los horarios se recalculan (inicio 09:00 + duraciones + trayectos estimados).");
    // gumb „Povrni vrstni red motorja“ ×6 (ghost + Undo2 + aria-label):
    for (const t of [
      'sl: "Povrni vrstni red motorja"',
      'en: "Restore the engine order"',
      'it: "Ripristina l\'ordine del motore"',
      'de: "Motor-Reihenfolge wiederherstellen"',
      'fr: "Restaurer l\'ordre du moteur"',
      'es: "Restaurar el orden del motor"',
    ]) {
      expect(src).toContain(t);
    }
    expect(src).toContain("<Undo2");
    // prazno-dnevna cona „Spusti postanek sem“ ×6:
    for (const t of [
      'sl: "Spusti postanek sem"',
      'en: "Drop a stop here"',
      'it: "Trascina qui una tappa"',
      'de: "Stopp hier ablegen"',
      'fr: "Dépose une étape ici"',
      'es: "Suelta una parada aquí"',
    ]) {
      expect(src).toContain(t);
    }
    // tipkovnična navodila ×6 (prvi stavek vsakega jezika):
    expect(src).toContain("Vlečenje deluje tudi s tipkovnico: fokusiraj ročico, preslednica dvigne, puščice premikajo, preslednica spusti.");
    expect(src).toContain("Dragging also works with the keyboard: focus the handle, Space lifts, arrow keys move, Space drops.");
    expect(src).toContain("Anche il trascinamento funziona con la tastiera: metti a fuoco la maniglia, Spazio solleva, le frecce spostano, Spazio rilascia.");
    expect(src).toContain("Das Ziehen funktioniert auch mit der Tastatur: Griff fokussieren, Leertaste hebt an, Pfeiltasten bewegen, Leertaste legt ab.");
    expect(src).toContain("Le glisser fonctionne aussi au clavier : focalise la poignée, Espace soulève, les flèches déplacent, Espace dépose.");
    expect(src).toContain("Arrastrar también funciona con el teclado: enfoca el tirador, Espacio levanta, las flechas mueven, Espacio suelta.");
    // aria-label ročice ×6 („Povleci za preurejanje“ + prevodi):
    for (const t of [
      'sl: "Povleci za preurejanje"',
      'en: "Drag to reorder"',
      'it: "Trascina per riordinare"',
      'de: "Zum Umsortieren ziehen"',
      'fr: "Glisser pour réordonner"',
      'es: "Arrastra para reordenar"',
    ]) {
      expect(src).toContain(t);
    }
  });

  test("㉑ značka/mikrovrstica/gumb so POGOJENI z manualOrder + reset čisti zastavico", async () => {
    const src = await viewSrc();
    // značka, mikrovrstica in gumb obstajajo SAMO pod {manualOrder && …}:
    expect(src).toContain("{manualOrder && (");
    // PlannerApp: nov setPlan izstreše zastavico (en sam čist kanon):
    expect(src).toContain("setEnginePlan(nov)");
    expect(src).toContain("setManualOrder(false)");
    expect(src).toContain("setManualOrder(true)"); // po uspešnem reorderju
    // reset gumb pokliče onResetOrder → handleResetOrder (enginePlan):
    expect(src).toContain("onClick={onResetOrder}");
    expect(src).toContain("setPlan(enginePlan)");
    // saveLastPlan po reorderju in po resetu (PDF/Go Mode/oblak bereta isti vir):
    expect(src.indexOf("saveLastPlan(nov)")).toBeGreaterThan(-1);
    expect(src.indexOf("saveLastPlan(enginePlan)")).toBeGreaterThan(-1);
    // onDragEnd uporablja isSameOrder (spust brez spremembe → brez zastavice):
    expect(src).toContain("if (isSameOrder(plan.days, days)) return;");
    expect(src).toContain("if (isSameOrder(plan.days, newDays)) return;");
    // handleReorder preračuna vse dni + naslove po recomputeDayTitle:
    expect(src).toContain("recomputeDayTimes(stops)");
    expect(src).toContain("recomputeDayTitle(i, stops, lang)");
  });
});
