/**
 * MAP SHARE LINK — share the actual filter state without unrelated query data.
 * These source contracts complement native-share and clipboard browser checks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAP = readFileSync(join(import.meta.dir, "../src/components/map/travel-map.tsx"), "utf8");

describe("map share link", () => {
  test("share action copy and feedback are localized in all six languages", () => {
    for (const label of [
      'shareMap: { sl: "Deli ta pogled", en: "Share this view", it: "Condividi questa vista", de: "Ansicht teilen", fr: "Partager cette vue", es: "Compartir esta vista" }',
      'shareCopied: { sl: "Povezava do tega pogleda je kopirana.", en: "Link to this view copied.", it: "Link a questa vista copiato.", de: "Link zu dieser Ansicht kopiert.", fr: "Lien vers cette vue copié.", es: "Enlace a esta vista copiado." }',
      'shareError: { sl: "Povezave ni bilo mogoče deliti ali kopirati.", en: "Could not share or copy the link.", it: "Impossibile condividere o copiare il link.", de: "Der Link konnte nicht geteilt oder kopiert werden.", fr: "Impossible de partager ou copier le lien.", es: "No se pudo compartir ni copiar el enlace." }',
    ]) expect(MAP).toContain(label);
    expect(MAP).toContain('<Share2 className="size-4" aria-hidden="true" />');
    expect(MAP).toContain('onClick={() => void shareMapView()}');
  });

  test("shared URL carries current map filters and omits default choices", () => {
    expect(MAP).toContain('const url = new URL(window.location.pathname, window.location.origin)');
    expect(MAP).toContain('q: q.trim()');
    expect(MAP).toContain('type,\n      region,\n      country,');
    expect(MAP).toContain('if (!value || value === "all") url.searchParams.delete(key)');
    expect(MAP).toContain('else url.searchParams.set(key, value)');
    expect(MAP).not.toContain('new URL(window.location.href)');
  });

  test("native share is preferred, clipboard is fallback, and cancellation is silent", () => {
    expect(MAP).toContain('if (typeof navigator.share === "function")');
    expect(MAP).toContain('navigator.share({ title: t("shareTitle"), text: t("shareText"), url: shareUrl })');
    expect(MAP).toContain('if (error instanceof DOMException && error.name === "AbortError") return;');
    expect(MAP).toContain('await navigator.clipboard.writeText(shareUrl)');
    expect(MAP).toContain('toast({ title: t("shareCopied") })');
    expect(MAP).toContain('toast({ title: t("shareError"), variant: "destructive" })');
  });
});
