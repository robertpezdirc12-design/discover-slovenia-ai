/**
 * MY TRIP ADD FEEDBACK — consistent confirmation and a direct way to continue.
 * These source contracts complement browser-level interaction testing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const read = (path: string) => readFileSync(join(import.meta.dir, path), "utf8");
const ACTION = read("../src/components/my-trip-toast-action.tsx");
const DETAIL = read("../src/components/destination-detail.tsx");
const MAP = read("../src/components/map/travel-map.tsx");
const VENUES = read("../src/components/lokali-explorer.tsx");
const MARKET = read("../src/components/trznica-explorer.tsx");

describe("add-to-my-trip feedback", () => {
  test("shared toast action opens the localized My Trip hub", () => {
    expect(ACTION).toContain('import { ToastAction } from "@/components/ui/toast"');
    expect(ACTION).toContain('import { Link } from "@/i18n/navigation"');
    expect(ACTION).toContain('href="/moja-potovanja"');
    expect(ACTION).toContain("altText={label} asChild");
    for (const locale of ["sl:", "en:", "it:", "de:", "fr:", "es:"]) {
      expect(ACTION).toContain(locale);
    }
  });

  test("destination detail confirms only a successful new addition and keeps live state in sync", () => {
    expect(DETAIL).toContain('import { MY_TRIP_CHANGED_EVENT, myTrip } from "@/lib/my-trip"');
    expect(DETAIL).toContain('import { useToast } from "@/hooks/use-toast"');
    expect(DETAIL).toContain("window.addEventListener(MY_TRIP_CHANGED_EVENT, refresh)");
    expect(DETAIL).toContain('if (res.ok) {\n      setInTrip(true);\n      toast({ title: pick(l, L.toastAdded), action: <MyTripToastAction /> });');
    expect(DETAIL).toContain("disabled={inTrip}");
  });

  test("map, venues and experiences share the same next-step action", () => {
    for (const source of [MAP, VENUES, MARKET]) {
      expect(source).toContain('import { MyTripToastAction } from "@/components/my-trip-toast-action"');
      expect(source).toContain("action: <MyTripToastAction />");
      expect(source).toContain("if (res.ok) {");
    }
    expect(MAP).toContain("disabled={inTrip}");
    expect(VENUES).toContain("disabled={added}");
    expect(MARKET).toContain("disabled={added}");
  });
});
