/**
 * JOURNEY BOOKING — kanonska življenjska cikel rezervacij (51-c):
 *  - nabor statusov (točno 14, začetni/terminalni),
 *  - matrika prehodov ALLOWED_TRANSITIONS (absorpcijski EXTERNAL, retry
 *    FAILED, import pot DRAFT, samo-veriga MODIFIED, terminalni brez
 *    povratkov),
 *  - validator atestacij validateConfirmationRecord (iskrenost izvora:
 *    klient ne more ponarediti „CONFIRMED" brez številke + cene; USER/
 *    IMPORTED samo DRAFT/CONFIRMED; provider polja nosi samo pošten izvor),
 *  - atestacijski JSON v stolpcu `note` (build/parse/noteTextOf).
 */

import { describe, expect, test } from "bun:test";

import {
  ALLOWED_TRANSITIONS,
  BOOKING_SOURCES,
  CONFIRMATION_STATUSES,
  INITIAL_CONFIRMATION_STATUSES,
  TERMINAL_STATUSES,
  assertTransition,
  buildAttestationNote,
  canTransition,
  isInitial,
  isTerminal,
  noteTextOf,
  parseAttestationNote,
  statusLabel,
  validateConfirmationRecord,
} from "../src/lib/journey/booking";

// ─── Nabor statusov ─────────────────────────────────────────────────────────

describe("journey-booking: nabor statusov (14, izvorni types.ts:83-97 + DRAFT)", () => {
  test("točno 14 statusov, poimensko kanonski", () => {
    expect(CONFIRMATION_STATUSES.length).toBe(14);
    expect([...CONFIRMATION_STATUSES]).toEqual([
      "DRAFT",
      "SELECTED",
      "BOOKING_REQUESTED",
      "PENDING",
      "PAYMENT_REQUIRED",
      "PAID",
      "CONFIRMED",
      "MODIFIED",
      "REFUNDED",
      "EXPIRED",
      "FAILED",
      "CANCELLED",
      "UNKNOWN",
      "EXTERNAL",
    ]);
  });

  test("INITIAL_CONFIRMATION_STATUSES = 4 začetni statusi (izvirnik route:258)", () => {
    expect([...INITIAL_CONFIRMATION_STATUSES]).toEqual([
      "SELECTED",
      "EXTERNAL",
      "BOOKING_REQUESTED",
      "DRAFT",
    ]);
    for (const s of INITIAL_CONFIRMATION_STATUSES) {
      expect(CONFIRMATION_STATUSES).toContain(s);
    }
  });

  test("terminalni nabor = { REFUNDED, EXPIRED, CANCELLED }", () => {
    expect([...TERMINAL_STATUSES]).toEqual(["REFUNDED", "EXPIRED", "CANCELLED"]);
    for (const s of TERMINAL_STATUSES) {
      expect(CONFIRMATION_STATUSES).toContain(s);
    }
  });

  test("matrika prehodov pokriva VSEH 14 statusov (brez lukenj)", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).length).toBe(14);
    for (const s of CONFIRMATION_STATUSES) {
      expect(ALLOWED_TRANSITIONS[s]).toBeDefined();
    }
  });

  test("BOOKING_SOURCES = [USER, IMPORTED, PROVIDER] (issue #4 §4 val 3)", () => {
    expect([...BOOKING_SOURCES]).toEqual(["USER", "IMPORTED", "PROVIDER"]);
  });
});

// ─── isInitial / isTerminal ─────────────────────────────────────────────────

describe("journey-booking: isInitial / isTerminal (robni primeri)", () => {
  test("isInitial: true samo za 4 začetne statuse", () => {
    expect(isInitial("SELECTED")).toBe(true);
    expect(isInitial("EXTERNAL")).toBe(true);
    expect(isInitial("BOOKING_REQUESTED")).toBe(true);
    expect(isInitial("DRAFT")).toBe(true);
  });

  test("isInitial: false za vse ostale (vključno terminalnimi in neznanimi)", () => {
    for (const s of ["CONFIRMED", "PAID", "PENDING", "REFUNDED", "CANCELLED", "EXPIRED", "UNKNOWN", "FAILED", "MODIFIED", "PAYMENT_REQUIRED"]) {
      expect(isInitial(s)).toBe(false);
    }
    expect(isInitial("IDEA")).toBe(false); // mostovni nabor pote NI del cikla
    expect(isInitial("")).toBe(false);
    expect(isInitial("confirmed")).toBe(false); // velike/male — kanon je velik
  });

  test("isTerminal: true samo za REFUNDED/EXPIRED/CANCELLED", () => {
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("EXPIRED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
  });

  test("isTerminal: false za ostale in neznane", () => {
    expect(isTerminal("CONFIRMED")).toBe(false);
    expect(isTerminal("EXTERNAL")).toBe(false); // absorpcijski, ne terminalni
    expect(isTerminal("UNKNOWN")).toBe(false);
    expect(isTerminal("IDEA")).toBe(false);
    expect(isTerminal("smeti")).toBe(false);
  });
});

// ─── Matrika prehodov — dovoljeni ───────────────────────────────────────────

describe("journey-booking: ALLOWED_TRANSITIONS — dovoljeni prehodi", () => {
  test("izbira → zahtevek: SELECTED → BOOKING_REQUESTED", () => {
    expect(canTransition("SELECTED", "BOOKING_REQUESTED")).toBe(true);
  });

  test("obdelava → potrjeno: PENDING → CONFIRMED (in PENDING → PAYMENT_REQUIRED)", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING", "PAYMENT_REQUIRED")).toBe(true);
  });

  test("plačilo → potrjeno: PAYMENT_REQUIRED → PAID in PAID → CONFIRMED/REFUNDED", () => {
    expect(canTransition("PAYMENT_REQUIRED", "PAID")).toBe(true);
    expect(canTransition("PAID", "CONFIRMED")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
  });

  test("import pot: DRAFT → SELECTED | CONFIRMED | CANCELLED", () => {
    expect(canTransition("DRAFT", "SELECTED")).toBe(true);
    expect(canTransition("DRAFT", "CONFIRMED")).toBe(true);
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
  });

  test("retry: FAILED → BOOKING_REQUESTED (in FAILED → SELECTED)", () => {
    expect(canTransition("FAILED", "BOOKING_REQUESTED")).toBe(true);
    expect(canTransition("FAILED", "SELECTED")).toBe(true);
  });

  test("samo-veriga: CONFIRMED → MODIFIED in MODIFIED → MODIFIED", () => {
    expect(canTransition("CONFIRMED", "MODIFIED")).toBe(true);
    expect(canTransition("MODIFIED", "MODIFIED")).toBe(true);
  });

  test("absorpcija: EXTERNAL → EXTERNAL (edini prehod iz EXTERNAL)", () => {
    expect(canTransition("EXTERNAL", "EXTERNAL")).toBe(true);
    expect(ALLOWED_TRANSITIONS.EXTERNAL.length).toBe(1);
  });

  test("razrešitev: UNKNOWN → CONFIRMED in UNKNOWN → CANCELLED (UNKNOWN v karkoli)", () => {
    expect(canTransition("UNKNOWN", "CONFIRMED")).toBe(true);
    expect(canTransition("UNKNOWN", "CANCELLED")).toBe(true);
    expect(canTransition("UNKNOWN", "REFUNDED")).toBe(true);
    // razen nazaj v vstopni DRAFT ali samega sebe
    expect(canTransition("UNKNOWN", "DRAFT")).toBe(false);
    expect(canTransition("UNKNOWN", "UNKNOWN")).toBe(false);
  });
});

// ─── Matrika prehodov — prepovedani ─────────────────────────────────────────

describe("journey-booking: ALLOWED_TRANSITIONS — prepovedani prehodi", () => {
  test("terminalni brez povratkov: REFUNDED → *, EXPIRED → PENDING, CANCELLED → CONFIRMED", () => {
    expect(canTransition("REFUNDED", "CONFIRMED")).toBe(false);
    expect(canTransition("REFUNDED", "EXTERNAL")).toBe(false);
    expect(canTransition("EXPIRED", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  test("import pot ne skače v operativna stanja: DRAFT → PENDING / DRAFT → PAID", () => {
    expect(canTransition("DRAFT", "PENDING")).toBe(false);
    expect(canTransition("DRAFT", "PAID")).toBe(false);
    expect(canTransition("DRAFT", "BOOKING_REQUESTED")).toBe(false);
  });

  test("brez preskakovanja stanj: SELECTED → PAID", () => {
    expect(canTransition("SELECTED", "PAID")).toBe(false);
    expect(canTransition("SELECTED", "CONFIRMED")).toBe(false);
  });

  test("absorpcijski EXTERNAL ne postane notranje potrjen: EXTERNAL → CONFIRMED", () => {
    expect(canTransition("EXTERNAL", "CONFIRMED")).toBe(false);
    expect(canTransition("EXTERNAL", "CANCELLED")).toBe(false);
  });

  test("brez povratka nazaj: CONFIRMED → PENDING in CONFIRMED → CONFIRMED (no-op)", () => {
    expect(canTransition("CONFIRMED", "PENDING")).toBe(false);
    expect(canTransition("CONFIRMED", "CONFIRMED")).toBe(false);
    expect(canTransition("PAID", "PENDING")).toBe(false);
  });

  test("neznan status → false (fail-closed, tudi mostovni IDEA)", () => {
    expect(canTransition("IDEA", "CONFIRMED")).toBe(false);
    expect(canTransition("CONFIRMED", "IDEA")).toBe(false);
    expect(canTransition("", "CONFIRMED")).toBe(false);
    expect(canTransition("CONFIRMED", "")).toBe(false);
  });
});

// ─── assertTransition ───────────────────────────────────────────────────────

describe("journey-booking: assertTransition (izrecne slovenske napake)", () => {
  test("dovoljen prehod → { ok: true }", () => {
    expect(assertTransition("DRAFT", "CONFIRMED")).toEqual({ ok: true });
    expect(assertTransition("FAILED", "BOOKING_REQUESTED")).toEqual({ ok: true });
  });

  test("nedovoljen prehod → { ok: false, error } z „ni dovoljen“", () => {
    const r = assertTransition("REFUNDED", "CONFIRMED");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("ni dovoljen");
      expect(r.error).toContain("REFUNDED");
      expect(r.error).toContain("CONFIRMED");
    }
  });

  test("neznan status → izrecna napaka (ne tiha odločitev)", () => {
    const r = assertTransition("SMETI", "CONFIRMED");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Neznan status");
    const r2 = assertTransition("CONFIRMED", 42 as unknown as string);
    expect(r2.ok).toBe(false);
  });
});

// ─── validateConfirmationRecord — CONFIRMED atestacija ──────────────────────

describe("journey-booking: validateConfirmationRecord — atestacija za CONFIRMED", () => {
  test("CONFIRMED brez providerBookingId → reject (klient ne more ponarediti)", () => {
    const r = validateConfirmationRecord({
      status: "CONFIRMED",
      source: "USER",
      confirmedPrice: 49.5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("providerBookingId");
  });

  test("CONFIRMED brez cene → reject", () => {
    const r = validateConfirmationRecord({
      status: "CONFIRMED",
      source: "USER",
      providerBookingId: "BLED-2026-114",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("confirmedPrice");
  });

  test("cena ≤ 0 → reject (tudi natanko 0)", () => {
    expect(
      validateConfirmationRecord({
        status: "CONFIRMED",
        source: "USER",
        providerBookingId: "BLED-1",
        confirmedPrice: 0,
      }).ok
    ).toBe(false);
    expect(
      validateConfirmationRecord({
        status: "CONFIRMED",
        source: "USER",
        providerBookingId: "BLED-1",
        confirmedPrice: -10,
      }).ok
    ).toBe(false);
  });

  test("sanity cap: cena > 1.000.000 → reject", () => {
    const r = validateConfirmationRecord({
      status: "CONFIRMED",
      source: "USER",
      providerBookingId: "BLED-1",
      confirmedPrice: 1_000_001,
    });
    expect(r.ok).toBe(false);
  });

  test("sanity cap: id > 200 znakov → reject", () => {
    const r = validateConfirmationRecord({
      status: "CONFIRMED",
      source: "USER",
      providerBookingId: "x".repeat(201),
      confirmedPrice: 10,
    });
    expect(r.ok).toBe(false);
  });

  test("id s kontrolnimi znaki / samo presledki → reject", () => {
    expect(
      validateConfirmationRecord({
        status: "CONFIRMED",
        source: "USER",
        providerBookingId: "BLE\tD-1",
        confirmedPrice: 10,
      }).ok
    ).toBe(false);
    expect(
      validateConfirmationRecord({
        status: "CONFIRMED",
        source: "USER",
        providerBookingId: "   ",
        confirmedPrice: 10,
      }).ok
    ).toBe(false);
  });

  test("source USER + CONFIRMED + popolna atestacija → ok (import pot)", () => {
    expect(
      validateConfirmationRecord({
        status: "CONFIRMED",
        source: "USER",
        providerBookingId: "BLED-2026-114",
        confirmedPrice: 49.5,
      })
    ).toEqual({ ok: true });
  });

  test("source IMPORTED + CONFIRMED + atestacija → ok (dokument = atestacija)", () => {
    expect(
      validateConfirmationRecord({
        status: "CONFIRMED",
        source: "IMPORTED",
        providerBookingId: "SOC-77",
        confirmedPrice: 120,
      }).ok
    ).toBe(true);
  });

  test("PAID brez providerBookingId → reject (izvirna invarianta CONFIRMED/PAID)", () => {
    const r = validateConfirmationRecord({
      status: "PAID",
      source: "PROVIDER",
      confirmedPrice: 49.5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("PAID");
  });

  test("PAID s providerBookingId (source PROVIDER) → ok", () => {
    expect(
      validateConfirmationRecord({
        status: "PAID",
        source: "PROVIDER",
        providerBookingId: "PROV-9",
      }).ok
    ).toBe(true);
  });
});

// ─── validateConfirmationRecord — izvor (iskrenost) ─────────────────────────

describe("journey-booking: validateConfirmationRecord — izvor zapisa", () => {
  test("source USER + status PENDING → reject (import samo DRAFT/CONFIRMED, izvirnik @64)", () => {
    const r = validateConfirmationRecord({
      status: "PENDING",
      source: "USER",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("USER");
  });

  test("source IMPORTED + status DRAFT brez polj → ok (uvoz čaka potrditev)", () => {
    expect(validateConfirmationRecord({ status: "DRAFT", source: "IMPORTED" })).toEqual({
      ok: true,
    });
  });

  test("source USER + DRAFT + providerBookingId → reject (atestacija samo ob CONFIRMED)", () => {
    const r = validateConfirmationRecord({
      status: "DRAFT",
      source: "USER",
      providerBookingId: "BLED-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("CONFIRMED");
  });

  test("provider polja brez izvora (null/legacy) → reject", () => {
    const r = validateConfirmationRecord({
      status: "SELECTED",
      providerBookingId: "X-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("izvorom");
    // tudi CONFIRMED z lestvami brez izvora se zavrne — ne zaupa se
    // nedeklariranemu nosilcu atestacije
    expect(
      validateConfirmationRecord({
        status: "CONFIRMED",
        providerBookingId: "X-1",
        confirmedPrice: 5,
      }).ok
    ).toBe(false);
  });

  test("source PROVIDER + PENDING + providerBookingId → ok (operativna stanja)", () => {
    expect(
      validateConfirmationRecord({
        status: "PENDING",
        source: "PROVIDER",
        providerBookingId: "PROV-1",
      }).ok
    ).toBe(true);
  });

  test("source PROVIDER + CONFIRMED brez id/price → reject (atestacija je obvezna)", () => {
    expect(
      validateConfirmationRecord({ status: "CONFIRMED", source: "PROVIDER" }).ok
    ).toBe(false);
  });

  test("EXTERNAL nikoli ne nosi providerBookingId (potrditev živi pri ponudniku)", () => {
    const r = validateConfirmationRecord({
      status: "EXTERNAL",
      source: "PROVIDER",
      providerBookingId: "PROV-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("EXTERNAL");
  });

  test("confirmationUrl: brez izvora → reject; s PROVIDER → ok", () => {
    expect(
      validateConfirmationRecord({
        status: "PENDING",
        confirmationUrl: "https://provider.example/confirm/1",
      }).ok
    ).toBe(false);
    expect(
      validateConfirmationRecord({
        status: "PENDING",
        source: "PROVIDER",
        confirmationUrl: "https://provider.example/confirm/1",
      }).ok
    ).toBe(true);
  });

  test("neznan status / neznan izvor → reject", () => {
    expect(
      validateConfirmationRecord({ status: "SMETI" as never }).ok
    ).toBe(false);
    expect(
      validateConfirmationRecord({
        status: "SELECTED",
        source: "GHOST" as never,
      }).ok
    ).toBe(false);
  });
});

// ─── Statusne oznake ────────────────────────────────────────────────────────

describe("journey-booking: statusLabel (SL/EN, iskrena rezerva)", () => {
  test("SL oznake za vseh 14 statusov (neznanomec ne more pasti skozi)", () => {
    expect(statusLabel("DRAFT")).toBe("Osnutek");
    expect(statusLabel("CONFIRMED")).toBe("Potrjeno");
    expect(statusLabel("CANCELLED")).toBe("Preklicano");
    expect(statusLabel("EXTERNAL")).toContain("Zunanja");
    expect(statusLabel("UNKNOWN")).toBe("Neznano");
    for (const s of CONFIRMATION_STATUSES) {
      expect(statusLabel(s).length).toBeGreaterThan(0);
      expect(statusLabel(s)).not.toBe(s); // vsak status ima svojo oznako
    }
  });

  test("EN oznake (locale parameter)", () => {
    expect(statusLabel("CONFIRMED", "en")).toBe("Confirmed");
    expect(statusLabel("REFUNDED", "en")).toBe("Refunded");
    expect(statusLabel("EXTERNAL", "en")).toContain("External");
  });

  test("neznan status → surovi niz (brez izmišljene oznake)", () => {
    expect(statusLabel("IDEA")).toBe("IDEA");
    expect(statusLabel("")).toBe("");
  });
});

// ─── Atestacijski JSON v opombi ─────────────────────────────────────────────

describe("journey-booking: atestacijski JSON v stolpcu note", () => {
  test("build → parse povratek (source, id, cena, userNote)", () => {
    const json = buildAttestationNote({
      source: "USER",
      providerBookingId: " BLED-2026-114 ",
      confirmedPrice: 49.5,
      userNote: "  Miza za 4 ob 19:00  ",
    });
    const parsed = parseAttestationNote(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.source).toBe("USER");
    expect(parsed!.providerBookingId).toBe("BLED-2026-114"); // okleščeno/trimano
    expect(parsed!.confirmedPrice).toBe(49.5);
    expect(parsed!.userNote).toBe("Miza za 4 ob 19:00");
  });

  test("userNote brez besedila se ne shranjuje (kompakten JSON)", () => {
    const json = buildAttestationNote({
      source: "USER",
      providerBookingId: "BLED-1",
      confirmedPrice: 10,
    });
    expect(JSON.parse(json).userNote).toBeUndefined();
    expect(parseAttestationNote(json)!.userNote).toBeUndefined();
  });

  test("parse: legacy golo besedilo → null; noteTextOf → surovo besedilo", () => {
    expect(parseAttestationNote("rezervirana miza za 4")).toBeNull();
    expect(parseAttestationNote(null)).toBeNull();
    expect(noteTextOf("rezervirana miza za 4")).toBe("rezervirana miza za 4");
    expect(noteTextOf(null)).toBeNull();
  });

  test("noteTextOf: JSON → userNote; JSON brez userNote → null", () => {
    const json = buildAttestationNote({
      source: "USER",
      providerBookingId: "BLED-1",
      confirmedPrice: 10,
      userNote: "opomba",
    });
    expect(noteTextOf(json)).toBe("opomba");
    const noNote = buildAttestationNote({
      source: "USER",
      providerBookingId: "BLED-1",
      confirmedPrice: 10,
    });
    expect(noteTextOf(noNote)).toBeNull();
  });

  test("parse: pokvarjen JSON / JSON brez atestacijskih polj → null (združljivost)", () => {
    expect(parseAttestationNote("{pokvarjeno")).toBeNull();
    expect(parseAttestationNote('{"userNote":"samo opomba"}')).toBeNull();
    expect(parseAttestationNote('{"source":"USER"}')).toBeNull();
    expect(parseAttestationNote("[]")).toBeNull();
  });
});
