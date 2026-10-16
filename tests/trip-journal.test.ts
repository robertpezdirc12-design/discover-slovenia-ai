import { describe, expect, test } from "bun:test";

import {
  JOURNAL_HISTORY_LIMIT,
  JOURNAL_PLACE_MAX,
  JOURNAL_RATING_MAX,
  JOURNAL_RATING_MIN,
  JOURNAL_TEXT_MAX,
  JOURNAL_TEXT_MIN,
  canModifyEntry,
  parseJournalInput,
  parseJournalPatch,
  sanitizeJournalPlace,
  sanitizeJournalText,
  serializeJournalEntry,
  type JournalRow,
} from "../src/lib/trip-journal";

/** MEJE IZVIRNIKA (F12, 1.163.4) — kanon, ne izmišljija. */
describe("trip-journal [meje izvirnika F12]", () => {
  test("① konstante = izvirnik: text 2–2000, place ≤ 80, rating 1–5", () => {
    expect(JOURNAL_TEXT_MIN).toBe(2);
    expect(JOURNAL_TEXT_MAX).toBe(2000);
    expect(JOURNAL_PLACE_MAX).toBe(80);
    expect(JOURNAL_RATING_MIN).toBe(1);
    expect(JOURNAL_RATING_MAX).toBe(5);
    expect(JOURNAL_HISTORY_LIMIT).toBe(200);
  });
});

describe("trip-journal [parseJournalInput — POST]", () => {
  test("② poln veljaven vnos: text + dan + kraj + ocena", () => {
    const r = parseJournalInput({
      text: "Bled v soncu — kolesarili smo okoli jezera.",
      dayIndex: 2,
      placeName: "Bled",
      rating: 5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.text).toContain("Bled");
      expect(r.value.dayIndex).toBe(2);
      expect(r.value.placeName).toBe("Bled");
      expect(r.value.rating).toBe(5);
    }
  });

  test("③ minimalen vnos: samo text (dan/kraj/ocena = null = splošen)", () => {
    const r = parseJournalInput({ text: "ab" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.dayIndex).toBeNull();
      expect(r.value.placeName).toBeNull();
      expect(r.value.rating).toBeNull();
    }
  });

  test("④ text pod mejo (1 znak) → napaka z obema mejama v sporočilu", () => {
    const r = parseJournalInput({ text: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2");
  });

  test("⑤ text čez mejo (2001) → napaka", () => {
    const r = parseJournalInput({ text: "x".repeat(2001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2000");
  });

  test("⑥ meja text natanko 2000 → veljavno", () => {
    const r = parseJournalInput({ text: "x".repeat(2000) });
    expect(r.ok).toBe(true);
  });

  test("⑦ dayIndex: 0, negativno število, ulomek in niz so zavrnjeni", () => {
    for (const bad of [0, -1, 1.5, "2"]) {
      const r = parseJournalInput({ text: "ab", dayIndex: bad });
      expect(r.ok).toBe(false);
    }
  });

  test("⑧ dayIndex ≥ 1 veljaven; izrecni null = splošen vnos", () => {
    expect(parseJournalInput({ text: "ab", dayIndex: 1 }).ok).toBe(true);
    expect(parseJournalInput({ text: "ab", dayIndex: 12 }).ok).toBe(true);
    expect(parseJournalInput({ text: "ab", dayIndex: null }).ok).toBe(true);
  });

  test("⑨ rating: 0 in 6 zavrnjena, 1 in 5 veljavna, null = brez ocene", () => {
    expect(parseJournalInput({ text: "ab", rating: 0 }).ok).toBe(false);
    expect(parseJournalInput({ text: "ab", rating: 6 }).ok).toBe(false);
    expect(parseJournalInput({ text: "ab", rating: 2.5 }).ok).toBe(false);
    expect(parseJournalInput({ text: "ab", rating: 1 }).ok).toBe(true);
    expect(parseJournalInput({ text: "ab", rating: 5 }).ok).toBe(true);
    expect(parseJournalInput({ text: "ab", rating: null }).ok).toBe(true);
  });

  test("⑩ placeName čez 80 → NAPAKA (avtor lahko popravi, ne utišano obreže); prazen → null", () => {
    const r = parseJournalInput({ text: "ab", placeName: "p".repeat(81) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("80");
    const r2 = parseJournalInput({ text: "ab", placeName: "   " });
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value.placeName).toBeNull();
  });

  test("⑪ ne-objekten vnos → napaka", () => {
    expect(parseJournalInput("ab").ok).toBe(false);
    expect(parseJournalInput(null).ok).toBe(false);
  });
});

describe("trip-journal [čiščenje vnosa — P0-I §23]", () => {
  test("⑫ nadzorni/zero-width znaki se odstranijo (brez vstavljanja presledkov — kanon sanitarje kot v klepetu), nove vrstice ostanejo", () => {
    const dirty = "dan\u0000ena\u200bdva\u202e";
    const clean = sanitizeJournalText(dirty);
    expect(clean).not.toMatch(/[\u0000\u200b\u202e]/);
    // kanon: odstranjeno = IZREZANO (presledki se ne vstavijo — isto
    // vedenje kot telo sporočila v klepetu)
    expect(clean).toBe("danenadva");
    expect(sanitizeJournalText("vrstica ena\nvrstica dva")).toContain("\n");
  });

  test("⑬ kraj: strnjen na eno vrstico; sanitari NE obreže (meja je napaka v parse)", () => {
    expect(sanitizeJournalPlace("  Bled\n  jezero ")).toBe("Bled jezero");
    expect(sanitizeJournalPlace("p".repeat(300))).toBe("p".repeat(300));
    expect(sanitizeJournalPlace(42)).toBe("");
  });
});

describe("trip-journal [parseJournalPatch — urejanje]", () => {
  test("⑭ delni patch: samo text", () => {
    const r = parseJournalPatch({ text: "nov spomin" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.text).toBe("nov spomin");
      expect(r.patch.dayIndex).toBeUndefined();
      expect(r.patch.rating).toBeUndefined();
    }
  });

  test("⑮ izrecni null počisti opcijsko polje (ocena/kraj/dan)", () => {
    const r = parseJournalPatch({ rating: null, placeName: null, dayIndex: null });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.rating).toBeNull();
      expect(r.patch.placeName).toBeNull();
      expect(r.patch.dayIndex).toBeNull();
    }
  });

  test("⑯ prazen patch (nič prisotnega) → napaka", () => {
    expect(parseJournalPatch({}).ok).toBe(false);
  });

  test("⑰ neveljavne vrednosti v patchu so zavrnjene (iste meje kot POST)", () => {
    expect(parseJournalPatch({ text: "a" }).ok).toBe(false);
    expect(parseJournalPatch({ rating: 0 }).ok).toBe(false);
    expect(parseJournalPatch({ dayIndex: 0 }).ok).toBe(false);
    expect(parseJournalPatch({ placeName: "p".repeat(81) }).ok).toBe(false);
  });
});

describe("trip-journal [serIALIZACIJA + avtorstvo]", () => {
  const row: JournalRow = {
    id: "e1",
    authorId: "u1",
    authorName: "Ana",
    dayIndex: 3,
    placeName: "Piran",
    rating: 4,
    text: "Sončni zahod na mestu.",
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-01T11:00:00Z"),
  };

  test("⑱ serialize: mine=true za avtorja, false za drugega/anonimnega", () => {
    expect(serializeJournalEntry(row, "u1").mine).toBe(true);
    expect(serializeJournalEntry(row, "u2").mine).toBe(false);
    expect(serializeJournalEntry(row, null).mine).toBe(false);
  });

  test("⑲ serialize: datumi ISO, polja 1:1", () => {
    const s = serializeJournalEntry(row, "u2");
    expect(s.createdAt).toBe("2026-10-01T10:00:00.000Z");
    expect(s.updatedAt).toBe("2026-10-01T11:00:00.000Z");
    expect(s.text).toBe(row.text);
    expect(s.dayIndex).toBe(3);
    expect(s.placeName).toBe("Piran");
    expect(s.rating).toBe(4);
  });

  test("⑳ canModifyEntry: avtor DA, lastnik DA, drug NE, anonimno NE", () => {
    expect(canModifyEntry("u1", "u1", false)).toBe(true);
    expect(canModifyEntry("u1", "u2", true)).toBe(true); // lastnik skrbi
    expect(canModifyEntry("u1", "u2", false)).toBe(false);
    expect(canModifyEntry("u1", null, true)).toBe(false);
    expect(canModifyEntry(null, "u2", true)).toBe(true); // osirotel vpis → lastnik
  });
});
