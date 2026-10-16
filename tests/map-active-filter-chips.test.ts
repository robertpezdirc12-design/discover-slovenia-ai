/**
 * MAP ACTIVE FILTER CHIPS — each active query filter can be removed alone.
 * Source contracts complement browser-level map/list behavior tests.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAP = readFileSync(join(import.meta.dir, "../src/components/map/travel-map.tsx"), "utf8");

describe("map active filter chips", () => {
  test("active filter group and labels are localized in all six languages", () => {
    expect(MAP).toContain('role="group"');
    expect(MAP).toContain('aria-label={t("activeFiltersLabel")}');
    for (const dict of [
      'activeFiltersLabel: { sl: "Aktivni filtri", en: "Active filters", it: "Filtri attivi", de: "Aktive Filter", fr: "Filtres actifs", es: "Filtros activos" }',
      'searchPrefix: { sl: "Iskanje", en: "Search", it: "Ricerca", de: "Suche", fr: "Recherche", es: "Búsqueda" }',
      'regionPrefix: { sl: "Regija", en: "Region", it: "Regione", de: "Region", fr: "Région", es: "Región" }',
      'countryPrefix: { sl: "Država", en: "Country", it: "Paese", de: "Land", fr: "Pays", es: "País" }',
      'typePrefix: { sl: "Tip", en: "Type", it: "Tipo", de: "Typ", fr: "Type", es: "Tipo" }',
    ]) expect(MAP).toContain(dict);
  });

  test("search, country, region and type chips remove only their corresponding filter", () => {
    expect(MAP).toContain('onClick={() => setQ("")}');
    expect(MAP).toContain('onClick={() => setCountry("all")}');
    expect(MAP).toContain('onClick={() => setRegion("all")}');
    expect(MAP).toContain('onClick={() => setType("all")}');
    expect(MAP).toContain('aria-label={t("removeFilter")(t("searchPrefix"), q.trim())}');
    expect(MAP).toContain('aria-label={t("removeFilter")(t("countryPrefix"), (activeCountries.includes(country');
    expect(MAP).toContain('aria-label={t("removeFilter")(t("regionPrefix"), regionLabel(region, l))}');
    expect(MAP).toContain('aria-label={t("removeFilter")(t("typePrefix"), typeLabel(type, l))}');
  });

  test("filter chips appear only when a filter is active and preserve the existing reset/query sync", () => {
    expect(MAP).toContain("{hasFilters && (");
    expect(MAP).toContain("const hasFilters = q.trim() !== \"\" || type !== \"all\" || region !== \"all\" || country !== \"all\"");
    expect(MAP).toContain('window.history.replaceState(window.history.state, "", nextUrl)');
    expect(MAP).toContain('className="h-8 max-w-full gap-1.5 rounded-full border-primary/25 bg-primary/[0.04]"');
  });
});
