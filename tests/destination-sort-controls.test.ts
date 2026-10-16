/**
 * DESTINATION SORT CONTROLS — default order stability and accessible localized UI.
 * Source contracts complement runtime behavior checks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const EXPLORER = readFileSync(
  join(import.meta.dir, "../src/components/destinations-explorer.tsx"),
  "utf8",
);

describe("destination discovery: sort controls", () => {
  test("keeps the curated default order unless a sort choice is selected", () => {
    expect(EXPLORER).toContain('const sortParam = searchParams.get("sort")');
    expect(EXPLORER).toContain('sortParam === "name-asc" || sortParam === "name-desc"');
    expect(EXPLORER).toContain("useState<DestinationSort>(");
    expect(EXPLORER).toContain('const ordered = [...filteredResults]');
    expect(EXPLORER).toContain('if (sortBy === "name-asc")');
    expect(EXPLORER).toContain('else if (sortBy === "name-desc")');
    expect(EXPLORER).toContain('}, [filteredResults, sortBy, l]);');
  });

  test("sort control is labeled for assistive technology and exposes all choices", () => {
    expect(EXPLORER).toContain('htmlFor="dest-sort"');
    expect(EXPLORER).toContain('id="dest-sort"');
    for (const option of ['value="recommended"', 'value="name-asc"', 'value="name-desc"']) {
      expect(EXPLORER).toContain(option);
    }
  });

  test("sort labels cover all six supported locales", () => {
    for (const key of ["sortLabel", "sortRecommended", "sortNameAsc", "sortNameDesc"]) {
      const line = EXPLORER.split("\n").find((value) => value.includes(key + ": {"));
      expect(line, key).toBeDefined();
      for (const locale of ["sl:", "en:", "it:", "de:", "fr:", "es:"]) {
        expect(line, key + " " + locale).toContain(locale);
      }
    }
  });

  test("alphabetical sort uses active-language collation and preserves records", () => {
    expect(EXPLORER).toContain('a.name.localeCompare(b.name, l, { sensitivity: "base", numeric: true })');
    expect(EXPLORER).toContain('b.name.localeCompare(a.name, l, { sensitivity: "base", numeric: true })');
    expect(EXPLORER).toContain('aria-live="polite"');
  });
});
