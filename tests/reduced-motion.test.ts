/**
 * ACCESSIBILITY CONTRACT — respect system reduced-motion preferences.
 * This is a source contract for the global CSS utility because the media
 * preference must apply consistently across every route and shared control.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const GLOBALS = readFileSync(
  join(import.meta.dir, "../src/app/globals.css"),
  "utf8"
);

describe("global reduced-motion preference", () => {
  test("uses the native prefers-reduced-motion media query", () => {
    expect(GLOBALS).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("limits animation and transition motion without disabling interaction", () => {
    expect(GLOBALS).toContain("animation-duration: 0.01ms !important;");
    expect(GLOBALS).toContain("animation-iteration-count: 1 !important;");
    expect(GLOBALS).toContain("transition-duration: 0.01ms !important;");
    expect(GLOBALS).toContain("transition-delay: 0ms !important;");
    expect(GLOBALS).toContain("scroll-behavior: auto !important;");
  });
});
