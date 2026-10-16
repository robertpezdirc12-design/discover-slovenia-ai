/**
 * DESTINATION SEARCH CLEAR — accessible, localized inline clear control.
 * Source-level contract; actual click/focus behavior still needs browser QA.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const EXPLORER = readFileSync(
  join(import.meta.dir, "../src/components/destinations-explorer.tsx"),
  "utf8",
);

describe("destination discovery: inline search clear", () => {
  test("clear control appears only when the search has content", () => {
    expect(EXPLORER).toContain("{q.length > 0 && (");
    expect(EXPLORER).toContain('onClick={() => setQ("")}');
  });

  test("search input reserves space so text does not overlap the clear icon", () => {
    expect(EXPLORER).toContain('pl-10 pr-10 shadow-sm focus-visible:ring-primary');
    expect(EXPLORER).toContain('className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 rounded-full');
  });

  test("button has an accessible localized name in all six locales", () => {
    expect(EXPLORER).toContain("aria-label={pick(l, L.clearSearch)}");
    const line = EXPLORER.split("\n").find((value) => value.includes("clearSearch: {"));
    expect(line).toBeDefined();
    for (const locale of ["sl:", "en:", "it:", "de:", "fr:", "es:"]) {
      expect(line).toContain(locale);
    }
  });

  test("close icon is decorative and focus stays visible", () => {
    expect(EXPLORER).toContain('<X className="size-4" aria-hidden="true" />');
    expect(EXPLORER).toContain('focus-visible:ring-primary');
  });
});
