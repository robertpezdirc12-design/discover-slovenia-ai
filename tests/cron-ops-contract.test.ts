/**
 * CRON-OPS-CONTRACT (P0-I, issue #1 §21/§23) — fail-closed struktura cron
 * plasti + SYSTEM_DATA_GUARD integracija + dim.
 *
 * SOURCE-CONTRACT (pošteno označeno): DB-vezani jobi v peskovniku niso
 * enotsko testabilni brez živih vrstic — zaklenemo STRUKTURO izvorne kode
 * in registracijo urnikov. Če kdo odstrani requireCronSecret iz kakšne
 * cron poti, izpusti urnik iz vercel.json / prod-cron.yml ali razbije
 * guard na meji
 * zunanjih podatkov, regresijska mreža pade.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

const CRON_ROUTES = [
  "sto-reingest",
  "kiwitaxi-reingest",
  "recalculate-status",
  "draft-reminders",
  "watch-check", // P1-C (issue #3 §4): preverjanje spremljanj vsaki 2 uri
] as const;

// ── Cron: fail-closed avtorizacija ─────────────────────────────────────────

describe("p0i [source-contract]: cron poti so fail-closed", () => {
  for (const route of CRON_ROUTES) {
    test(`① /api/cron/${route} uporablja requireCronSecret (401 brez žetona)`, async () => {
      const code = await src(`src/app/api/cron/${route}/route.ts`);
      expect(code).toContain('requireCronSecret(req)');
      expect(code).toContain("if (denied) return denied;");
      // Stara ranljiva oblika (primerjava skrivnosti neposredno v poti,
      // brez skupnega varovalnega seznama) ne sme več obstajati:
      expect(code).not.toContain("req.headers.get(\"authorization\") ?? \"\"");
    });
  }

  test("② cron-auth odkloni tudi, ko CRON_SECRET NI nastavljen (zaprt, ne odprt)", async () => {
    const code = await src("src/lib/cron-auth.ts");
    expect(code).toContain("CRON_SECRET ni nastavljen v okolju");
    expect(code).toContain("fail-closed");
  });

  test("③ GET in POST sta podprta na vseh cron poteh (Vercel pošlje GET)", async () => {
    for (const route of CRON_ROUTES) {
      const code = await src(`src/app/api/cron/${route}/route.ts`);
      expect(code).toContain("export const GET = handle");
      expect(code).toContain("export const POST = handle");
    }
  });
});

// ── Urniki (vercel.json + GitHub Actions) ─────────────────────────────────
//
// Hobby plan Vercela dovoli NAJVEČ 2 cron joba na račun in največ 1 zagon
// na dan — zato sta v vercel.json SAMO dnevna joba, preostale 3 pa poganja
// .github/workflows/prod-cron.yml (isti Bearer fail-closed kanon).

describe("p0i [source-contract]: urniki cron jobov so registrirani", () => {
  test("④ vercel.json vsebuje 2 DNEVNA cron vnosa (Hobby meja: max 2, 1×/dan)", async () => {
    const raw = JSON.parse(await src("vercel.json"));
    const crons = raw.crons as { path: string; schedule: string }[];
    expect(crons.length).toBe(2); // Hobby: max 2 — več jih deploy zavrne
    const recalc = crons.find((c) => c.path === "/api/cron/recalculate-status");
    expect(recalc?.schedule).toBe("30 6 * * *"); // dnevno 6:30 UTC
    const nudge = crons.find((c) => c.path === "/api/cron/draft-reminders");
    expect(nudge?.schedule).toBe("0 8 * * *"); // dnevno 8:00 UTC
  });

  test("④b preostali 3 jobi so v .github/workflows/prod-cron.yml (isti urniki)", async () => {
    const wf = await src(".github/workflows/prod-cron.yml");
    expect(wf).toContain("watch-check"); // P1-C: vsaki 2 uri
    expect(wf).toContain("'15 */2 * * *'");
    expect(wf).toContain("sto-reingest"); // P0-C: torek 7:30 UTC
    expect(wf).toContain("'30 7 * * 2'");
    expect(wf).toContain("kiwitaxi-reingest"); // P0-C: sreda 7:30 UTC
    expect(wf).toContain("'30 7 * * 3'");
    // žeton potuje SAMO v glavi (fail-closed kanon), nikoli v URL-ju:
    expect(wf).toContain("Authorization: Bearer ${CRON_SECRET}");
    expect(wf).not.toMatch(/CRON_SECRET=/); // nikoli kot query parameter
  });
});

// ── Idempotenca + auditabilnost (struktura) ────────────────────────────────

describe("p0i [source-contract]: idempotenca + AuditLog", () => {
  test("⑤ recalculate-status piše SAMO po planu (idempotentno) in v transakciji z dnevnikom", async () => {
    const code = await src("src/app/api/cron/recalculate-status/route.ts");
    expect(code).toContain("planPayoutRecalc");
    expect(code).toContain("report.actions.length > 0");
    expect(code).toContain("$transaction");
    expect(code).toContain('action: PAYOUT_RECALC_AUDIT_ACTION');
    expect(code).toContain('actorType: "system"');
  });

  test("⑥ draft-reminders ima dedup po AuditLog zgodovini (interval 7 dni)", async () => {
    const code = await src("src/app/api/cron/draft-reminders/route.ts");
    expect(code).toContain("planDraftNudges");
    expect(code).toContain("DRAFT_NUDGE_INTERVAL_DAYS");
    expect(code).toContain("DRAFT_NUDGE_AUDIT_ACTION");
    expect(code).toContain("createdAt: { gte: since }");
  });

  test("⑦ draft-reminders NE trdi, da pošilja e-pošto (iskrenostni kanon)", async () => {
    const code = await src("src/app/api/cron/draft-reminders/route.ts");
    expect(code).toContain("brez e-pošte");
    // prepovedani glagoli pošiljanja (lažna obljuba):
    expect(code).not.toMatch(/(poslali|pošiljamo)\s+e-?pošto/i);
  });
});

// ── SYSTEM_DATA_GUARD integracija (§23) ────────────────────────────────────

describe("p0i [source-contract]: SYSTEM_DATA_GUARD na mejah podatkov", () => {
  test("⑧ @AI svetovalec: zaznavanje navodil → varnostni odgovor brez odmeva", async () => {
    const code = await src("src/lib/trip-chat-engine.ts");
    expect(code).toContain("detectPromptInjection(body)");
    expect(code).toContain("AI_GUARD_ANSWER");
    expect(code).toContain("sanitizeUntrustedText(loc.name");
  });

  test("⑨ sporočila klepeta se sanitizirajo PRED shranjevanjem", async () => {
    const code = await src("src/app/api/trips/[shareId]/messages/route.ts");
    expect(code).toContain("sanitizeUntrustedText(body.body.trim()");
  });

  test("⑩ konzultacije: vprašanje + dodatki sanitizirani; injection opomba v odgovoru", async () => {
    const code = await src("src/lib/consultation-fallback.ts");
    expect(code).toContain("sanitizeUntrustedText(input.question.trim()");
    expect(code).toContain("sanitizeUntrustedText(v, { maxLen: max");
    expect(code).toContain("detectPromptInjection(input.question)");
    expect(code).toContain("OPOMBA VARNOSTNEGA STRAŽARJA");
  });

  test("⑪ OSM Overpass: ime POI + relevantne oznake sanitizirane ob vstopu", async () => {
    const code = await src("src/lib/supply/providers/osm/overpass.ts");
    expect(code).toContain('sanitizeUntrustedText(tags["name"]');
    expect(code).toContain("sanitizeUntrustedText(tags[key]");
  });

  test("⑫ FSQ dump: ime/naslov/kraj sanitizirani v validaciji vrstice", async () => {
    const code = await src("src/lib/supply/providers/fsq/dataset.ts");
    expect(code).toContain("sanitizeUntrustedText(d.name");
    expect(code).toContain("sanitizeUntrustedText(d.address");
    expect(code).toContain("sanitizeUntrustedText(d.locality");
  });

  test("⑬ KiwiTaxi feed: imeni lokacij sanitizirani v validaciji", async () => {
    const code = await src("src/lib/supply/providers/kiwitaxi/routes.ts");
    expect(code).toContain("sanitizeUntrustedText(d.fromName");
    expect(code).toContain("sanitizeUntrustedText(d.toName");
  });
});

// ── Dim + health ──────────────────────────────────────────────────────────

describe("p0i [source-contract]: produkcijski dim + health", () => {
  test("⑭ smoke skripta je SAMO-BRALNA (0 metod razen GET)", async () => {
    const code = await src("scripts/smoke.ts");
    expect(code).toContain('"GET"');
    expect(code).not.toMatch(/method:\s*"(POST|PUT|DELETE|PATCH)"/);
    // negativni varnostni dim je obvezen:
    expect(code).toContain("cron-fail-closed");
    expect(code).toContain("401");
  });

  test("⑮ smoke je dostopen kot npm script", async () => {
    const pkg = JSON.parse(await src("package.json"));
    expect(pkg.scripts.smoke).toBe("bun scripts/smoke.ts");
  });

  test("⑯ health ima 9. preverbo ops:cron (brez razkritja vrednosti skrivnosti)", async () => {
    const code = await src("src/app/api/health/route.ts");
    expect(code).toContain('name: "ops:cron"');
    expect(code).toContain("cronSecretConfigured()");
    // vrednost skrivnosti se NE izpiše:
    expect(code).not.toMatch(/process\.env\.CRON_SECRET[^)]*\}\}/);
  });

  test("⑰ .env.example dokumentira CRON_SECRET (namestitev brez ugibanja)", async () => {
    const code = await src(".env.example");
    expect(code).toContain("CRON_SECRET=");
  });

  test("⑱ runbook OPERATIONS.md pokriva vse 4 jobe + iskreno odsotne", async () => {
    const doc = await src("docs/OPERATIONS.md");
    for (const route of CRON_ROUTES) {
      expect(doc).toContain(route);
    }
    expect(doc).toContain("daily-trip-push"); // pošteno NE-obnovljeni
    expect(doc).toContain("recalculate-status");
  });
});

// ── Partner portal: nudge brez e-pošte ────────────────────────────────────

describe("p0i [source-contract]: portal partnerja — vidna opomba", () => {
  test("⑲ /partner izpisuje nudge za osnutek ≥ 7 dni z iskrenim »ne pošiljamo e-pošte«", async () => {
    const code = await src("src/app/[locale]/partner/view.tsx");
    expect(code).toContain("daysSinceIso(row.updatedAt) >= 7");
    expect(code).toContain("ne pošiljamo e-pošte");
  });

  test("⑳ partner GET vrača updatedAt (osnova starosti osnutka)", async () => {
    const code = await src("src/app/api/partner/products/route.ts");
    expect(code).toContain("updatedAt: p.updatedAt.toISOString()");
  });
});
