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
const NAVIGATION = readFileSync(
  join(import.meta.dir, "../src/components/layout/navigation.tsx"),
  "utf8"
);
const DESTINATION_FILTERS = readFileSync(
  join(import.meta.dir, "../src/components/destinations-explorer.tsx"),
  "utf8"
);
const PROVIDER_FORM = readFileSync(
  join(import.meta.dir, "../src/components/providers/provider-apply-form.tsx"),
  "utf8"
);
const EVENTS = readFileSync(
  join(import.meta.dir, "../src/components/content/events-view.tsx"),
  "utf8"
);
const EXPERIENCES = readFileSync(
  join(import.meta.dir, "../src/components/content/experiences-view.tsx"),
  "utf8"
);
const GUIDES = readFileSync(
  join(import.meta.dir, "../src/components/content/guides-view.tsx"),
  "utf8"
);
const THINGS_TO_DO = readFileSync(
  join(import.meta.dir, "../src/components/content/things-to-do-detail.tsx"),
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

describe("search and provider form focus visibility", () => {
  test("homepage hero search never suppresses keyboard focus", () => {
    expect(HOME).toContain(
      'className="h-11 border-none bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 dark:bg-transparent"'
    );
    expect(HOME).not.toContain("focus-visible:ring-0");
  });

  test("destination and map search inputs use a clear primary focus ring", () => {
    expect(DESTINATION_FILTERS).toContain("focus-visible:ring-primary\"");
    expect(DESTINATION_FILTERS).not.toContain("focus-visible:ring-primary/30");
    expect(MAP).toContain("focus-visible:ring-primary\"");
    expect(MAP).not.toContain("focus-visible:ring-primary/30");
  });

  test("native provider selects use a clear focus ring with contrast offset", () => {
    expect(PROVIDER_FORM).toContain(
      "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    );
    expect(PROVIDER_FORM).not.toContain("focus-visible:ring-primary/30");
  });
});

describe("content-card image motion", () => {
  test("event, experience, guide and activity-detail images honor reduced motion", () => {
    for (const source of [EVENTS, EXPERIENCES, GUIDES, THINGS_TO_DO]) {
      expect(source).toContain(
        "motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      );
    }
  });
});

describe("homepage theme, preset and brand interaction motion", () => {
  test("theme and preset cards keep still under reduced-motion preference", () => {
    expect(HOME).toContain("motion-reduce:transition-none motion-reduce:hover:translate-y-0");
    expect(HOME).toContain("motion-reduce:transition-none motion-reduce:group-hover:scale-100");
  });

  test("brand mark and preset arrow suppress decorative movement", () => {
    expect(NAVIGATION).toContain("group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100");
    expect(HOME).toContain("motion-reduce:translate-x-0 motion-reduce:transition-none");
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
