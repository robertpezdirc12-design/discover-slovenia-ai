/**
 * MAP-VECTOR-POC TESTI — testni zaklepi faze 1 PoC (#35, 2.63.0):
 * MapLibre GL JS + OpenFreeMap vektorski zemljevid (re-deizija 14. 10. 2026).
 *
 * KANON dokumenta #35:
 *  - verifikacija R35-F4A je refutirala "sprememba 1 URL" (OFM = vektorski)
 *  - re-deizija pot (a): MapLibre PoC — MERLJIV material za lastniško
 *    odločitev; NI zamenjava privzetega zemljevida
 *  - privzeti zemljevid OSTAJA Leaflet/OSMF (status quo) — PoC se nalaga
 *    ŠELE ob ?zemljevid=vektorji (pogojni dynamic ssr:false)
 *  - ATTRIBUTIONS.md je obveznost pred vsako menjavo; atribucija VEDNO vidna
 *  - CSP inventura 2026-10-14: EDINI klientni absolutni fetch = OFM PoC
 *
 * PLASTI: enote (buildCspHeader + CSP_MAPLIBRE_HOSTS) + source-contract
 * (PoC komponenta, view priklop, ATTRIBUTIONS.md, dokument).
 */

import { describe, expect, test } from "bun:test";

import { buildCspHeader, CSP_MAPLIBRE_HOSTS, CSP_TILE_HOSTS } from "../src/lib/csp";

const NONCE = "dGhpc0lzQU5vbmNlVG9rZW4xMjM0NTY=";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("poc-vector [enote]: CSP z OFM hostom", () => {
  test("① CSP_MAPLIBRE_HOSTS = EDEN host OFM (curl verifikacija 14. 10. 2026)", () => {
    // Vse pridobitve liberty stila (slog JSON, vektorski .pbf, glyphs, sprite,
    // NE raster) prihajajo iz istega hosta — verifikacija iz R35-F1:
    expect(CSP_MAPLIBRE_HOSTS).toBe("https://tiles.openfreemap.org");
    // Privzeti zemljevid (Leaflet) NI spremenjen:
    expect(CSP_TILE_HOSTS).toBe("https://tile.openstreetmap.org");
  });

  test("② connect-src: 'self' + OFM; img-src: OSM + OFM; worker blob: ostane", () => {
    const csp = buildCspHeader({ nonce: NONCE });
    expect(csp).toContain("connect-src 'self' https://tiles.openfreemap.org");
    expect(csp).toContain(
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://tiles.openfreemap.org",
    );
    // MapLibre worker prek blob URL — že pokrito, zaklenjeno:
    expect(csp).toContain("worker-src 'self' blob:");
  });

  test("③ noben drug zunanji host v connect-src (inventura 2026-10-14)", () => {
    const csp = buildCspHeader({ nonce: NONCE });
    const connect = csp
      .split("; ")
      .find((d) => d.startsWith("connect-src"))!;
    expect(
      connect.replace(/https:\/\/tiles\.openfreemap\.org/g, ""),
    ).not.toMatch(/https?:\/\//);
  });
});

describe("poc-vector [source-contract]: PoC komponenta", () => {
  test("④ use client + maplibre-gl + OFM liberty stil, brez drugih tile hostov", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain('"use client"');
    expect(s).toContain('from "maplibre-gl"');
    expect(s).toContain(
      'export const OFM_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"',
    );
    // NE vračanje k OSMF rasterju v vektorskem PoC-ju:
    expect(s).not.toContain("tile.openstreetmap.org");
  });

  test("⑤ atribucija VEDNO vidna: OSM contributors + OpenFreeMap (kanon #35)", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("customAttribution");
    expect(s).toContain("openstreetmap.org/copyright");
    expect(s).toContain("OpenFreeMap");
  });

  test("⑥ čistilna funkcija: map.remove() (StrictMode varen unmount)", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("map.remove()");
  });

  test("⑦ iskrenost PoC: eksperimentalna pasica + opomba o plasti, ki ostajajo", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("eksperimentalni vektorski zemljevid");
    expect(s).toContain("Plasti Lokali, Pot, Bencinske in POI ostajajo");
    expect(s).toContain("data-poc-banner");
  });

  test("⑧ pariteta: isti kanon DESTINATIONS + isti niz višin kot Leaflet", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("DESTINATIONS");
    expect(s).toContain("h-[62svh] min-h-80 w-full overflow-hidden rounded-xl sm:h-[70svh]");
    expect(s).toContain("lg:h-[calc(100svh-15rem)] lg:min-h-[540px]");
  });

  test("⑨ FR tu-kanon: brez vous/votre/êtes v novih oznakah", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).not.toMatch(/vous|votre|être|êtes/i);
  });
});

describe("poc-vector [source-contract]: mobilna uporabnost in funkcije", () => {
  test("markerji imajo površino za dotik, dostopno ime in dodajanje v Mojo pot", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain('document.createElement("button")');
    expect(s).toContain("h-11 w-11");
    expect(s).toContain('setAttribute("aria-label", d.name)');
    expect(s).toContain('setAttribute("data-destination-slug", d.slug)');
    expect(s).toContain("myTrip.add(d.slug, d.name, \"destination\", \"zemljevid\")");
    expect(s).toContain("notifyMyTripAdded(l)");
    expect(s).toContain("cooperativeGestures: true");
  });

  test("kontrole MapLibre imajo 44 px površino za dotik", async () => {
    const s = await src("src/app/globals.css");
    expect(s).toContain(".maplibregl-ctrl-group button");
    expect(s).toContain("width: 44px;");
    expect(s).toContain("height: 44px;");
  });
});

describe("poc-vector [source-contract]: priklop na /zemljevid", () => {
  test("⑩ privzeti izris = Leaflet; PoC ŠELE ob ?zemljevid=vektorji", async () => {
    const s = await src("src/app/[locale]/zemljevid/view.tsx");
    // pogojni preklop po hidraciji:
    expect(s).toContain('get("zemljevid") === "vektorji"');
    expect(s).toContain("vectorPoc ? <TravelMapVectorPoc /> : <TravelMap />");
    // oba next/dynamic ssr:false (Leaflet + MapLibre potrebujeta window):
    expect(s.match(/ssr: false/g)?.length).toBe(2);
    // privzeta vrednost stanja = false (Leaflet) — tudi SSR:
    expect(s).toContain("useState(false)");
  });

  test("⑪ skupni skelet za obe različici (0 premika ob preklopu)", async () => {
    const s = await src("src/app/[locale]/zemljevid/view.tsx");
    expect(s).toContain("function MapSkeleton()");
    expect(s.match(/loading: \(\) => <MapSkeleton \/>/g)?.length).toBe(2);
  });
});

describe("poc-vector [source-contract]: obveznosti kanona", () => {
  test("⑫ ATTRIBUTIONS.md: oba hosta + ODbL + datum verifikacije", async () => {
    const s = await src("ATTRIBUTIONS.md");
    expect(s).toContain("tiles.openfreemap.org");
    expect(s).toContain("tile.openstreetmap.org");
    expect(s).toContain("ODbL");
    expect(s).toContain("14. 10. 2026");
  });

  test("⑬ dokument #35: faza 1 = PoC oddan; faza 4 = 4a+4b zaključena", async () => {
    const doc = await src("docs/research/balkan-platform-no-ai.md");
    // faza 1 vrstica nosi PoC rezultat in lastniško odločitev:
    expect(doc).toContain("PoC ODDAN (2.63.0)");
    expect(doc).toContain("odločitev ŠE VEDNO lastniška");
    // faza 4 vrstica:
    expect(doc).toContain("4a+4b ZAKLJUČENA (2.61.0/2.62.0)");
    // SDK matrika MapLibre:
    expect(doc).toContain("PoC IZVEDEN (2.63.0)");
  });

  test("⑭ maplibre-gl v package.json pričakovane matrike (6.14.0)", async () => {
    const pkg = JSON.parse(await src("package.json"));
    expect(pkg.dependencies["maplibre-gl"]).toMatch(/^[\^~]?6\.14\.0/);
  });

  test("⑮ worker URL fix 2.63.1: config.WORKER_URL + datoteka v public/ z BSD glavo", async () => {
    // MapLibre v6 računa worker URL iz import.meta.url — v bundlerju pade
    // (odkrito z brskalniško verifikacijo produkcije 2.63.0, PR #55).
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("mlConfig.WORKER_URL = ML_WORKER_URL");
    expect(s).toContain('"/maplibre/maplibre-gl-worker.mjs?v=');
    const w = await src("public/maplibre/maplibre-gl-worker.mjs");
    expect(w).toContain("3-Clause BSD"); // licenčna glava — korektna redistribucija
    expect(w.length).toBeGreaterThan(100_000); // pravi worker, ne placeholder
  });
});
