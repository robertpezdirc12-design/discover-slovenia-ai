/**
 * P0H-UI-CONTRACT (P0-H) — strukturna zaklenjenost UI plasti B2B tržnice.
 *
 * SOURCE-CONTRACT (pošteno označeno, enak kanon kot
 * tests/p0h-security-contract.test.ts): UI strani so odjemalni "use client"
 * elementi, ki jih ne moremo enotsko zagnati brez brskalnika. Zaklenemo
 * STRUKTURO izvorne kode: če kdo odstrani iskrenostno razkritje, vrata
 * (401/403 veje), zasebnost žetona ali povezavo med prijavnico in API-jem,
 * regresijska mreža pade.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

// ── /konzultacija: javni obrazec ────────────────────────────────────────────

describe("p0h-ui [source-contract]: javni obrazec /konzultacija", () => {
  test("① obrazec pošlje na /api/consultation (isti vir resnice kot strežnik)", async () => {
    const code = await src("src/app/[locale]/konzultacija/page.tsx");
    expect(code).toContain('fetch("/api/consultation"');
  });

  test("② iskrenostno razkritje: brez AI + dnevna meja sta zapisana na strani", async () => {
    const code = await src("src/app/[locale]/konzultacija/page.tsx");
    expect(code).toContain("Brez AI");
    expect(code).toContain("3 vprašanja na dan");
  });

  test("③ uspeh pokaže ZASEBNO povezavo z opombo, da e-pošte ne pošiljamo", async () => {
    const code = await src("src/app/[locale]/konzultacija/page.tsx");
    expect(code).toContain("e-pošte ne pošiljamo");
  });
});

// ── /konzultacija/[token]: zasebna stran odgovora ───────────────────────────

describe("p0h-ui [source-contract]: zasebna stran /konzultacija/[token]", () => {
  test("④ bere iz /api/consultation/{token} (žeton ostane edini ključ)", async () => {
    const code = await src("src/app/[locale]/konzultacija/[token]/page.tsx");
    expect(code).toContain("fetch(`/api/consultation/${encodeURIComponent(token)}`)");
  });

  test("⑤ 404 ima iskrenostno stanje (brez razkritja obstoja)", async () => {
    const code = await src("src/app/[locale]/konzultacija/[token]/page.tsx");
    expect(code).toContain("Ta povezava ne obstaja");
  });

  test("⑥ razlika fallback/manual je razkrita (answerSource vpliva na prikaz)", async () => {
    const code = await src("src/app/[locale]/konzultacija/[token]/page.tsx");
    expect(code).toContain('d.answerSource === "manual"');
    expect(code).toContain("Dopolnil skrbnik");
    expect(code).toContain("Samodejni vodnik");
  });

  test("⑦ e-pošta pošiljatelja se nikjer ne prikaže (API je ne vrača, stran je ne čaka)", async () => {
    const code = await src("src/app/[locale]/konzultacija/[token]/page.tsx");
    expect(code).not.toContain("c.email");
    expect(code).not.toContain("data.email");
  });
});

// ── /partner: portal partnerja ──────────────────────────────────────────────

describe("p0h-ui [source-contract]: portal partnerja /partner", () => {
  test("⑧ vrata: 401 → prijava z next=/partner; 403 → prijavnica /za-ponudnike", async () => {
    const code = await src("src/app/[locale]/partner/page.tsx");
    expect(code).toContain('res.status === 401');
    expect(code).toContain('/prijava?next=/partner');
    expect(code).toContain('res.status === 403');
    expect(code).toContain('"/za-ponudnike"');
  });

  test("⑨ urejevalnik opozori na ponovno moderacijo objavljenega vnosa", async () => {
    const code = await src("src/app/[locale]/partner/page.tsx");
    expect(code).toContain("NAZAJ v skrbniški pregled");
  });

  test("⑩ zavrnitev z razlogom je vidna partnerju (iskrena povratna zanka)", async () => {
    const code = await src("src/app/[locale]/partner/page.tsx");
    expect(code).toContain("row.rejectionReason");
    expect(code).toContain("Razlog zavrnitve");
  });
});

// ── /admin: skrbniški portal ────────────────────────────────────────────────

describe("p0h-ui [source-contract]: skrbniški portal /admin", () => {
  test("⑪ vsi trije razdelki iskreno pokažejo 403 (fail-closed vrata)", async () => {
    const code = await src("src/app/[locale]/admin/page.tsx");
    expect(code).toContain("res.status === 403");
    expect(code).toContain("Dostop samo za skrbnike");
  });

  test("⑫ zavrnitev zahteva razlog (obvezen vnos, viden partnerju)", async () => {
    const code = await src("src/app/[locale]/admin/page.tsx");
    expect(code).toContain("disabled={!reason.trim()}");
    expect(code).toContain("Razlog je obvezen");
  });

  test("⑬ ročni odgovor konzultacije je iskreno razkrit (vir manual)", async () => {
    const code = await src("src/app/[locale]/admin/page.tsx");
    expect(code).toContain('"/api/admin/consultations"');
    expect(code).toContain("dopolnil skrbnik");
  });
});

// ── /za-ponudnike: prijavnica partnerja ─────────────────────────────────────

describe("p0h-ui [source-contract]: prijavnica na /za-ponudnike", () => {
  test("⑭ prijavnica pošlje na /api/partner/apply (seja obvezna, sporočilo neobvezno)", async () => {
    const code = await src("src/app/[locale]/za-ponudnike/page.tsx");
    expect(code).toContain('"/api/partner/apply"');
    expect(code).toContain("neobvezno");
  });

  test("⑮ brez seje: iskren poziv k prijavi (ne lažnega obrazca)", async () => {
    const code = await src("src/app/[locale]/za-ponudnike/page.tsx");
    expect(code).toContain('sessionStatus === "unauthenticated"');
    expect(code).toContain("Najprej se prijavi");
  });

  test("⑯ po uspehu: iskren opis nadaljnjega postopka (ročna skrbniška odločitev)", async () => {
    const code = await src("src/app/[locale]/za-ponudnike/page.tsx");
    expect(code).toContain("čaka na skrbniški pregled");
    expect(code).toContain("ROČNA odločitev skrbnika");
  });
});
