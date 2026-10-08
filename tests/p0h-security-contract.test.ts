/**
 * P0H-SECURITY-CONTRACT (P0-H, issue #1 §22/§20) — fail-closed struktura
 * B2B tržnice (moderacija, partner portal, skrbniške poti, konzultacije).
 *
 * SOURCE-CONTRACT (pošteno označeno): DB-vezane poti v peskovniku niso
 * enotsko testabilne — zaklenemo STRUKTURO izvorne kode. Če kdo odstrani
 * varovalko (vrata seje, IDOR filter, skrbniški check, dnevno mejo),
 * regresijska mreža pade.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

// ── Javna tržnica: samo objavljeno ─────────────────────────────────────────

describe("p0h [source-contract]: javna tržnica vidi samo objavljeno", () => {
  test("① /api/products filtrira status published", async () => {
    const code = await src("src/app/api/products/route.ts");
    expect(code).toContain('where: { active: true, status: "published" }');
  });

  test("② seed ustvarja platforminske izdelke kot published (uredniško pregledani)", async () => {
    const code = await src("src/lib/marketplace-seed.ts");
    expect(code).toContain('status: "published"');
    // selitev nikoli ne dotakne partnerjevih vnosov
    expect(code).toContain("ownerId: null");
  });
});

// ── Partner portal: vrata + IDOR ───────────────────────────────────────────

describe("p0h [source-contract]: partner portal — vrata vloge + IDOR", () => {
  test("③ vse tri metode zahtevajo partner kontekst (403 sicer)", async () => {
    const code = await src("src/app/api/partner/products/route.ts");
    const gates = code.match(/getPartnerContext\(\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(3); // GET + POST + PATCH
    expect(code).toContain("Račun še ni odobren kot partner");
  });

  test("④ IDOR: PATCH vedno filtrira ownerId (tuj vnos = ne obstaja)", async () => {
    const code = await src("src/app/api/partner/products/route.ts");
    expect(code).toContain("where: { id: productId, ownerId: ctx.userId }");
  });

  test("⑤ GET vrne SAMO lastne vnose (where ownerId)", async () => {
    const code = await src("src/app/api/partner/products/route.ts");
    expect(code).toContain("where: { ownerId: ctx.userId }");
  });

  test("⑥ partner NIKOLI ne more objaviti (action le submit|withdraw)", async () => {
    const code = await src("src/app/api/partner/products/route.ts");
    expect(code).toContain('action !== "submit" && action !== "withdraw"');
    expect(code).not.toContain('"publish"');
  });

  test("⑦ prijava partnerja zahteva sejo (401) + dedup (409)", async () => {
    const code = await src("src/app/api/partner/apply/route.ts");
    expect(code).toContain("getSessionContext()");
    expect(code).toContain("status: 401");
    expect(code).toContain("status: 409");
  });

  test("⑧ vloga partner se bere iz baze ob vsakem zahtevku (ne iz JWT)", async () => {
    const code = await src("src/lib/partner-session.ts");
    expect(code).toContain('user?.role !== "partner"');
  });
});

// ── Skrbniške poti: DSA_ADMIN_EMAILS vrata ─────────────────────────────────

describe("p0h [source-contract]: skrbniške poti — isAdminSession vrata", () => {
  const adminRoutes = [
    "src/app/api/admin/listings/route.ts",
    "src/app/api/admin/leads/route.ts",
    "src/app/api/admin/consultations/route.ts",
  ];

  test("⑨ vse skrbniške poti preverijo isAdminSession (fail-closed 403)", async () => {
    for (const route of adminRoutes) {
      const code = await src(route);
      const gates = code.match(/isAdminSession\(\)/g) ?? [];
      expect(gates.length).toBeGreaterThanOrEqual(2); // GET + POST
      expect(code).toContain("status: 403");
    }
  });

  test("⑩ objava je izključno skrbniška (admin listings: publish/reject/unpublish)", async () => {
    const code = await src("src/app/api/admin/listings/route.ts");
    expect(code).toContain('action === "publish"');
    expect(code).toContain('canActorTransitionListing(current, to, "admin")');
    // zavrnitev ZAHTEVA razlog, viden partnerju
    expect(code).toContain("Zavrnitev potrebuje razlog");
  });

  test("⑪ approve dvigne vlogo SAMO prek skrbniške poti (transaction)", async () => {
    const code = await src("src/app/api/admin/leads/route.ts");
    expect(code).toContain('role: "partner"');
    expect(code).toContain("$transaction");
    // uporabnik brez računa → iskrena 409, ne tiha prijava
    expect(code).toContain("še nima računa");
  });
});

// ── Konzultacije: dnevna meja + zasebnost ──────────────────────────────────

describe("p0h [source-contract]: konzultacije — meja + zasebnost", () => {
  test("⑫ dnevna omejitev 3/dan na e-pošto (UTC dan) je dejansko v poti", async () => {
    const code = await src("src/app/api/consultation/route.ts");
    expect(code).toContain("utcDayStart()");
    expect(code).toContain("CONSULTATION_DAILY_LIMIT");
    expect(code).toContain("status: 429");
  });

  test("⑬ odgovor se izroči ob ustvarjanju kot fallback (deterministično)", async () => {
    const code = await src("src/app/api/consultation/route.ts");
    expect(code).toContain("buildConsultationFallbackAnswer(input)");
    expect(code).toContain('answerSource: "fallback"');
  });

  test("⑭ zasebna stran NE vrača e-pošte pošiljatelja (samo poznalec žetona)", async () => {
    const code = await src("src/app/api/consultation/[token]/route.ts");
    expect(code).not.toContain("c.email");
  });

  test("⑮ skrbniški ročni odgovor je iskreno razkrit (answerSource manual)", async () => {
    const code = await src("src/app/api/admin/consultations/route.ts");
    expect(code).toContain('answerSource: "manual"');
    expect(code).toContain("consultation.answered");
  });
});

// ── Semafor: AuditLog na vseh dejanjih ─────────────────────────────────────

describe("p0h [source-contract]: revizijska sled na vseh dejanjih", () => {
  test("⑯ vsaka partner/skrbnik pot piše AuditLog", async () => {
    const routes = [
      "src/app/api/partner/apply/route.ts",
      "src/app/api/partner/products/route.ts",
      "src/app/api/admin/listings/route.ts",
      "src/app/api/admin/leads/route.ts",
      "src/app/api/admin/consultations/route.ts",
      "src/app/api/consultation/route.ts",
    ];
    for (const route of routes) {
      const code = await src(route);
      expect(code).toContain("auditLog.create");
    }
  });
});
