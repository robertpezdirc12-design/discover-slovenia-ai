/**
 * MAP FILTER URL STATE — country/type/region/search filters are shareable.
 * Source contracts complement real Next.js navigation and browser testing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAP = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8",
);

describe("map discovery: shareable filter state", () => {
  test("hydrates search and filters from the incoming URL", () => {
    expect(MAP).toContain('import { useSearchParams } from "next/navigation"');
    expect(MAP).toContain('const [q, setQ] = React.useState(searchParams.get("q") ?? "")');
    expect(MAP).toContain('const initialType = searchParams.get("type")');
    expect(MAP).toContain('React.useState<string>(searchParams.get("region") ?? "all")');
    expect(MAP).toContain('React.useState<string>(searchParams.get("country") ?? "all")');
  });

  test("re-hydrates current controls after client-side navigation", () => {
    expect(MAP).toContain('const nextQ = searchParams.get("q") ?? ""');
    expect(MAP).toContain('const nextCountry = searchParams.get("country") ?? "all"');
    expect(MAP).toContain('const nextRegion = searchParams.get("region") ?? "all"');
    expect(MAP).toContain('const rawType = searchParams.get("type")');
    expect(MAP).toContain("}, [searchParams]);");
    expect(MAP).toContain("setCountry((current) => (current === nextCountry ? current : nextCountry))");
  });

  test("persists non-default filters without adding one history entry per keystroke", () => {
    expect(MAP).toContain("const url = new URL(window.location.href)");
    expect(MAP).toContain('q: q.trim() ? q : "",');
    expect(MAP).toContain('if (!value || value === "all") url.searchParams.delete(key)');
    expect(MAP).toContain("url.searchParams.set(key, value)");
    expect(MAP).toContain('window.history.replaceState(window.history.state, "", nextUrl)');
    expect(MAP).not.toContain("window.history.pushState");
  });

  test("preserves unrelated query parameters and URL hash", () => {
    expect(MAP).toContain('const nextUrl = `${url.pathname}${url.search}${url.hash}`');
    expect(MAP).toContain('if (nextUrl !== currentUrl)');
  });

  test("keeps whitespace-only searches out of the URL but preserves in-progress input", () => {
    expect(MAP).toContain('q: q.trim() ? q : "",');
    expect(MAP).toContain('setQ((current) => (current === nextQ ? current : nextQ))');
  });
});
