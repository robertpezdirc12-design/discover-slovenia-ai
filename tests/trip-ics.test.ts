/**
 * TRIP-ICS (P0-G, issue #1 §17) — determinističen .ics izvoz v koledar.
 *
 * Zaklene kanone:
 *  - RFC 5545: CRLF končnice, escape besedila (\ ; , + prelomi),
 *    prelom vrstic na 75 OKTETOV (šumniki so večbajtni!), DTEND
 *    celodnevnega dogodka EKSKLUZIVEN (dan + 1);
 *  - CELODNEVNI dogodki (VALUE=DATE) — DST-varni po zasnovi: preklop
 *    25. 10. 2026 (CEST→CET) ne spremeni datuma;
 *  - DETERMINIZEM: isti vhod (vključno s fiksnim `now`) → identičen izhod;
 *  - FAIL-CLOSED: katerikoli neveljaven podatek → null (nikoli izmišljen
 *    datuma, nikoli praznega koledarja).
 */

import { describe, expect, test } from "bun:test";

import {
  buildTripIcs,
  escapeIcsText,
  foldIcsLine,
} from "../src/lib/trip-ics";

const NOW = new Date("2026-10-08T09:30:00.000Z");

function twoDayInput() {
  return {
    title: "Jadranska avantura",
    dateStart: "2026-10-24",
    dateEnd: "2026-10-25",
    uidKey: "abc123",
    url: "https://app.example/pot/abc123",
    now: NOW,
    days: [
      { date: "2026-10-24", summary: "Dan 1 — Bled → Vintgar" },
      { date: "2026-10-25", summary: "Dan 2 — Piran" },
    ],
  };
}

// ── escapeIcsText (RFC 5545 §3.3.11) ─────────────────────────────────────

describe("trip-ics: escapeIcsText", () => {
  test("podpičje, vejica in nazlevaja poševnica se uidejata", () => {
    expect(escapeIcsText("a;b,c\\d")).toBe("a\\;b\\,c\\\\d");
  });

  test("prelomi vrstic (vse tri oblike) → dobesedni \\n", () => {
    expect(escapeIcsText("vrstica1\nvrstica2")).toBe("vrstica1\\nvrstica2");
    expect(escapeIcsText("vrstica1\r\nvrstica2")).toBe("vrstica1\\nvrstica2");
    expect(escapeIcsText("vrstica1\rvrstica2")).toBe("vrstica1\\nvrstica2");
  });

  test("navadno besedilo (šumniki!) ostane nedotaknjeno", () => {
    expect(escapeIcsText("Češnjev drevored v Šenčurju")).toBe(
      "Češnjev drevored v Šenčurju",
    );
  });
});

// ── foldIcsLine (RFC 5545 §3.1 — 75 OKTETOV) ─────────────────────────────

describe("trip-ics: foldIcsLine", () => {
  test("kratka vrstica ostane ena vrstica (brez CRLF)", () => {
    expect(foldIcsLine("DTSTART;VALUE=DATE:20261024")).toBe(
      "DTSTART;VALUE=DATE:20261024",
    );
  });

  test("dolga vrstica: vsak del ≤ 75 oktetov, nadaljevanja z uvodnim presledkom", () => {
    const long = `SUMMARY:${"ž".repeat(80)}`; // ž = 2 bajta → 160 oktetov vsebine
    const folded = foldIcsLine(long);
    const parts = folded.split("\r\n ");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    // Sestavljen nazaj je identičen originalu.
    expect(folded.replaceAll("\r\n ", "")).toBe(long);
  });

  test("mejni primer točno 75 oktetov se NE prelomi", () => {
    const exact = "a".repeat(75);
    expect(foldIcsLine(exact)).toBe(exact);
  });
});

// ── buildTripIcs — struktura ─────────────────────────────────────────────

describe("trip-ics: buildTripIcs — struktura koledarja", () => {
  const ics = buildTripIcs(twoDayInput())!;

  test("glava in noga VCALENDAR po RFC (CRLF končnice povsod)", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("CALSCALE:GREGORIAN\r\n");
    expect(ics).toContain("METHOD:PUBLISH\r\n");
    // Nikoli samotni LF (samo CRLF velja).
    expect(ics.replaceAll("\r\n", "")).not.toContain("\n");
  });

  test("en VEVENT na dan — celodnevni (VALUE=DATE), DTEND ekskluziven", () => {
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261024");
    expect(ics).toContain("DTEND;VALUE=DATE:20261025"); // dan 1 + 1
    expect(ics).toContain("DTSTART;VALUE=DATE:20261025");
    expect(ics).toContain("DTEND;VALUE=DATE:20261026"); // zadnji dan + 1
  });

  test("UID determinističen po poti in dnevu; DTSTAMP iz fiksnega now", () => {
    expect(ics).toContain("UID:dsa-trip-abc123-20261024@discover-slovenia-ai");
    expect(ics).toContain("UID:dsa-trip-abc123-20261025@discover-slovenia-ai");
    expect(ics).toContain("DTSTAMP:20261008T093000Z");
  });

  test("SUMMARY nosi povzetek dneva; DESCRIPTION ime poti + URL", () => {
    expect(ics).toContain("SUMMARY:Dan 1 — Bled → Vintgar");
    expect(ics).toContain("DESCRIPTION:Jadranska avantura — https://app.example/pot/abc123");
  });

  test("DETERMINIZEM: isti vhod → bajtno-iden izhod", () => {
    const again = buildTripIcs(twoDayInput())!;
    expect(again).toBe(ics);
  });

  test("DST-varnost: dnevi čez preklop 25. 10. 2026 (CEST→CET) ostanejo neprorediženi", () => {
    const dst = buildTripIcs({
      title: "Preklop",
      dateStart: "2026-10-24",
      dateEnd: "2026-10-26",
      uidKey: "dst1",
      now: NOW,
      days: [
        { date: "2026-10-24", summary: "Pred preklopom" },
        { date: "2026-10-25", summary: "Dan preklopa" },
        { date: "2026-10-26", summary: "Po preklopu" },
      ],
    })!;
    expect(dst).toContain("DTSTART;VALUE=DATE:20261025");
    expect(dst).toContain("DTSTART;VALUE=DATE:20261026");
    expect(dst.match(/BEGIN:VEVENT/g)?.length).toBe(3);
  });
});

// ── buildTripIcs — fail-closed ───────────────────────────────────────────

describe("trip-ics: buildTripIcs — fail-closed (null, nikoli izmišljeno)", () => {
  const base = twoDayInput();

  test("brez naslova / brez uidKey → null", () => {
    expect(buildTripIcs({ ...base, title: "  " })).toBeNull();
    expect(buildTripIcs({ ...base, uidKey: "" })).toBeNull();
  });

  test("neveljavni datumi (ne-ISO, start > end, > 30 dni) → null", () => {
    expect(buildTripIcs({ ...base, dateStart: "24.10.2026" })).toBeNull();
    expect(buildTripIcs({ ...base, dateStart: "2026-10-25", dateEnd: "2026-10-24" })).toBeNull();
    expect(
      buildTripIcs({ ...base, dateStart: "2026-10-01", dateEnd: "2026-12-01" }),
    ).toBeNull();
  });

  test("prazen seznam dni / dan izven razpona / prazen povzetek → null", () => {
    expect(buildTripIcs({ ...base, days: [] })).toBeNull();
    expect(
      buildTripIcs({
        ...base,
        days: [{ date: "2026-11-01", summary: "Izven razpona" }],
      }),
    ).toBeNull();
    expect(
      buildTripIcs({ ...base, days: [{ date: "2026-10-24", summary: "   " }] }),
    ).toBeNull();
  });
});
