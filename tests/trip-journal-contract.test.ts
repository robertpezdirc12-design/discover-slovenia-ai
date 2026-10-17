/**
 * TRIP-JOURNAL-CONTRACT — skupnostni potni dnevnik (F12 iz izvirnika
 * 1.163.4 → TripJournalEntry). DVE VRSTI trditve (isti vzorec kot
 * trip-security-contract):
 *
 *  1. VEDENJSKE — čista logika je pokrita v tests/trip-journal.test.ts
 *     (meje, čiščenje, serIALIZACIJA, avtorstvo) — tukaj le kanon vrstnega
 *     reda relacije vlog.
 *  2. SOURCE-CONTRACT — DB-vezana ruta in UI (brez Postgresa v peskovniku
 *     niso enotsko testabilne) zaklenjena z branjem izvorne kode: če kdo
 *     odstrani varovalko (vloga, rate limit, sanitize, tiskljivost),
 *     test pade.
 */

import { describe, expect, test } from "bun:test";

import {
  canModifyEntry,
  JOURNAL_HISTORY_LIMIT,
  JOURNAL_TEXT_MAX,
} from "../src/lib/trip-journal";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

// ── 1. VEDENJSKO: kanon moderacije (avtor ALI lastnik) ───────────────────

describe("trip-journal: canModifyEntry — kanon izvirnika (edini avtor; mostovno + lastnik)", () => {
  test("anonimni gledalec NIKOLI ne ureja; avtor vedno; lastnik poti kot skrbnik", () => {
    expect(canModifyEntry("u1", "u1", false)).toBe(true);
    expect(canModifyEntry("u1", "u2", false)).toBe(false);
    expect(canModifyEntry("u1", "u2", true)).toBe(true);
    expect(canModifyEntry("u1", null, true)).toBe(false);
  });
});

// ── 2. SOURCE-CONTRACT: API ruta (fail-closed struktura) ──────────────────

describe("trip-journal: API ruta — source-contract", () => {
  test("① vsi štirje handlerji obstajajo (GET/POST/PATCH/DELETE)", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    expect(s).toContain("export async function GET(");
    expect(s).toContain("export async function POST(");
    expect(s).toContain("export async function PATCH(");
    expect(s).toContain("export async function DELETE(");
  });

  test("② GET uporablja getTripForRead in javi 404 brez razkrivanja obstoja", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    expect(s).toContain("getTripForRead(shareId)");
    expect(s).toContain("Ta pot ne obstaja (ali ni javna).");
  });

  test("③ POST/PATCH/DELETE so role-gated na VIEWER+ prek getTripForWrite", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    // fail-closed: 3× getTripForWrite z najnižjo vlogo VIEWER (zapis)
    expect(s.split('getTripForWrite(shareId, "VIEWER")').length - 1).toBe(3);
  });

  test("④ vsako pisanje je rate-limited (30/min) — P0 AUDIT M8", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    expect(s.split("rateLimited(request, 30)").length - 1).toBe(3);
    expect(s).toContain("tooManyRequests()");
  });

  test("⑤ validacija gre skozi čisto logiko (parseJournalInput/parseJournalPatch)", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    expect(s).toContain("parseJournalInput(raw)");
    expect(s).toContain("parseJournalPatch(raw)");
    expect(s).toContain("serializeJournalEntry(");
  });

  test("⑥ urejanje/brisanje: author-or-OWNER prek canModifyEntry (strežniško)", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    expect(s.split("canModifyEntry(").length - 1).toBeGreaterThanOrEqual(2); // PATCH + DELETE
    expect(s).toContain('role === "OWNER"');
    expect(s).toContain("403");
  });

  test("⑦ zgodovina je omejena (JOURNAL_HISTORY_LIMIT) in najnovejši prej", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    expect(s).toContain("take: JOURNAL_HISTORY_LIMIT");
    expect(s).toContain('orderBy: { createdAt: "desc" }');
    expect(JOURNAL_HISTORY_LIMIT).toBe(200);
  });

  test("⑧ API odgovori po kanonu: {success:true, entry} / {entries} / {error}", async () => {
    const s = await src("src/app/api/trips/[shareId]/journal/route.ts");
    expect(s).toContain("{ success: true, entry: serializeJournalEntry(entry, userId) }");
    expect(s).toContain("entries: rows.map((row) => serializeJournalEntry(row, ctx.userId))");
    expect(s).toContain('{ error: "Manjka id vpisa." }');
  });
});

// ── 3. SOURCE-CONTRACT: UI komponenta + mount ─────────────────────────────

describe("trip-journal: UI — source-contract", () => {
  test("⑨ komponenta obstaja z 6-jezičnimi slovarji (parity kanon, meje besed)", async () => {
    const s = await src("src/components/trips/trip-journal.tsx");
    expect(s).toContain("export function TripJournal(");
    // parity po JEZIKIH (\b meja — "edit:" NE sme šteti kot "it:")
    const count = (re: RegExp) => (s.match(re) ?? []).length;
    const sl = count(/\bsl:/g);
    expect(sl).toBeGreaterThan(20);
    for (const lang of ["en", "it", "de", "fr", "es"]) {
      expect(count(new RegExp(`\\b${lang}:`, "g"))).toBe(sl);
    }
  });

  test("⑩ F12 kanon: vnos ima dan/kraj/oceno; spomin do 2000 znakov", async () => {
    const s = await src("src/components/trips/trip-journal.tsx");
    expect(s).toContain("dayIndex");
    expect(s).toContain("placeName");
    expect(s).toContain("rating");
    expect(s).toContain("maxLength={JOURNAL_TEXT_MAX}");
    expect(JOURNAL_TEXT_MAX).toBe(2000);
  });

  test("⑪ tiskljivost (photobook): seznam vpisov se NITI ne skrije; formular/gumbi so", async () => {
    const s = await src("src/components/trips/trip-journal.tsx");
    // obrazec in nadzorni gumbi se skrijejo ob tiskanju …
    expect(s).toContain("print:hidden");
    // … a ULI element in besedilo vpisa NISTA print:hidden (natisnjena
    //    stran = photobook); print:hidden je dovoljen SAMO na gumbih znotraj
    expect(/<ul[^>]*print:hidden/.test(s)).toBe(false);
    const listStart = s.indexOf('<ul className="space-y-4"');
    const listEnd = s.indexOf("</ul>", listStart);
    const listBlock = s.slice(listStart, listEnd);
    expect(listBlock).toContain('aria-live="polite"');
    // besedilo spomina mora preživeti tisk:
    expect(listBlock).toContain("whitespace-pre-line");
    const liStart = s.indexOf("<li", listStart);
    const liEnd = s.indexOf("</li>", liStart);
    const liBlock = s.slice(liStart, liEnd);
    expect(liBlock).toContain("print:hidden"); // gumbi
    expect(liBlock).toContain("whitespace-pre-line text-sm"); // spomin — VEDNO tiskan
  });

  test("⑫ a11y: slovenske aria oznake (kanon lupine)", async () => {
    const s = await src("src/components/trips/trip-journal.tsx");
    expect(s).toContain('aria-label="Potni dnevnik"');
    expect(s).toContain("role=\"alert\"");
    expect(s).toContain("role=\"status\"");
  });

  test("⑬ mount: zavihek dnevnik v SharedTripView med anketami in klepetom", async () => {
    const s = await src("src/components/content/shared-trip-view.tsx");
    expect(s).toContain('import { TripJournal } from "@/components/trips/trip-journal"');
    expect(s).toContain('value="dnevnik"');
    expect(s).toContain("tabDiary: { sl: \"Dnevnik\", en: \"Journal\", it: \"Diario\", de: \"Tagebuch\", fr: \"Journal\", es: \"Diario\" }");
    // pred klepetom (vrstni red zavihkov)
    expect(s.indexOf('value="dnevnik"')).toBeLessThan(s.indexOf('<TabsContent value="chat"'));
    // pogoji montaže: canPost=canParticipate (VIEWER+), ime seje
    const mount = s.slice(s.indexOf("<TripJournal"), s.indexOf("</TabsContent>", s.indexOf("<TripJournal")));
    expect(mount).toContain("canPost={canParticipate}");
    expect(mount).toContain("planDays={plan.days.length}");
    expect(mount).toContain("myName={session?.user?.name ?? session?.user?.email ?? null}");
  });

  test("⑭ shema: TripJournalEntry z mostovnim avtorstvom + kaskada", async () => {
    const s = await src("prisma/schema.prisma");
    expect(s).toContain("model TripJournalEntry {");
    expect(s).toContain("journalEntries TripJournalEntry[]"); // TravelJourney
    expect(s).toContain("journalEntries TripJournalEntry[]"); // User
    const m = s.slice(s.indexOf("model TripJournalEntry {"), s.indexOf("}", s.indexOf("model TripJournalEntry {")));
    expect(m).toContain("onDelete: Cascade"); // brisanje poti počisti vnose
    expect(m).toContain("onDelete: SetNull"); // brisanje računa NE poje vpisa
    expect(m).toContain("authorName String"); // posnetek (preživi račun)
    expect(m).toContain("@@index([journeyId, createdAt])");
  });
});
