/**
 * DESTINATION DETAIL META — country context and purpose-specific metadata icons.
 * These source contracts complement real browser accessibility/visual checks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const DETAIL = readFileSync(
  join(import.meta.dir, "../src/components/destination-detail.tsx"),
  "utf8",
);

describe("destination detail: country and practical metadata", () => {
  test("shows country using the canonical localized country-name helper", () => {
    expect(DETAIL).toContain('import { countryName } from "@/lib/countries-data"');
    expect(DETAIL).toContain('metaCountry: { sl: "Država", en: "Country", it: "Paese", de: "Land", fr: "Pays", es: "País" }');
    expect(DETAIL).toContain("value: countryName(l, d.country)");
    expect(DETAIL).toContain('key: "country", Icon: Flag');
  });

  test("gives each metadata field a purpose-specific icon", () => {
    for (const pair of [
      'key: "country", Icon: Flag',
      'key: "region", Icon: MapPin',
      'key: "type", Icon: Compass',
      'key: "duration", Icon: Clock',
      'key: "budget", Icon: Wallet',
      'key: "cost", Icon: Coins',
    ]) {
      expect(DETAIL).toContain(pair);
    }
    expect(DETAIL).toContain('<m.Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />');
  });

  test("prevents long localized metadata labels/values from overflowing", () => {
    expect(DETAIL).toContain('className="flex min-w-0 items-center gap-2.5"');
    expect(DETAIL).toContain('className="min-w-0"');
    expect(DETAIL).toContain('className="break-words text-sm font-bold"');
  });

  test("provides a localized route from destination detail to its map-filtered result", () => {
    expect(DETAIL).toContain('showOnMap: { sl: "Pokaži na zemljevidu", en: "Show on map", it: "Mostra sulla mappa", de: "Auf der Karte zeigen", fr: "Afficher sur la carte", es: "Mostrar en el mapa" }');
    expect(DETAIL).toContain('href={`/zemljevid?q=${encodeURIComponent(d.name)}&country=${d.country}&region=${encodeURIComponent(d.region)}`}');
    expect(DETAIL).toContain('<MapPin className="size-4" aria-hidden="true" />');
    expect(DETAIL).toContain('href={`/nacrtuj?dest=${d.slug}`}');
    expect(DETAIL).toContain('href={`/go?dest=${d.slug}`}');
  });

  test("preserves the existing editorial rating and destination data values", () => {
    expect(DETAIL).toContain("d.rating.toFixed(1)");
    expect(DETAIL).toContain("d.costPerPerson");
    expect(DETAIL).toContain("regionLabel(d.region, l)");
    expect(DETAIL).toContain("typeLabel(d.type, l)");
  });
});
