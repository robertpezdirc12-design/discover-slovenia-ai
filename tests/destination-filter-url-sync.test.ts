/**
 * DESTINATION FILTER URL SYNC — shareable filter state without network requests.
 * Source-contract checks complement Next.js browser navigation tests.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const EXPLORER = readFileSync(
  join(import.meta.dir, "../src/components/destinations-explorer.tsx"),
  "utf8",
);

describe("destination discovery: filter URL synchronization", () => {
  test("keeps text, country, region and type in sync with the current URL", () => {
    expect(EXPLORER).toContain("React.useEffect(() => {");
    expect(EXPLORER).toContain("const url = new URL(window.location.href)");
    expect(EXPLORER).toContain("q: q.trim()");
    expect(EXPLORER).toContain("country,");
    expect(EXPLORER).toContain("region,");
    expect(EXPLORER).toContain("type,");
    expect(EXPLORER).toContain("}, [q, country, region, type]);");
  });

  test("removes inactive filters and avoids accumulating history entries", () => {
    expect(EXPLORER).toContain('if (!value || value === "all") url.searchParams.delete(key)');
    expect(EXPLORER).toContain('url.searchParams.set(key, value)');
    expect(EXPLORER).toContain('window.history.replaceState(window.history.state, "", nextUrl)');
    expect(EXPLORER).not.toContain("window.history.pushState");
  });

  test("preserves unrelated query parameters, path, and hash", () => {
    expect(EXPLORER).toContain("const url = new URL(window.location.href)");
    expect(EXPLORER).toContain('const nextUrl = `${url.pathname}${url.search}${url.hash}`');
    expect(EXPLORER).toContain('if (nextUrl !== currentUrl)');
    expect(EXPLORER).toContain('url.searchParams.delete(key)');
  });

  test("documents that filter interaction stays local and non-networked", () => {
    expect(EXPLORER).toContain("Filtriranje ostane lokalno in brez omrežnih zahtev");
    expect(EXPLORER).toContain("filterDestinations(DESTINATIONS, { q, region, type, country })");
  });
});
