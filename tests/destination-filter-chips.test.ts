/**
 * DESTINATION FILTER CHIPS — independent removal + localized accessible labels.
 * Source-contract tests complement runtime keyboard/browser QA.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const EXPLORER = readFileSync(
  join(import.meta.dir, "../src/components/destinations-explorer.tsx"),
  "utf8",
);

describe("destination discovery: active filter chips", () => {
  test("shows an accessible group only when filters are active", () => {
    expect(EXPLORER).toContain('role="group"');
    expect(EXPLORER).toContain('aria-label={pick(l, L.activeFilters)}');
    expect(EXPLORER).toContain("{hasFilters && (");
  });

  test("each chip removes only its own search/filter state", () => {
    expect(EXPLORER).toContain('onClick={() => setQ("")}');
    expect(EXPLORER).toContain('onClick={() => setCountry("all")}');
    expect(EXPLORER).toContain('onClick={() => setRegion("all")}');
    expect(EXPLORER).toContain('onClick={() => setType("all")}');
    expect(EXPLORER).toContain("activeCountries.includes(country as (typeof activeCountries)[number])");
    expect(EXPLORER).toContain("Object.prototype.hasOwnProperty.call(REGIONS, region) ?");
    expect(EXPLORER).toContain("Object.prototype.hasOwnProperty.call(DEST_TYPES, type) ?");
  });

  test("labels are localized for all six supported languages", () => {
    for (const key of ["activeFilters", "queryChip", "countryChip", "regionChip", "typeChip", "removeFilter"]) {
      const line = EXPLORER.split("\n").find((value) => value.includes(key + ": {"));
      expect(line, key).toBeDefined();
      for (const locale of ["sl:", "en:", "it:", "de:", "fr:", "es:"]) {
        expect(line, key + " " + locale).toContain(locale);
      }
    }
  });

  test("chip text is constrained on narrow viewports and close icons are decorative", () => {
    expect(EXPLORER.match(/max-w-\[min\(55vw,280px\)\] truncate/g)?.length ?? 0).toBe(4);
    expect(EXPLORER.match(/aria-hidden="true"/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
