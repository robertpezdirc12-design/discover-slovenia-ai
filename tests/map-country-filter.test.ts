/**
 * MAP COUNTRY FILTER — all Balkan destinations can be narrowed by country.
 * Source contracts complement browser testing of Leaflet bounds and controls.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAP = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8",
);

describe("map discovery: country filter", () => {
  test("country labels come from the canonical six-language country registry", () => {
    expect(MAP).toContain('import { countryLabel } from "@/lib/countries-data"');
    expect(MAP).toContain('allCountries: { sl: "Vse države", en: "All countries", it: "Tutti i paesi", de: "Alle Länder", fr: "Tous les pays", es: "Todos los países" }');
    expect(MAP).toContain('countryFilter: {');
    for (const locale of ['sl: "Filtriraj po državi"', 'en: "Filter by country"', 'it: "Filtra per paese"', 'de: "Nach Land filtern"', 'fr: "Filtrer par pays"', 'es: "Filtrar por país"']) {
      expect(MAP).toContain(locale);
    }
  });

  test("selector only offers countries represented in the destination register", () => {
    expect(MAP).toContain('import { activeCountryKeys } from "@/lib/destinations-filter"');
    expect(MAP).toContain("const activeCountries = React.useMemo(() => activeCountryKeys(DESTINATIONS), [])");
    expect(MAP).toContain("{activeCountries.map((c) => (");
    expect(MAP).toContain("{countryLabel(l, c)}");
    expect(MAP).toContain('aria-label={t("countryFilter")}');
  });

  test("country selection participates in map/list filtering and live result updates", () => {
    expect(MAP).toContain('const [country, setCountry] = React.useState<string>("all")');
    expect(MAP).toContain('if (country !== "all" && d.country !== country) return false');
    expect(MAP).toContain("}, [q, type, region, country]);");
    expect(MAP).toContain('const hasFilters = q.trim() !== "" || type !== "all" || region !== "all" || country !== "all"');
  });

  test("clear-filters action resets country together with existing filters", () => {
    expect(MAP).toContain("setCountry(\"all\")");
    expect(MAP).toContain("setType(\"all\")");
    expect(MAP).toContain("setRegion(\"all\")");
  });

  test("country selector preserves the established mobile-first search/region row", () => {
    expect(MAP).toContain('className="mt-4 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm sm:p-4 md:grid-cols-[1fr_auto_auto] lg:mt-8 max-lg:order-1"');
    expect(MAP).toContain('className="col-span-2 min-w-0 md:col-span-1"');
    expect(MAP).toContain('className="h-12 w-full rounded-xl border-border/70 bg-background shadow-sm md:w-48"');
  });
});
