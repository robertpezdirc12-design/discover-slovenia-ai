/**
 * MAP SHARE LINK — share the actual filter state without unrelated query data.
 * These source contracts complement native-share and clipboard browser checks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAP = readFileSync(join(import.meta.dir, "../src/components/map/travel-map.tsx"), "utf8");
const SHARE = readFileSync(join(import.meta.dir, "../src/lib/share-link.ts"), "utf8");

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
    const shareStart = MAP.indexOf("const shareMapView = () => {");
    const shareBody = MAP.slice(shareStart, MAP.indexOf("\n  };", shareStart) + 5);
    expect(shareBody).toContain("new URL(window.location.pathname, window.location.origin)");
    expect(shareBody).not.toContain("window.location.href");
    expect(shareBody).toContain("shareOrCopyLink({");
  });

  test("native share and clipboard fallback are centralized and report success/errors", () => {
    expect(MAP).toContain('import { shareOrCopyLink } from "@/lib/share-link"');
    expect(SHARE).toContain('if (typeof navigator.share === "function")');
    expect(SHARE).toContain("await navigator.share({ title, text, url })");
    expect(SHARE).toContain('error.name === "AbortError"');
    expect(SHARE).toContain("await navigator.clipboard.writeText(url)");
    expect(SHARE).toContain("toast({ title: copiedMessage })");
    expect(SHARE).toContain('toast({ title: errorMessage, variant: "destructive" })');
  });
});
