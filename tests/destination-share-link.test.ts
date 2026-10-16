/**
 * DESTINATION SHARING — the details page shares a clean, locale-aware link.
 * Source contracts complement real device share-sheet and clipboard tests.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const DETAIL = readFileSync(join(import.meta.dir, "../src/components/destination-detail.tsx"), "utf8");
const SHARE = readFileSync(join(import.meta.dir, "../src/lib/share-link.ts"), "utf8");

describe("destination share action", () => {
  test("a localized share action appears beside the destination navigation choices", () => {
    expect(DETAIL).toContain('import { shareOrCopyLink } from "@/lib/share-link"');
    expect(DETAIL).toContain('<Share2 className="size-4" aria-hidden="true" />');
    expect(DETAIL).toContain("onClick={shareDestination}");
    for (const label of [
      'shareDestination: { sl: "Deli destinacijo", en: "Share destination", it: "Condividi destinazione", de: "Reiseziel teilen", fr: "Partager la destination", es: "Compartir destino" }',
      'shareCopied: { sl: "Povezava do destinacije je kopirana.", en: "Destination link copied.", it: "Link della destinazione copiato.", de: "Link zum Reiseziel kopiert.", fr: "Lien de la destination copié.", es: "Enlace del destino copiado." }',
    ]) expect(DETAIL).toContain(label);
  });

  test("shared URL uses the current localized path and does not carry page query parameters", () => {
    const start = DETAIL.indexOf("const shareDestination = () => {");
    const body = DETAIL.slice(start, DETAIL.indexOf("\n  };", start) + 5);
    expect(body).toContain("new URL(window.location.pathname, window.location.origin)");
    expect(body).toContain("shareOrCopyLink({");
    expect(body).not.toContain("window.location.search");
    expect(body).toContain("${d.name}");
  });

  test("uses the shared native-share and clipboard fallback implementation", () => {
    expect(DETAIL).toContain("shareOrCopyLink({");
    expect(SHARE).toContain("navigator.share({ title, text, url })");
    expect(SHARE).toContain("navigator.clipboard.writeText(url)");
  });
});
