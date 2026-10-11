import { describe, expect, test } from "bun:test";

/**
 * POLIR B (2.28.0) — „Podprta povezava" čip ob vsakem affiliate CTA (FTC).
 *
 * SOURCE-CONTRACT (kanon tests/trip-chat-rate-limit.test.ts): UI komponente
 * so "use client" elementi — zaklenemo STRUKTURO izvorne kode:
 *  · vsaka od 3 datotek z /api/affiliate/go CTA vsebuje AffiliateChip;
 *  · affiliate-chip.tsx nosi besedilo v 6 jezikih po vzorcu pick (i18n-pick);
 *  · čip je povezava na /zaupanje-in-varnost (celotno razkritje) in višine
 *    ≥24 px (min-h-6 — hišni a11y kanon tap tarč).
 * 0 omrežja — testi berejo izključno izvorno kodo.
 */

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

/** Datoteke z affiliate CTA (/api/affiliate/go) — vsaka mora imeti čip. */
const CTA_FILES = [
  "src/components/home/home-view.tsx",
  "src/components/map/travel-map.tsx",
  "src/components/destination-detail.tsx",
] as const;

describe("POLIR B [source-contract]: čip „Podprta povezava“ ob vseh affiliate CTA", () => {
  test("① vsaka datoteka z /api/affiliate/go izrisa AffiliateChip ob CTA", async () => {
    for (const f of CTA_FILES) {
      const code = await src(f);
      expect(code).toContain("/api/affiliate/go");
      expect(code).toContain("<AffiliateChip");
    }
  });

  test("② vse 3 datoteke uvozijo SKUPNO komponento (doslednost, 1 vir resnice)", async () => {
    for (const f of CTA_FILES) {
      const code = await src(f);
      expect(code).toContain(
        'import { AffiliateChip } from "@/components/affiliate-chip"',
      );
    }
  });

  test("③ besedilo čipa v 6 jezikih (sl/en/it/de/fr/es — kanon pick)", async () => {
    const code = await src("src/components/affiliate-chip.tsx");
    expect(code).toContain('sl: "Podprta povezava"');
    expect(code).toContain('en: "Supported link"');
    expect(code).toContain('it: "Link sponsorizzato"');
    expect(code).toContain('de: "Gesponserter Link"');
    expect(code).toContain('fr: "Lien sponsorisé"');
    expect(code).toContain('es: "Enlace patrocinado"');
    expect(code).toContain("pick(l, CHIP_TEXT.label)");
  });

  test("④ aria-label z daljšo razlago v 6 jezikih (provizija, zunanji ponudnik, brezplačno načrtovanje)", async () => {
    const code = await src("src/components/affiliate-chip.tsx");
    // slovenska resnica (kanon) — celoten stavek:
    expect(code).toContain(
      "Povezava podprta z morebitno provizijo — zunanji ponudnik; načrtovanje je vedno brezplačno.",
    );
    // ostali jeziki: vsak nosi ključne pojme (provizija + zunanji + brezplačno)
    expect(code).toContain("possible commission — external provider");
    expect(code).toContain("possibile commissione — fornitore esterno");
    expect(code).toContain("mögliche Provision unterstützter Link — externer Anbieter");
    expect(code).toContain("éventuelle commission — fournisseur externe");
    expect(code).toContain("posible comisión — proveedor externo");
    // aria-label je res pripet na povezavo:
    expect(code).toContain("aria-label={pick(l, CHIP_TEXT.aria)}");
  });

  test("⑤ čip je povezava na /zaupanje-in-varnost (celotno razkritje)", async () => {
    const code = await src("src/components/affiliate-chip.tsx");
    expect(code).toContain('href="/zaupanje-in-varnost"');
    // ciljna stran res obstaja (obljuba „vedno jasno označeno" živi tam):
    const page = await Bun.file(
      "src/app/[locale]/zaupanje-in-varnost/page.tsx",
    ).exists();
    expect(page).toBe(true);
  });

  test("⑥ višina ≥24 px (min-h-6) in ikona lucide — diskretna a dostopna tipka", async () => {
    const code = await src("src/components/affiliate-chip.tsx");
    expect(code).toContain("min-h-6");
    expect(code).toContain("HandCoins");
    expect(code).toContain('aria-hidden="true"');
    expect(code).toContain("Badge"); // shadcn kanon (variant outline)
  });

  test("⑦ razkritje ostaja tudi tam, kjer je bilo že prej (trip-reservations nedotaknjen)", async () => {
    // kontrola: rezervacijska plošča še vedno nosi svoje razkritje (nikoli
    // ne odstranjujemo razkritij ob dodajanju čipa)
    const code = await src("src/components/trips/trip-reservations.tsx");
    expect(code).toContain("/api/affiliate/go");
  });
});
