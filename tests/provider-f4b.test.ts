/**
 * PROVIDER-F4B TESTI — testni zaklepi faze 4b (#35, 2.62.0):
 * prijava ponudnika (javna prijavnica → Provider claimed/draft), skrbniška
 * moderacija (statusi + verify + prijave napak) in UI žica.
 *
 * SOURCE-CONTRACT (kanon hiše): DB-vezane poti v peskovniku niso enotsko
 * testabilne — zaklenemo STRUKTURO izvorne kode; čista prehodna logika
 * (provider-moderation) pa je enotsko testirana v polnosti.
 */

import { describe, expect, test } from "bun:test";

import {
  PROVIDER_ACTIONS,
  PROVIDER_REPORT_ACTIONS,
  canActorTransitionProvider,
  isProviderAction,
  isProviderReportAction,
  isProviderStatus,
  providerAuditAction,
  providerStatusAfter,
} from "../src/lib/provider-moderation";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

// ── Čista logika: prehodi statusov (vzorec listing-moderation) ──────────────

describe("provider-moderation: prehodi statusov", () => {
  test("kanonska dejanja in prijave napak", () => {
    expect(PROVIDER_ACTIONS).toEqual(["publish", "unpublish", "suspend", "verify"]);
    expect(PROVIDER_REPORT_ACTIONS).toEqual(["resolve", "dismiss"]);
  });

  test("draft → published (publish) in → suspended (suspend)", () => {
    expect(providerStatusAfter("draft", "publish")).toBe("published");
    expect(providerStatusAfter("draft", "suspend")).toBe("suspended");
    expect(providerStatusAfter("draft", "unpublish")).toBeNull();
  });

  test("published → draft (unpublish) in → suspended (suspend)", () => {
    expect(providerStatusAfter("published", "unpublish")).toBe("draft");
    expect(providerStatusAfter("published", "suspend")).toBe("suspended");
    expect(providerStatusAfter("published", "publish")).toBeNull();
  });

  test("suspended → published/draft; objava po ustavitvi je skrbniška", () => {
    expect(providerStatusAfter("suspended", "publish")).toBe("published");
    expect(providerStatusAfter("suspended", "unpublish")).toBe("draft");
    expect(providerStatusAfter("suspended", "suspend")).toBeNull();
  });

  test("verify NE spreminja statusa — samo verification + verifiedAt", () => {
    expect(providerStatusAfter("draft", "verify")).toBe("draft");
    expect(providerStatusAfter("published", "verify")).toBe("published");
    expect(providerStatusAfter("suspended", "verify")).toBe("suspended");
  });

  test("samo skrbnik opravlja prehode (fail-closed kanon)", () => {
    expect(canActorTransitionProvider("draft", "publish", "admin")).toBe(true);
    expect(providerStatusAfter("draft", "publish")).not.toBeNull();
  });

  test("audit dejanja po kanonu entity.verb", () => {
    expect(providerAuditAction("draft", "publish")).toBe("provider.publish");
    expect(providerAuditAction("published", "verify")).toBe("provider.verify");
  });

  test("varovalke tipov", () => {
    expect(isProviderAction("publish")).toBe(true);
    expect(isProviderAction("objavi")).toBe(false);
    expect(isProviderReportAction("resolve")).toBe(true);
    expect(isProviderReportAction("delete")).toBe(false);
    expect(isProviderStatus("draft")).toBe(true);
    expect(isProviderStatus("pending")).toBe(false);
  });
});

// ── SOURCE-CONTRACT: javna prijava /api/providers/apply ────────────────────

describe("f4b [source-contract]: javna prijava ponudnika", () => {
  test("① rate limit 5/min (javno pisanje)", async () => {
    const code = await src("src/app/api/providers/apply/route.ts");
    expect(code).toContain("rateLimited(request, 5)");
  });

  test("② prijava NIKOLI ne objavi: claimed + draft + bookingMode none", async () => {
    const code = await src("src/app/api/providers/apply/route.ts");
    expect(code).toContain('verification: "claimed"');
    expect(code).toContain('status: "draft"');
    expect(code).toContain('bookingMode: "none"');
  });

  test("③ valuta izpeljana na strežniku (COUNTRIES meta), ne odjemalsko", async () => {
    const code = await src("src/app/api/providers/apply/route.ts");
    expect(code).toContain("providerCurrency(d.countryCode)");
    expect(code).not.toMatch(/currency:\s*d\./); // odjemalec ne nastavlja valute
  });

  test("④ dedup kanon: geohash-7 + ime → 409 pri podvajanju", async () => {
    const code = await src("src/app/api/providers/apply/route.ts");
    expect(code).toContain("providerDedupKey(d.name, d.lat, d.lng)");
    expect(code).toContain("status: 409");
    expect(code).toContain("findUnique({ where: { dedupKey }");
  });

  test("⑤ državna vrata: samo kanon 10 (isCanonCountry)", async () => {
    const code = await src("src/app/api/providers/apply/route.ts");
    expect(code).toContain("isCanonCountry(d.countryCode)");
  });

  test("⑥ L1: podrobnost napake baze NE gre k odjemalcu", async () => {
    const code = await src("src/app/api/providers/apply/route.ts");
    expect(code).toContain("Prijava trenutno ni mogoča");
  });
});

// ── SOURCE-CONTRACT: skrbniška moderacija /api/admin/providers ─────────────

describe("f4b [source-contract]: skrbniška moderacija ponudnikov", () => {
  test("⑦ vrata seje na GET in POST (fail-closed, vzorec admin/listings)", async () => {
    const code = await src("src/app/api/admin/providers/route.ts");
    const gates = code.match(/isAdminSession\(\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(2);
  });

  test("⑧ prehodi skozi čisto logiko + 409 pri nedovoljenem", async () => {
    const code = await src("src/app/api/admin/providers/route.ts");
    expect(code).toContain("providerStatusAfter(from, action)");
    expect(code).toContain("status: 409");
  });

  test("⑨ verify: verified + verifiedAt (12-mesečni potek)", async () => {
    const code = await src("src/app/api/admin/providers/route.ts");
    expect(code).toContain('data.verification = "verified"');
    expect(code).toContain("data.verifiedAt = new Date()");
  });

  test("⑩ AuditLog na vsaki odločitvi (profile + prijave napak)", async () => {
    const code = await src("src/app/api/admin/providers/route.ts");
    const audits = code.match(/auditLog\.create/g) ?? [];
    expect(audits.length).toBeGreaterThanOrEqual(2);
    expect(code).toContain('entityType: "provider"');
    expect(code).toContain('entityType: "provider_report"');
  });

  test("⑪ prijava napak: samo open → resolved|dismissed (spor, ne resnica)", async () => {
    const code = await src("src/app/api/admin/providers/route.ts");
    expect(code).toContain('status: "open"');
    expect(code).toContain('"resolved"');
    expect(code).toContain('"dismissed"');
    expect(code).toContain("Prijava je že obdelana");
  });
});

// ── SOURCE-CONTRACT: UI žica ────────────────────────────────────────────────

describe("f4b [source-contract]: UI žica (prijavnica + admin zavihek)", () => {
  test("⑫ /za-ponudnike vsebuje prijavnico ponudnika", async () => {
    const code = await src("src/app/[locale]/za-ponudnike/view.tsx");
    expect(code).toContain("@/components/providers/provider-apply-form");
    expect(code).toContain("<ProviderApplyForm />");
  });

  test("⑬ prijavnica je iskrena: osnutek, ročni koordinati, dedup 409", async () => {
    const code = await src("src/components/providers/provider-apply-form.tsx");
    expect(code).toContain("/api/providers/apply");
    expect(code).toContain("draftBadge"); // iskreno stanje "osnutek — čaka pregled"
    expect(code).toContain("coordsHelp"); // ročni koordinati (faza 3 = Photon)
  });

  test("⑭ /admin ima zavihek Ponudniki z moderacijo + prijavami napak", async () => {
    const code = await src("src/app/[locale]/admin/view.tsx");
    expect(code).toContain('value="providers"');
    expect(code).toContain("<ProvidersPanel />");
    expect(code).toContain("ProvidersPanel()");
    expect(code).toContain('action: "verify"');
    expect(code).toContain('action: "resolve"');
    expect(code).toContain('action: "dismiss"');
  });
});

// ── SEO popravek 2.62.1: metadataBase ne sme padati na localhost ───────────

describe("f4b [seo-fix 2.62.1]: metadataBase origin", () => {
  test("layout metadataBase uporablja JSONLD_SITE_ORIGIN (produkcija), ne localhost", async () => {
    const code = await src("src/app/[locale]/layout.tsx");
    expect(code).toContain("metadataBase: new URL(JSONLD_SITE_ORIGIN)");
    expect(code).not.toContain("http://localhost:3000");
  });
  test("JSONLD_SITE_ORIGIN ostaja produkcijski fallback (kanon jsonld)", async () => {
    const code = await src("src/lib/jsonld.ts");
    expect(code).toContain('"https://i-feel-slovenia.vercel.app"');
  });
});
