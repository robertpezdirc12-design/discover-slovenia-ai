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
const PLANNER = read("../src/app/[locale]/nacrtuj/view.tsx");
const GENERIC_BUTTON = read("../src/components/content/add-to-trip-button.tsx");
const SHARED_TRIP = read("../src/components/content/shared-trip-view.tsx");

describe("add-to-my-trip feedback", () => {
  test("shared toast action opens the localized My Trip hub", () => {
    expect(ACTION).toContain('import { ToastAction } from "@/components/ui/toast"');
    expect(ACTION).toContain('import { Link } from "@/i18n/navigation"');
    expect(ACTION).toContain('href="/moja-potovanja"');
    expect(ACTION).toContain("altText={label} asChild");
    expect(ACTION).toContain("export function notifyMyTripAdded(locale: string): void");
    expect(ACTION).toContain("title: pick(locale, ADDED)");
    expect(ACTION).toContain("description: pick(locale, LOCAL_STORAGE_NOTE)");
    for (const note of [
      "Shranjeno samo v tem brskalniku; ni povezano z računom.",
      "Saved in this browser only; not linked to an account.",
      "Salvato solo in questo browser; non collegato a un account.",
      "Nur in diesem Browser gespeichert; nicht mit einem Konto verknüpft.",
      "Enregistré uniquement dans ce navigateur ; non lié à un compte.",
      "Guardado solo en este navegador; no está vinculado a una cuenta.",
    ]) expect(ACTION).toContain(note);
    for (const locale of ["sl:", "en:", "it:", "de:", "fr:", "es:"]) {
      expect(ACTION).toContain(locale);
    }
  });

  test("destination detail has success-only feedback and same-tab state synchronization", () => {
    expect(DETAIL).toContain('import { MY_TRIP_CHANGED_EVENT, myTrip } from "@/lib/my-trip"');
    expect(DETAIL).toContain("window.addEventListener(MY_TRIP_CHANGED_EVENT, refresh)");
    expect(DETAIL).toContain("if (res.ok) {");
    expect(DETAIL).toContain("notifyMyTripAdded(l)");
    expect(DETAIL).toContain("disabled={inTrip}");
  });

  test("map, venues and marketplace use the common confirmation and prevent duplicate clicks", () => {
    for (const source of [MAP, VENUES, MARKET]) {
      expect(source).toContain('import { notifyMyTripAdded } from "@/components/my-trip-toast-action"');
      expect(source).toContain("notifyMyTripAdded(l)");
      expect(source).toContain("if (res.ok) {");
    }
    expect(MAP).toContain("disabled={inTrip}");
    expect(VENUES).toContain("disabled={added}");
    expect(MARKET).toContain("disabled={added}");
  });

  test("generic content cards and shared-trip adds use the same feedback and same-tab sync", () => {
    expect(GENERIC_BUTTON).toContain("notifyMyTripAdded(locale)");
    expect(GENERIC_BUTTON).toContain("window.addEventListener(MY_TRIP_CHANGED_EVENT, refresh)");
    expect(SHARED_TRIP).toContain("if (newAdds > 0) notifyMyTripAdded(l)");
    expect(SHARED_TRIP).toContain("if (res.ok) notifyMyTripAdded(locale)");
    expect(SHARED_TRIP).toContain("window.addEventListener(MY_TRIP_CHANGED_EVENT, refresh)");
  });

  test("planner confirms new additions and offers a persistent route back to My Trip", () => {
    expect(PLANNER).toContain("if (newAdds > 0) notifyMyTripAdded(l)");
    expect(PLANNER).toContain('openMyTrip: { sl: "Odpri mojo pot"');
    expect(PLANNER).toContain('<Link href="/moja-potovanja">{pick(l, L.openMyTrip)}</Link>');
  });
});
