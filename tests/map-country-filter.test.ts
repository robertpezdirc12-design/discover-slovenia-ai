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

const SKELETON = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/zemljevid/view.tsx"),
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
    expect(MAP).toContain('const [country, setCountry] = React.useState<string>(searchParams.get("country") ?? "all")');
    expect(MAP).toContain("filterDestinations(DESTINATIONS, { q, type, region, country })");
    for (const label of [
      'sl: "Išči po imenu, opisu ali poudarkih"',
      'en: "Search by name, description or highlights"',
      'it: "Cerca per nome, descrizione o punti di forza"',
      'de: "Nach Name, Beschreibung oder Highlights suchen"',
      'fr: "Rechercher par nom, description ou points forts"',
      'es: "Busca por nombre, descripción o destacados"',
    ]) {
      expect(MAP).toContain(label);
    }
    expect(MAP).toContain('import { activeCountryKeys, filterDestinations } from "@/lib/destinations-filter"');
    expect(MAP).toContain("}, [q, type, region, country]);");
    expect(MAP).toContain('const hasFilters = q.trim() !== "" || type !== "all" || region !== "all" || country !== "all"');
  });

  test("map and destination discovery share accent-insensitive full-text search", () => {
    expect(MAP).toContain('import { activeCountryKeys, filterDestinations } from "@/lib/destinations-filter"');
    expect(MAP).toContain("filterDestinations(DESTINATIONS, { q, type, region, country })");
    expect(MAP).not.toContain("const needle = q.trim().toLowerCase()");
    expect(MAP).toContain("countryLabel(locale, d.country)");
    expect(MAP).toContain("countryLabel(l, d.country)");
  });

  test("clear-filters action resets country together with existing filters", () => {
    expect(MAP).toContain("setCountry(\"all\")");
    expect(MAP).toContain("setType(\"all\")");
    expect(MAP).toContain("setRegion(\"all\")");
  });

  test("wide desktop keeps search, region, country and reset/count in one row", () => {
    expect(MAP).toContain('lg:grid-cols-[minmax(200px,1fr)_auto_auto_auto]');
    expect(MAP).toContain('md:grid-cols-[1fr_auto_auto]');
    expect(MAP).toContain('className="h-11 col-span-2 md:col-span-1"');
  });

  test("country context is visible in both marker popups and synchronized list rows", () => {
    expect(MAP).toContain("{countryLabel(locale, d.country)}");
    expect(MAP).toContain("{countryLabel(l, d.country)} · {regionLabel(d.region, l)} · {typeLabel(d.type, l)}");
    expect(MAP).toContain("function DestinationPopup(");
    expect(MAP).toContain("aria-current={active ? \"true\" : undefined}");
  });

  test("filtered destinations drive map markers, viewport bounds and the synchronized list", () => {
    expect(MAP).toContain("<FitBounds dests={results} />");
    expect(MAP.match(/results\.map\(\(d\) =>/g)?.length ?? 0).toBe(2);
    expect(MAP).toContain("key={d.id}");
    expect(MAP).toContain("t(\"listTitle\")");
  });

  test("loading skeleton reserves the country selector and aligns large-screen columns", () => {
    expect(SKELETON).toContain('lg:grid-cols-[minmax(200px,1fr)_auto_auto_auto]');
    expect(SKELETON).toContain('className="h-12 w-full rounded-md"');
    expect(SKELETON).toContain('className="h-12 w-36 rounded-md md:w-56"');
    expect(SKELETON).toContain('className="col-span-2 h-12 w-full rounded-md md:col-span-1 md:w-48"');
    expect(SKELETON).toContain('className="hidden h-11 w-28 rounded-md md:block"');
  });

  test("country selector preserves the established mobile-first search/region row", () => {
    expect(MAP).toContain('className="mt-4 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm sm:p-4 md:grid-cols-[1fr_auto_auto] lg:grid-cols-[minmax(200px,1fr)_auto_auto_auto] lg:mt-8 max-lg:order-1"');
    expect(MAP).toContain('className="col-span-2 min-w-0 md:col-span-1"');
    expect(MAP).toContain('className="h-12 w-full rounded-xl border-border/70 bg-background shadow-sm md:w-48"');
  });
});
