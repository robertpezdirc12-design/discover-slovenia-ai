/**
 * ACCESSIBILITY CONTRACT — map and discovery-card motion.
 *
 * These source guards protect the reduced-motion fallback and visible keyboard
 * focus for the most-used map controls. They complement, but do not replace,
 * real browser and E2E interaction tests.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAP = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8"
);
const HOME = readFileSync(
  join(import.meta.dir, "../src/components/home/home-view.tsx"),
  "utf8"
);

describe("map control accessibility", () => {
  test("filter and layer controls provide visible focus and respect reduced motion", () => {
    expect(MAP).toContain(
      "transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    );
  });

  test("retry controls and destination rows have the same focus/motion support", () => {
    expect(MAP).toContain(
      "transition-colors motion-reduce:transition-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    );
    expect(MAP).toContain(
      "transition-all duration-200 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    );
  });
});

describe("homepage feature card motion", () => {
  test("featured destination card and arrow remain still when reduced motion is preferred", () => {
    expect(HOME).toContain(
      "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    );
    expect(HOME).toContain(
      "motion-reduce:translate-x-0 motion-reduce:transition-none"
    );
  });
});
