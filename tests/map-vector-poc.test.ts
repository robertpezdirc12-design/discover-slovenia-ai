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
    // Selektor je namenoma ZOŽAN na zoom kontrole (ne vse gumbe MapLibre),
    // da pravilo ne posega v druge kontrole knjižnice:
    expect(s).toContain(".maplibregl-ctrl-group .maplibregl-ctrl-zoom-in");
    expect(s).toContain(".maplibregl-ctrl-group .maplibregl-ctrl-zoom-out");
    expect(s).toContain("width: 44px;");
    expect(s).toContain("height: 44px;");
  });
});

describe("poc-vector [source-contract]: filtriranje, seznam in odpornost", () => {
  test("iskanih in filtriranih 74 destinacij ne povzroči ponovne inicializacije zemljevida", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("filterDestinations(DESTINATIONS, { q, country, region, type })");
    expect(s).toContain("markersRef.current.set(d.slug, marker)");
    // Filtri in gručenje presojata prikaz v ENEM mestu (syncMarkers):
    expect(s).toContain("visibleSlugsRef.current = new Set(filteredDestinations.map((item) => item.slug))");
    expect(s).toContain("syncMarkersRef.current?.()");
    expect(s).toContain('section');
    expect(s).toContain('setMobileView("list")');
    expect(s).toContain('setMobileView("map")');
    expect(s).toContain("window.history.replaceState");
    expect(s).toContain("new LngLatBounds()");
    expect(s).toContain("mapRef.current?.resize()");
  });

  test("napake posamičnih ploščic po naložitvi ne skrijejo delujočega zemljevida", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("if (loadedRef.current || event.sourceId) return;");
    expect(s).toContain("setFailed(false)");
    expect(s).toContain("map.remove()");
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

describe("poc-vector [source-contract]: gručenje dotikalnih ciljev (PR #62)", () => {
  test("gruča je 44 × 44 px gumb s števcem, data atributoma in imeni članov", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    // čista logika iz ločenega modula (enote: tests/map-clustering.test.ts):
    expect(s).toContain('from "@/lib/map-clustering"');
    // pravilo dotika ostaja TUDI za gručo — ciljev ne zmanjšujemo pod 44 px:
    expect(s).toContain(
      '"flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary p-0 text-xs font-semibold text-primary-foreground shadow-md"',
    );
    expect(s).toContain('clusterEl.setAttribute("data-cluster", "")');
    expect(s).toContain('clusterEl.setAttribute("data-cluster-count", String(members.length))');
    // dostopno ime nosi imena članov (E2E ⑩ locira gručo po imenu destinacije):
    expect(s).toContain("${pick(l, CLUSTER_ARIA_LABELS)}: ${names.join(\", \")}");
    expect(s).toContain('sl: "Gruča destinacij"');
    expect(s).toContain('en: "Destination cluster"');
  });

  test("klik gruče razpre skupino: fitBounds članov z omejitvijo ločitve (drill-down)", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("const target = requiredSeparationZoom(");
    expect(s).toContain("MIN_TOUCH_TARGET_PX,");
    expect(s).toContain("current.getMaxZoom(),");
    expect(s).toContain(") + CLUSTER_ZOOM_MARGIN;");
    // fitBounds VSEH članov — po tapu je celotna skupina videna in razpeta
    // (easeTo na središče bi pustil robne člane izven platna):
    expect(s).toContain("current.fitBounds(bounds, {");
    expect(s).toContain("padding: 52,");
    expect(s).toContain("maxZoom: target,");
    expect(s).toContain("bounds.extend([member.coords.lng, member.coords.lat]);");
  });

  test("gručenje steče ob load, ob premiku kamere in ob filtrih; čiščenje odstrani gruče", async () => {
    const s = await src("src/components/map/travel-map-vector-poc.tsx");
    expect(s).toContain("const onMove = () => syncMarkers();");
    expect(s).toContain('map.on("move", onMove)');
    expect(s).toContain('map.off("move", onMove)');
    expect(s).toContain("clusterMarkersRef.current.clear()");
    // ob load (prvi izris) in ob vsaki spremembi filtrov:
    expect(s).toContain("syncMarkers();");
    expect(s).toContain("syncMarkersRef.current?.()");
  });
});
