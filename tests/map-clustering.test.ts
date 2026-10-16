/**
 * MAP-CLUSTERING TESTI — enote čiste gručne logike (PR #62, odprava
 * prekrivanja dotikalnih ciljev: Bled ↔ Vintgarska soteska + runda 3:
 * Soča ↔ Triglav, Slovenj Gradec ↔ Dravograd — kvadratna/osna invarianta).
 *
 * INVARIANTA, ki jo testi zaklenejo:
 *  1. dve destinaciji sta v gruči ⇔ bi se 44 × 44 px cilja prekrivala —
 *     OSNO (|dx| < 44 IN |dy| < 44), NE evklidsko: par z evklidsko
 *     razdaljo > 44 px se lahko še vedno prekriva (diagonala!);
 *  2. requiredSeparationZoom vrne NAJMANJŠO povečavo, pri kateri ima vsak
 *     par vsaj eno osno razliko ≥ 44 px — klik gruče torej vedno loči člane;
 *  3. dotikalni cilji (44 px) se NIKOLI ne zmanjšajo — gručenje zmanjša
 *     število ciljev, ne njihove velikosti.
 *
 * Meritve so neodvisno izračunane iz Web Mercatorja (512-px svet) in
 * kanona DESTINATIONS (74 destinacij). Pri zoom 8 se po oseh prekriva
 * 6 parov: bled↔vintgarska-soteska (8,1/16,7) · piran↔portoroz (9,0/4,7) ·
 * reka-soca↔triglav (41,1/18,3 — evklidsko 45,0!) · slovenj-gradec↔dravograd
 * (30,8/38,8 — evklidsko 49,5!) · novi-sad↔sremski-karlovci (33,0/27,0) ·
 * skopje↔matka (36,6/0,3). Najgostejši par piran ↔ portoroz se loči pri
 * zoom ≈ 10,3, Bled ↔ Vintgarska soteska pri ≈ 9,4.
 */

import { describe, expect, test } from "bun:test";

import {
  groupOverlapping,
  lngLatToWorldPx,
  MIN_TOUCH_TARGET_PX,
  requiredSeparationZoom,
  squaresOverlap,
} from "../src/lib/map-clustering";
import { DESTINATIONS } from "../src/lib/slovenia-data";

/** Kanonski koordinati parov iz pripomb lastnika (slovenia-data.ts). */
const BLED = { lng: 14.0944, lat: 46.3683 };
const VINTGAR = { lng: 14.1167, lat: 46.4 };
const SOCA = { lng: 13.7332, lat: 46.3447 }; // Reka Soča
const TRIGLAV = { lng: 13.8462, lat: 46.3794 };
const SLOVENJ_GRADEC = { lng: 15.0864, lat: 46.5131 };
const DRAVOGRAD = { lng: 15.0019, lat: 46.5864 };

/** px evklidska razdalja med koordinatama pri danem zoomu (neodvisna meritev). */
function pxDistance(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
  zoom: number,
): number {
  const pa = lngLatToWorldPx(a, zoom);
  const pb = lngLatToWorldPx(b, zoom);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

/** px osni razliki (|dx|, |dy|) med koordinatama pri danem zoomu —
 * odločilni meritev za kvadratne cilje. */
function pxAxes(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
  zoom: number,
): { dx: number; dy: number } {
  const pa = lngLatToWorldPx(a, zoom);
  const pb = lngLatToWorldPx(b, zoom);
  return { dx: Math.abs(pa.x - pb.x), dy: Math.abs(pa.y - pb.y) };
}

/** Največja osna razlika para pri danem zoomu (kvadratna semantika:
 * ločena ⇔ max(|dx|, |dy|) ≥ strana cilja). */
function maxAxis(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
  zoom: number,
): number {
  const axes = pxAxes(a, b, zoom);
  return Math.max(axes.dx, axes.dy);
}

describe("map-clustering [enote]: Web Mercator projekcija", () => {
  test("① (0, 0) pri zoom 0 = središče 512-px sveta", () => {
    expect(lngLatToWorldPx({ lng: 0, lat: 0 }, 0)).toEqual({ x: 256, y: 256 });
  });

  test("② razdalja se podvoji na +1 zoom (lastnost Mercatorja)", () => {
    for (const zoom of [5, 8, 11]) {
      const d1 = pxDistance(BLED, VINTGAR, zoom);
      const d2 = pxDistance(BLED, VINTGAR, zoom + 1);
      expect(d2 / d1).toBeCloseTo(2, 6);
    }
  });

  test("③ Bled ↔ Vintgar @ zoom 8: ~18,6 px evklidsko (meritev prekrivanja)", () => {
    expect(pxDistance(BLED, VINTGAR, 8)).toBeGreaterThan(18);
    expect(pxDistance(BLED, VINTGAR, 8)).toBeLessThan(19);
  });
});

describe("map-clustering [enote]: squaresOverlap (kvadratna semantika)", () => {
  test("③a isti osi na x: |dx| 43,9 → prekrivanje; 44 → brez (strogo manjše)", () => {
    expect(squaresOverlap(43.9, 0)).toBe(true);
    expect(squaresOverlap(44, 0)).toBe(false);
    expect(squaresOverlap(-43.9, 0)).toBe(true); // simetrija po znaku
  });

  test("③b DIAGONALA: |dx| = |dy| = 43 → prekrivanje, čeprav evklidsko 60,8 px", () => {
    // REGRESIJA runde 3: evklidski pogoj dx²+dy² < 44² tega para NE bi
    // gručil (60,8 > 44), 44-px kvadrata pa se fizično prekrivata.
    expect(squaresOverlap(43, 43)).toBe(true);
    expect(Math.hypot(43, 43)).toBeGreaterThan(MIN_TOUCH_TARGET_PX);
  });

  test("③c ena os loči: |dx| = 45, |dy| = 43 → brez prekrivanja", () => {
    // Vsaj ena os mora cilja ločiti — |dy| < 44 ne zadošča.
    expect(squaresOverlap(45, 43)).toBe(false);
    expect(squaresOverlap(43, 45)).toBe(false);
  });
});

describe("map-clustering [enote]: groupOverlapping", () => {
  test("④ prazen vhod in enojna točka", () => {
    expect(groupOverlapping([])).toEqual([]);
    expect(groupOverlapping([{ x: 0, y: 0 }])).toEqual([[{ x: 0, y: 0 }]]);
  });

  test("⑤ 30 px narazen → 1 gruča; 60 px narazen → posamezni cilji", () => {
    const near = groupOverlapping([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    ]);
    expect(near).toHaveLength(1);
    expect(near[0]).toHaveLength(2);
    const far = groupOverlapping([
      { x: 0, y: 0 },
      { x: 60, y: 0 },
    ]);
    expect(far).toHaveLength(2);
  });

  test("⑥ meja po osi: 43,9 px → isti skupini; 44,0 px → ločena (cilja se NE prekrivata)", () => {
    expect(
      groupOverlapping([
        { x: 0, y: 0 },
        { x: 43.9, y: 0 },
      ]),
    ).toHaveLength(1);
    expect(
      groupOverlapping([
        { x: 0, y: 0 },
        { x: 44, y: 0 },
      ]),
    ).toHaveLength(2);
  });

  test("⑦ veriga A–B–C (samo sosedje se prekrivajo) → ENA skupina treh", () => {
    const chain = groupOverlapping([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
    ]);
    expect(chain).toHaveLength(1);
    expect(chain[0]).toHaveLength(3);
  });

  test("⑧ Bled + Vintgar @ zoom 8 → 1 gruča; @ zoom 11 → posamezna cilja", () => {
    const groupsAt = (zoom: number) =>
      groupOverlapping(
        [BLED, VINTGAR].map((p) => lngLatToWorldPx(p, zoom)),
      );
    expect(groupsAt(8)).toHaveLength(1);
    expect(groupsAt(11)).toHaveLength(2);
  });

  test("⑧a Soča + Triglav @ zoom 8 → 1 gruča, čeprav evklidsko 45,0 px (runda 3)", () => {
    // REGRESIJA: evklidski pogoj para NE bi gručil (45,0 > 44), kvadrata
    // pa se po oseeh prekrivata (|dx| 41,1 < 44 IN |dy| 18,3 < 44).
    const axes = pxAxes(SOCA, TRIGLAV, 8);
    expect(axes.dx).toBeLessThan(44);
    expect(axes.dy).toBeLessThan(44);
    expect(pxDistance(SOCA, TRIGLAV, 8)).toBeGreaterThan(44); // evklidsko LOČENA po stari logiki
    expect(
      groupOverlapping([SOCA, TRIGLAV].map((p) => lngLatToWorldPx(p, 8))),
    ).toHaveLength(1);
    // Pri zoom 9 je vsaj ena os ≥ 44 — posamezna cilja:
    expect(
      groupOverlapping([SOCA, TRIGLAV].map((p) => lngLatToWorldPx(p, 9))),
    ).toHaveLength(2);
  });

  test("⑧b Slovenj Gradec + Dravograd @ zoom 8 → 1 gruča, čeprav evklidsko 49,5 px (runda 3)", () => {
    const axes = pxAxes(SLOVENJ_GRADEC, DRAVOGRAD, 8);
    expect(axes.dx).toBeLessThan(44);
    expect(axes.dy).toBeLessThan(44);
    expect(pxDistance(SLOVENJ_GRADEC, DRAVOGRAD, 8)).toBeGreaterThan(49);
    expect(
      groupOverlapping(
        [SLOVENJ_GRADEC, DRAVOGRAD].map((p) => lngLatToWorldPx(p, 8)),
      ),
    ).toHaveLength(1);
    expect(
      groupOverlapping(
        [SLOVENJ_GRADEC, DRAVOGRAD].map((p) => lngLatToWorldPx(p, 9)),
      ),
    ).toHaveLength(2);
  });
});

describe("map-clustering [enote]: requiredSeparationZoom", () => {
  test("⑨ Bled ↔ Vintgar: osna ločitev pri ~9,4; pri njej je vsaj ena os ≥ 44 px", () => {
    const z = requiredSeparationZoom([BLED, VINTGAR]);
    expect(z).toBeGreaterThan(9.0);
    expect(z).toBeLessThan(9.6);
    // TOČKA ločitve je OSNA: max(|dx|, |dy|) doseže 44 natančno pri z:
    expect(maxAxis(BLED, VINTGAR, z)).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET_PX,
    );
    expect(maxAxis(BLED, VINTGAR, z - 0.1)).toBeLessThan(MIN_TOUCH_TARGET_PX);
    expect(maxAxis(BLED, VINTGAR, z - 1)).toBeLessThan(MIN_TOUCH_TARGET_PX);
  });

  test("⑨a Soča ↔ Triglav: ločitev pri ~8,1 (dominanta os x 41,1 @ z8)", () => {
    const z = requiredSeparationZoom([SOCA, TRIGLAV]);
    expect(z).toBeGreaterThan(8.0);
    expect(z).toBeLessThan(8.3);
    expect(maxAxis(SOCA, TRIGLAV, z)).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET_PX,
    );
    expect(maxAxis(SOCA, TRIGLAV, z - 0.1)).toBeLessThan(MIN_TOUCH_TARGET_PX);
  });

  test("⑨b Slovenj Gradec ↔ Dravograd: ločitev pri ~8,2 (dominanta os y 38,8 @ z8)", () => {
    const z = requiredSeparationZoom([SLOVENJ_GRADEC, DRAVOGRAD]);
    expect(z).toBeGreaterThan(8.1);
    expect(z).toBeLessThan(8.4);
    expect(maxAxis(SLOVENJ_GRADEC, DRAVOGRAD, z)).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET_PX,
    );
    expect(maxAxis(SLOVENJ_GRADEC, DRAVOGRAD, z - 0.1)).toBeLessThan(
      MIN_TOUCH_TARGET_PX,
    );
  });

  test("⑩ ena točka → 0; identični koordinati → maxZoom (eksplicitna mrtva točka)", () => {
    expect(requiredSeparationZoom([BLED])).toBe(0);
    expect(requiredSeparationZoom([BLED, BLED])).toBe(18);
  });

  test("⑪ INVARIANTA KANONA: najgostejši par 74 destinacij se osno loči ≤ zoom 10,35 ≪ maxZoom 18 → klik gruče VEDNO razpre skupino", () => {
    let max = 0;
    for (let i = 0; i < DESTINATIONS.length; i++) {
      for (let j = i + 1; j < DESTINATIONS.length; j++) {
        max = Math.max(
          max,
          requiredSeparationZoom([
            {
              lng: DESTINATIONS[i].coords.lng,
              lat: DESTINATIONS[i].coords.lat,
            },
            {
              lng: DESTINATIONS[j].coords.lng,
              lat: DESTINATIONS[j].coords.lat,
            },
          ]),
        );
      }
    }
    // ne-trivialno: dataset res vsebuje goste pare (> 9):
    expect(max).toBeGreaterThan(9);
    // piran ↔ portorož je najgostejši par (osno ~10,3) — veliko manj od maxZoom:
    expect(max).toBeLessThanOrEqual(10.35);
  });

  test("⑫ privzeti pogled vseh 74 @ zoom 8: natanko 6 prekrivajočih parov (kvadratno), vse gruče = pari po 2", () => {
    // Neodvisna meritev (osno): bled↔vintgar 8,1/16,7 · piran↔portorož
    // 9,0/4,7 · soca↔triglav 41,1/18,3 (evklidsko 45,0!) · slovenj-gradec↔
    // dravograd 30,8/38,8 (evklidsko 49,5!) · novi-sad↔sremski-karlovci
    // 33,0/27,0 · skopje↔matka 36,6/0,3 — vsi |dx| < 44 IN |dy| < 44.
    const groups = groupOverlapping(
      DESTINATIONS.map((d) => ({
        slug: d.slug,
        ...lngLatToWorldPx({ lng: d.coords.lng, lat: d.coords.lat }, 8),
      })),
    );
    const clusters = groups.filter((group) => group.length > 1);
    expect(clusters).toHaveLength(6);
    expect(clusters.flat()).toHaveLength(12); // vse gruče = pari po 2 (brez verig)
    // Oba para lastnika sta med gručami (runda 3):
    const clani = new Set(clusters.flat().map((p) => p.slug));
    expect(clani.has("reka-soca") && clani.has("triglav")).toBe(true);
    expect(clani.has("slovenj-gradec") && clani.has("dravograd")).toBe(true);
  });
});
