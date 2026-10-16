/**
 * MAP-CLUSTERING TESTI — enote čiste gručne logike (PR #62, odprava
 * prekrivanja dotikalnih ciljev: Bled ↔ Vintgarska soteska).
 *
 * INVARIANTA, ki jo testi zaklenejo:
 *  1. dve destinaciji sta v gruči ⇔ bi se 44-px cilja prekrivala;
 *  2. requiredSeparationZoom vrne NAJMANJŠO povečavo, pri kateri vsi pari
 *     merijo ≥ 44 px — klik gruče torej vedno loči člane;
 *  3. dotikalni cilji (44 px) se NIKOLI ne zmanjšajo — gručenje zmanjša
 *     število ciljev, ne njihove velikosti.
 *
 * Meritve so neodvisno izračunane iz Web Mercatorja (512-px svet) in
 * kanona DESTINATIONS (74 destinacij): najgostejši par piran ↔ portorož
 * se loči pri zoom ≈ 10,1, Bled ↔ Vintgarska soteska pri ≈ 9,2.
 */

import { describe, expect, test } from "bun:test";

import {
  groupOverlapping,
  lngLatToWorldPx,
  MIN_TOUCH_TARGET_PX,
  requiredSeparationZoom,
} from "../src/lib/map-clustering";
import { DESTINATIONS } from "../src/lib/slovenia-data";

/** Kanonski koordinati para iz pripombe lastnika (slovenia-data.ts). */
const BLED = { lng: 14.0944, lat: 46.3683 };
const VINTGAR = { lng: 14.1167, lat: 46.4 };

/** px razdalja med koordinatama pri danem zoomu (neodvisna meritev). */
function pxDistance(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
  zoom: number,
): number {
  const pa = lngLatToWorldPx(a, zoom);
  const pb = lngLatToWorldPx(b, zoom);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
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

  test("③ Bled ↔ Vintgar @ zoom 8: ~18,6 px (neodvisna meritev prekrivanja)", () => {
    expect(pxDistance(BLED, VINTGAR, 8)).toBeGreaterThan(18);
    expect(pxDistance(BLED, VINTGAR, 8)).toBeLessThan(19);
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

  test("⑥ meja: 43,9 px → isti skupini; 44,0 px → ločena (cilja se NE prekrivata)", () => {
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
});

describe("map-clustering [enote]: requiredSeparationZoom", () => {
  test("⑨ Bled ↔ Vintgar: ločitev pri ~9,2; pri njej cilja merita ≥ 44 px", () => {
    const z = requiredSeparationZoom([BLED, VINTGAR]);
    expect(z).toBeGreaterThan(9.0);
    expect(z).toBeLessThan(9.6);
    expect(pxDistance(BLED, VINTGAR, z)).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET_PX,
    );
    expect(pxDistance(BLED, VINTGAR, z - 1)).toBeLessThan(
      MIN_TOUCH_TARGET_PX,
    );
  });

  test("⑩ ena točka → 0; identični koordinati → maxZoom (eksplicitna mrtva točka)", () => {
    expect(requiredSeparationZoom([BLED])).toBe(0);
    expect(requiredSeparationZoom([BLED, BLED])).toBe(18);
  });

  test("⑪ INVARIANTA KANONA: najgostejši par 74 destinacij se loči ≤ zoom 10,2 ≪ maxZoom 18 → klik gruče VEDNO razpre skupino", () => {
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
    // piran ↔ portorož je najgostejši par (~10,1) — veliko manj od maxZoom:
    expect(max).toBeLessThanOrEqual(10.2);
  });

  test("⑫ privzeti pogled vseh 74 @ zoom 8: natanko 4 prekrivajoči pari se zlijejo v 4 gruče", () => {
    // Neodvisna meritev: piran↔portorož 10,1 px · bled↔vintgar 18,6 px ·
    // skopje↔matka 36,6 px · novi-sad↔sremski-karlovci 42,6 px (vsi < 44).
    const groups = groupOverlapping(
      DESTINATIONS.map((d) =>
        lngLatToWorldPx({ lng: d.coords.lng, lat: d.coords.lat }, 8),
      ),
    );
    const clusters = groups.filter((group) => group.length > 1);
    expect(clusters).toHaveLength(4);
    expect(clusters.flat()).toHaveLength(8); // vse gruče = pari po 2
  });
});
