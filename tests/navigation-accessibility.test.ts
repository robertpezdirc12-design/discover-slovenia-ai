/**
 * ACCESSIBILITY CONTRACT — shared navigation controls.
 *
 * Locks the mobile navigation's active-page semantics and the focus/reduced-
 * motion states added to shared navigation controls. These are source-level
 * guards; runtime keyboard and viewport checks still belong in E2E/browser QA.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MOBILE_NAV = readFileSync(
  join(import.meta.dir, "../src/components/layout/mobile-tab-bar.tsx"),
  "utf8"
);
const LANGUAGE_SWITCHER = readFileSync(
  join(import.meta.dir, "../src/components/layout/language-switcher.tsx"),
  "utf8"
);
const FOOTER = readFileSync(
  join(import.meta.dir, "../src/components/layout/footer.tsx"),
  "utf8"
);

describe("mobile navigation accessibility", () => {
  test("primary and expanded-menu links expose the current page semantically", () => {
    const activePageBindings =
      MOBILE_NAV.match(/aria-current=\{isActive\(link\.href\) \? "page" : undefined\}/g) ?? [];
    expect(activePageBindings).toHaveLength(2);
  });

  test("More tab remains highlighted when a secondary section is open", () => {
    expect(MOBILE_NAV).toContain("const hasMoreActivePage = moreGroups.some");
    expect(MOBILE_NAV).toContain("moreOpen || hasMoreActivePage");
  });

  test("mobile tab controls have visible focus and reduced-motion fallbacks", () => {
    expect(MOBILE_NAV).toContain("focus-visible:ring-offset-2");
    expect(MOBILE_NAV).toContain("motion-reduce:transition-none");
    expect(MOBILE_NAV).toContain("motion-reduce:hover:scale-100");
  });
});

describe("language and footer navigation accessibility", () => {
  test("language switcher keeps a 44px-class touch target and visible keyboard focus", () => {
    expect(LANGUAGE_SWITCHER).toContain(
      "inline-flex h-11 min-w-11 items-center justify-center"
    );
    expect(LANGUAGE_SWITCHER).toContain("focus-visible:ring-offset-2");
    expect(LANGUAGE_SWITCHER).toContain("motion-reduce:transition-none");
  });

  test("footer links preserve long-word wrapping and expose focus/motion states", () => {
    expect(FOOTER).toContain("inline-block max-w-full min-h-6");
    expect(FOOTER).toContain("break-words");
    expect(FOOTER).toContain("focus-visible:ring-2");
    expect(FOOTER).toContain("motion-reduce:transition-none");
  });
});
