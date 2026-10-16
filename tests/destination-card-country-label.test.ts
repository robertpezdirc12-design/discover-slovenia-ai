/**
 * DESTINATION CARD COUNTRY CONTEXT — visual badge and accessible link label.
 * Source contracts complement screenshot and keyboard testing in a real browser.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const CARD = readFileSync(
  join(import.meta.dir, "../src/components/destination-card.tsx"),
  "utf8",
);

describe("destination card: country context", () => {
  test("imports the canonical localized country label and name helpers", () => {
    expect(CARD).toContain('import { countryLabel, countryName } from "@/lib/countries-data"');
    expect(CARD).toContain("{countryLabel(l, d.country)}");
    expect(CARD).toContain("countryName(l, d.country)");
  });

  test("shows a compact country badge beside the featured marker", () => {
    expect(CARD).toContain('aria-hidden="true"');
    expect(CARD).toContain("absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2");
    expect(CARD).toContain('className={cn("ml-auto max-w-full truncate border-white/60 bg-background/90 text-foreground shadow-sm backdrop-blur-sm", d.featured && "max-w-[calc(50%-0.25rem)]")}');
    expect(CARD).toContain("max-w-[calc(50%-0.25rem)] truncate bg-primary text-primary-foreground");
    expect(CARD).toContain("{countryLabel(l, d.country)}");
  });

  test("reserves separate badge widths so long country names cannot overlap featured badges", () => {
    expect(CARD).toContain("justify-between gap-2");
    expect(CARD).toContain('d.featured && "max-w-[calc(50%-0.25rem)]"');
    expect(CARD).toContain("ml-auto max-w-full truncate");
    expect(CARD).not.toContain("absolute top-2.5 right-2.5");
    expect(CARD).not.toContain("absolute top-2.5 left-2.5");
  });

  test("accessible destination link name includes the translated country", () => {
    expect(CARD).toContain("aria-label={pick(l, L.toDetail)(d.name, countryName(l, d.country))}");
    const start = CARD.indexOf("toDetail: {");
    const end = CARD.indexOf("\n    },", start);
    const labels = CARD.slice(start, end);
    for (const locale of ["sl:", "en:", "it:", "de:", "fr:", "es:"]) {
      expect(labels).toContain(locale);
    }
    expect(labels.match(/\(name: string, country: string\)/g)?.length ?? 0).toBe(6);
  });

  test("keeps the existing destination detail route and card reduced-motion behavior", () => {
    expect(CARD).toContain('href={`/destinacija/${d.slug}`}');
    expect(CARD).toContain("motion-reduce:transition-none motion-reduce:hover:translate-y-0");
    expect(CARD).toContain("motion-reduce:group-hover:scale-100");
  });
});
