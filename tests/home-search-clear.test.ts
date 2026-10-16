/**
 * HOME HERO SEARCH CLEAR — keeps the primary discovery search easy to correct.
 * Source-contract guard; click and responsive browser behavior still require E2E QA.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const HOME = readFileSync(
  join(import.meta.dir, "../src/components/home/home-view.tsx"),
  "utf8",
);

describe("home: clear primary discovery search", () => {
  test("clear button only appears for non-empty search and clears the query", () => {
    expect(HOME).toContain("{query.length > 0 && (");
    expect(HOME).toContain('onClick={() => setQuery("")}');
    expect(HOME).toContain('value={query}');
  });

  test("hero input is width-safe and reserves room for the clear button", () => {
    expect(HOME).toContain('className="h-11 w-full border-none bg-transparent pr-10');
    expect(HOME).toContain("className=\"relative min-w-0 flex-1\"");
  });

  test("accessible clear label is localized across all six languages", () => {
    expect(HOME).toContain('aria-label={t("clearSearch")}');
    const blockStart = HOME.indexOf("clearSearch: {");
    expect(blockStart).toBeGreaterThan(-1);
    const block = HOME.slice(blockStart, HOME.indexOf("},", blockStart));
    for (const locale of ["sl:", "en:", "it:", "de:", "fr:", "es:"]) {
      expect(block).toContain(locale);
    }
  });

  test("clear button is separate from form submit and icon is decorative", () => {
    expect(HOME).toContain('type="button"\n                  variant="ghost"\n                  size="icon"\n                  aria-label={t("clearSearch")}');
    expect(HOME).toContain('<X className="size-4" aria-hidden="true" />');
    expect(HOME).toContain('id="hero-search"');
  });
});
