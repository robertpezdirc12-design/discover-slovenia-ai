/**
 * CSP-CONTRACT — nonce Content-Security-Policy (issue #2 §9 priporočilo
 * »CSP nonce« iz docs/PRODUCT-AUDIT.md).
 *
 * DVE PLASTI:
 *  1. ENOTE (buildCspHeader — čista funkcija): direktive, dev/prod razlike,
 *     zavrnitev slabega nonce-a.
 *  2. SOURCE-CONTRACT (pošteno označeno, isti kanon kot sync-contract):
 *     middleware postavi nonce na ZAHTVEKO (mehanizem Next.js — skripte
 *     dobijo nonce samodejno) in na ODZIV; [locale] layout je dinamičen
 *     (SSG bi vseboval zastarel nonce → blokirane skripte); next-themes
 *     dobi nonce izrecno; inventura zunanjih virov zaklenjena (edini
 *     zunanji brskalniški vir = OSM ploščice; 0 absolutnih klientnih fetch).
 */

import { describe, expect, test } from "bun:test";

import { buildCspHeader } from "../src/lib/csp";

const NONCE = "dGhpc0lzQU5vbmNlVG9rZW4xMjM0NTY=";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("csp [enote]: buildCspHeader", () => {
  test("① vse direktive prisotne in v fiksnem vrstnem redu", () => {
    const csp = buildCspHeader({ nonce: NONCE });
    const directives = csp.split("; ").map((d) => d.split(" ")[0]);
    expect(directives).toEqual([
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "worker-src",
      "manifest-src",
      "object-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
      "upgrade-insecure-requests",
    ]);
  });

  test("② script-src: nonce + strict-dynamic, BREZ 'unsafe-inline'", () => {
    const csp = buildCspHeader({ nonce: NONCE });
    const scriptSrc = csp
      .split("; ")
      .find((d) => d.startsWith("script-src"))!
      .split(" ")
      .slice(1);
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    // 'unsafe-inline' v script-src bi izničilo celoten smisel CSP (XSS):
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test("③ determinizem (isti vhod → isti izhod) in vključitev nonce-a", () => {
    const a = buildCspHeader({ nonce: NONCE });
    const b = buildCspHeader({ nonce: NONCE });
    expect(a).toBe(b);
    expect(a).toContain(`'nonce-${NONCE}'`);
  });

  test("④ dev: 'unsafe-eval' za React Refresh, BREZ upgrade-insecure-requests", () => {
    const dev = buildCspHeader({ nonce: NONCE, dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  test("⑤ produkcija: BREZ 'unsafe-eval', Z upgrade-insecure-requests", () => {
    const prod = buildCspHeader({ nonce: NONCE, dev: false });
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  test("⑥ zunanji viri zaklenjeni: OSM (img) + OpenFreeMap PoC (img+connect)", () => {
    const csp = buildCspHeader({ nonce: NONCE });
    expect(csp).toContain(
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://tiles.openfreemap.org"
    );
    // Inventura 2026-10-14: EDINI klientni absolutni fetch = OpenFreeMap PoC
    // (#35 faza 1, vektorski zemljevid, ?zemljevid=vektorji — nalaga se šele
    // ob vstopu v PoC); vsi ostali zunanji API (vreme/OSRM/STO/FSQ) ostaja
    // strežniško prek /api/*.
    expect(csp).toContain("connect-src 'self' https://tiles.openfreemap.org");
    // Noben DRUG zunanji host v connect-src (OFM dovoljena izjema):
    const connect = csp
      .split("; ")
      .find((d) => d.startsWith("connect-src"))!;
    expect(
      connect.replace(/https:\/\/tiles\.openfreemap\.org/g, "")
    ).not.toMatch(/https?:\/\//);
  });

  test("⑦ trdna jedra: object-src 'none', frame-ancestors 'none', base-uri/form-action 'self'", () => {
    const csp = buildCspHeader({ nonce: NONCE });
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // style-src 'unsafe-inline' je ZAVESTNO (Tailwind/Leaflet/chart <style>)
    // — dokumentirano v src/lib/csp.ts; skripte so zaščitene z nonce.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  test("⑧ fail-closed: slab nonce (prazen/presledki/narekovaji) → napaka", () => {
    expect(() => buildCspHeader({ nonce: "" })).toThrow();
    expect(() => buildCspHeader({ nonce: "abc def" })).toThrow();
    expect(() => buildCspHeader({ nonce: "ab\"c" })).toThrow();
    expect(() => buildCspHeader({ nonce: "ab'c" })).toThrow();
    expect(() => buildCspHeader({ nonce: "a(b)c" })).toThrow();
  });
});

describe("csp [source-contract]: middleware + layout + next-themes", () => {
  test("⑨ middleware: nonce iz crypto.randomUUID (base64, brez '-'), CSP na ZAHTVEVKO in ODZIV", async () => {
    const mw = await src("src/middleware.ts");
    // nonce mora biti nepredvidljiv na zahtevo:
    expect(mw).toContain("crypto.randomUUID()");
    // '-' iz UUID ni dovoljen v CSP nonce → base64 (btoa):
    expect(mw).toContain("btoa(crypto.randomUUID())");
    // mehanizem Next.js: CSP na ZAHTVEVKI → Next sam pripne nonce skriptam:
    expect(mw).toContain('request.headers.set("content-security-policy", csp)');
    expect(mw).toContain('request.headers.set("x-nonce", nonce)');
    // brskalnik pa vidi glavo na odzivu:
    expect(mw).toContain('response.headers.set("content-security-policy", csp)');
    // kompozicija z next-intl (ne zamenjaj obstoječega botrenja):
    expect(mw).toContain("createMiddleware(routing)");
    expect(mw).toContain("intlMiddleware(request)");
  });

  test("⑩ [locale] layout: force-dynamic (SSG = zastarel nonce = blokirane skripte)", async () => {
    const layout = await src("src/app/[locale]/layout.tsx");
    expect(layout).toContain('export const dynamic = "force-dynamic"');
    // nonce se prebere z zahteve in poda naprej:
    expect(layout).toContain('(await headers()).get("x-nonce")');
  });

  test("⑪ next-themes dobi nonce IZRECNO (prop na ThemeProvider)", async () => {
    const layout = await src("src/app/[locale]/layout.tsx");
    expect(layout).toContain("nonce={nonce}");
    // next-themes 0.4.6 podpira nonce prop (dokazano v dist viru:
    // nonce: typeof window=="undefined"?m:"" — strežniški izris ga pripne).
  });

  test("⑫ matcher izključuje api/_next/_vercel/statiko (CSP samo na dokumentih)", async () => {
    const mw = await src("src/middleware.ts");
    expect(mw).toContain("/((?!api|_next|_vercel|.*\\\\..*).*)");
  });

  test("⑬ korenska 404: čista server komponenta (mila degradacija brez hidracije, dokumentirano)", async () => {
    const nf = await src("src/app/not-found.tsx");
    // Brez "use client" — statičen HTML z <a> povezavami deluje tudi brez JS:
    expect(nf).not.toContain('"use client"');
    expect(nf).toContain("<a");
  });

  test("⑭ inventura zunanjih virov ostaja zaklenjena (nov tile/CDN vir pade)", async () => {
    const cspLib = await src("src/lib/csp.ts");
    // en sam tile strežnik, spremenjen le skozi konstanto:
    expect(cspLib).toContain('export const CSP_TILE_HOSTS = "https://tile.openstreetmap.org"');
    const map = await src("src/components/map/travel-map.tsx");
    expect(map).toContain('url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"');
    // 0 absolutnih klientnih fetch po CELEM src/ (če kdo doda nov zunanji
    // klic, mora posodobiti connect-src v src/lib/csp.ts — ta test pade):
    const files = Array.from(new Bun.Glob("src/**/*.{ts,tsx}").scanSync("."));
    expect(files.length).toBeGreaterThan(200);
    const offenders: string[] = [];
    for (const f of files) {
      const text = await Bun.file(f).text();
      if (/fetch\(\s*["'`]https?:\/\//.test(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
