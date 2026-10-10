/**
 * PWA SERVICE WORKER — čiste strategijske funkcije iz public/sw.js (v2.4.0).
 *
 * Objekt pod testom: public/sw.js (offline strategije PWA Discover-Slovenia-AI).
 *
 * Zakaj je sw.js testabilen izven brskalnika: strategije so ČISTE funkcije,
 * izvožene prek `module.exports` (service worker nima `module` — izvozna veja
 * se v SW kontekstu sploh ne izvede), registracija dogodkov (install/activate/
 * fetch/message) pa se zgodi SAMO znotraj ServiceWorkerGlobalScope, prepoznane
 * prek `importScripts` — te funkcije v bun testu ne obstaja, zato je uvoz sw.js
 * brez stranskih učinkov (registracija se ne izvede).
 *
 * Zaklenjene invariante (kanon iz glave public/sw.js):
 * - ZASEBNOST: zasebni APIji (auth, trips, invites, journey, checkout, stripe,
 *   contact, newsletter) in NEZNANI /api/* → api-private — NIKOLI predpomnjeni;
 *   varčna privzeta vrednost: kar ni izrecno javno, je zasebno,
 * - /api/destinations in /api/weather sta edini javni API poti (api-public),
 * - ploščice OSM (tile.openstreetmap.org) → tile kljub tujemu izvoru,
 * - zasilni odgovor 503 JSON { ok:false, offline:true, path } se NIKOLI ne
 *   predpomni (isCacheableResponse ga zavrne),
 * - trimCacheKeys pobriše NAJSTAREJŠE odvečne vnose (omejitev velikosti),
 * - keepCacheNames ob aktivaciji ohrani natanko trenutna tri imena,
 * - SW_VERSION je usklajena s package.json (kanarček ob izdaji).
 *
 * Uvoz: "../public/sw.js" (relativno iz tests/). Od P0-J (issue #1) je
 * bun-types referenciran v tsconfig "types", zato uvoz bun:test tipiziran
 * brez utišanja.
 */

import { describe, expect, test } from "bun:test";

import swApi from "../public/sw.js";
import pkg from "../package.json";

/** Izvor aplikacije za strategyFor (vzorec iz JSDoc public/sw.js). */
const ORIGIN = "https://app.example";

describe("sw: konstante (verzija, lupina aplikacije, meje)", () => {
  test("SW_VERSION je usklajena s package.json in trenutno izdajo 2.25.0", () => {
    // Kanarček ob izdaji: glava sw.js obljublja usklajenost s package.json —
    // pozabljen bump ob izdaji takoj pade na tem testu.
    expect(swApi.SW_VERSION).toBe("2.27.0");
    expect(swApi.SW_VERSION).toBe(pkg.version);
  });

  test("OFFLINE_HTML kaže na /offline.html (zasilna stran brez povezave)", () => {
    expect(swApi.OFFLINE_HTML).toBe("/offline.html");
  });

  test("APP_SHELL je točno kanonski nabor lupine aplikacije", () => {
    // Izvoz je kopija (.slice()) notranjega seznama — vsebuje domov,
    // Go Mode (/na-poti — P0-G: obljuba „deluje brez signala“ izpolnjena
    // že ob prvem obisku), zasilno stran, manifest, obe ikoni in logotip.
    expect(swApi.APP_SHELL).toEqual([
      "/",
      "/na-poti",
      "/offline.html",
      "/manifest.json",
      "/icon-192.png",
      "/icon-512.png",
      "/logo.svg",
    ]);
  });

  test("meje in identitete: MAX_TILES 240, MAX_PAGES 40, timeout 6 s, predpona dsa, gostitelj OSM", () => {
    expect(swApi.MAX_TILES).toBe(240);
    expect(swApi.MAX_PAGES).toBe(40);
    expect(swApi.MAX_TILES).toBeGreaterThan(0);
    expect(swApi.MAX_PAGES).toBeGreaterThan(0);
    expect(swApi.NAVIGATION_TIMEOUT_MS).toBe(6000);
    expect(swApi.CACHE_PREFIX).toBe("dsa");
    expect(swApi.TILE_HOST).toBe("tile.openstreetmap.org");
  });
});

describe("sw: cacheNames (imena predpomnilnikov po verziji)", () => {
  test("verzijo preslika v tri imena s predpono dsa (static/runtime/tiles)", () => {
    const names = swApi.cacheNames("9.9.9");
    expect(names.static).toBe("dsa-static-9.9.9");
    expect(names.runtime).toBe("dsa-runtime-9.9.9");
    expect(names.tiles).toBe("dsa-tiles-9.9.9");
  });

  test("determinizem: ponovni klic vrne istovetna imena", () => {
    expect(swApi.cacheNames("2.4.0")).toEqual(swApi.cacheNames("2.4.0"));
  });

  test("imena se razlikujejo med verzijami (stare razveljavi activate)", () => {
    const novo = swApi.cacheNames("2.4.0");
    const staro = swApi.cacheNames("2.3.1");
    expect(novo.static).not.toBe(staro.static);
    expect(novo.runtime).not.toBe(staro.runtime);
    expect(novo.tiles).not.toBe(staro.tiles);
  });
});

describe("sw: isTileUrl (gostitelj ploščic OSM — sprejme URL objekt)", () => {
  test("ploščica OSM prek https → true", () => {
    expect(swApi.isTileUrl(new URL("https://tile.openstreetmap.org/7/61/45.png"))).toBe(true);
  });

  test("podobna ali tuja gostitelja → false (pod-domena NI ploščica)", () => {
    expect(swApi.isTileUrl(new URL("https://tiles.example.com/7/61/45.png"))).toBe(false);
    expect(swApi.isTileUrl(new URL("https://cdn.openstreetmap.org/ploscica.png"))).toBe(false);
  });

  test("protokol ni pomemben — tudi http ploščica je ploščica", () => {
    expect(swApi.isTileUrl(new URL("http://tile.openstreetmap.org/7/61/45.png"))).toBe(true);
  });
});

describe("sw: isPrivateApiPath (zasebne poti — nikoli predpomnjene)", () => {
  test("vseh osem zasebnih predpon (osnovna pot) je zasebnih", () => {
    for (const pot of [
      "/api/auth",
      "/api/trips",
      "/api/invites",
      "/api/journey",
      "/api/checkout",
      "/api/stripe",
      "/api/contact",
      "/api/newsletter",
    ]) {
      expect(swApi.isPrivateApiPath(pot)).toBe(true);
    }
  });

  test("pod-poti zasebnih predpon so prav tako zasebne", () => {
    expect(swApi.isPrivateApiPath("/api/auth/session")).toBe(true);
    expect(swApi.isPrivateApiPath("/api/trips/abc")).toBe(true);
    expect(swApi.isPrivateApiPath("/api/journey/bookings/x")).toBe(true);
    expect(swApi.isPrivateApiPath("/api/newsletter/prijava")).toBe(true);
  });

  test("javni poti (destinations, weather) nista zasebni", () => {
    expect(swApi.isPrivateApiPath("/api/destinations")).toBe(false);
    expect(swApi.isPrivateApiPath("/api/weather")).toBe(false);
  });

  test("neznan API na ravni te funkcije ni zaseben (varčno privzeto obravnava strategyFor)", () => {
    // Ta funkcija LE pošteno poizveduje seznam predpon — varnostno privzeto
    // vedenje za neznane APIje živi v strategyFor (glej tamkajšnji test).
    expect(swApi.isPrivateApiPath("/api/xyz")).toBe(false);
    expect(swApi.isPrivateApiPath("/api/destinacije")).toBe(false);
  });
});

describe("sw: isPublicApiPath (javni API — sme se predpomniti)", () => {
  test("destinations in weather (enakost in pod-poti) sta javni", () => {
    expect(swApi.isPublicApiPath("/api/destinations")).toBe(true);
    expect(swApi.isPublicApiPath("/api/destinations/bled")).toBe(true);
    expect(swApi.isPublicApiPath("/api/weather")).toBe(true);
  });

  test("zasebne, neznane in podobno zapisane poti niso javne", () => {
    expect(swApi.isPublicApiPath("/api/auth")).toBe(false);
    expect(swApi.isPublicApiPath("/api/xyz")).toBe(false);
    expect(swApi.isPublicApiPath("/api/destinacije")).toBe(false);
  });
});

describe("sw: isAssetPath (NESPREMENLJIVA statična sredstva — cache-first)", () => {
  test("predpona /content/ je sredstvo; mrtva /icons/ odstranjena; /_next/* NI (asset-soft)", () => {
    expect(swApi.isAssetPath("/content/ble.jpg")).toBe(true);
    // P0 AUDIT: /icons/ predpona je bila odstranjena iz sw.js — mapa
    // public/icons/ NE obstaja (ikone so /icon-192.png + /icon-512.png v
    // korenu, ki jita SW precasha eksplicitno prek APP_SHELL) — mrtva
    // predpona bi le napihovala pravila predpomnilnika.
    expect(swApi.isAssetPath("/icons/znamenje.png")).toBe(false);
    // /_next/* so network-first (asset-soft) — glej isSoftAssetPath
    expect(swApi.isAssetPath("/_next/static/chunks/app.js")).toBe(false);
  });

  test("isSoftAssetPath: /_next/* so mehka sredstva (network-first)", () => {
    expect(swApi.isSoftAssetPath("/_next/static/chunks/app.js")).toBe(true);
    expect(swApi.isSoftAssetPath("/_next/image?url=%2Fcontent%2Fbled.jpg")).toBe(true);
    expect(swApi.isSoftAssetPath("/content/ble.jpg")).toBe(false);
    expect(swApi.isSoftAssetPath("/manifest.json")).toBe(false);
  });

  test("točne datoteke lupine in rss.xml so sredstvo", () => {
    for (const pot of [
      "/manifest.json",
      "/logo.svg",
      "/icon-192.png",
      "/icon-512.png",
      "/offline.html",
      "/rss.xml",
    ]) {
      expect(swApi.isAssetPath(pot)).toBe(true);
    }
  });

  test("API poti in domača stran niso sredstvo (domov je navigacija)", () => {
    expect(swApi.isAssetPath("/api/destinations")).toBe(false);
    expect(swApi.isAssetPath("/")).toBe(false);
  });
});

describe("sw: strategyFor (jedro — izbira strategije za posamezno zahtevo)", () => {
  test("navigacija domov (mode navigate) → page", () => {
    expect(swApi.strategyFor(ORIGIN + "/", ORIGIN, { mode: "navigate" })).toBe("page");
  });

  test("navigacija prek destination document (brez mode) → page", () => {
    expect(swApi.strategyFor(ORIGIN + "/destinacije/bled", ORIGIN, { destination: "document" })).toBe(
      "page"
    );
  });

  test("ploščica OSM → tile (kljub tujemu izvoru, pred vsem ostalim)", () => {
    expect(swApi.strategyFor("https://tile.openstreetmap.org/7/61/45.png", ORIGIN)).toBe("tile");
  });

  test("tuj izvor brez OSM → network-only (prepuščeno brskalniku)", () => {
    expect(swApi.strategyFor("https://cdn.primerek.com/lib.js", ORIGIN)).toBe("network-only");
  });

  test("zasebna seja /api/auth/session → api-private", () => {
    expect(swApi.strategyFor(ORIGIN + "/api/auth/session", ORIGIN)).toBe("api-private");
  });

  test("uporabnikova pot /api/trips/abc → api-private", () => {
    expect(swApi.strategyFor(ORIGIN + "/api/trips/abc", ORIGIN)).toBe("api-private");
  });

  test("javni /api/destinations → api-public", () => {
    expect(swApi.strategyFor(ORIGIN + "/api/destinations", ORIGIN)).toBe("api-public");
  });

  test("vreme z query stringom → api-public (pathname odreže poizvedbo)", () => {
    expect(swApi.strategyFor(ORIGIN + "/api/weather?lat=46.05&lng=14.51", ORIGIN)).toBe(
      "api-public"
    );
  });

  test("VARNOST: neznan API /api/xyz → api-private (varčna privzeta vrednost)", () => {
    // Vse, kar ni izrecno javno, se obnaša kot zasebno — nikoli predpomnjeno.
    expect(swApi.strategyFor(ORIGIN + "/api/xyz", ORIGIN)).toBe("api-private");
  });

  test("Next gradniki → asset-soft (po poti, brez podatka o destinaciji)", () => {
    // /_next/* so network-first z zasilnim predpomnilnikom — URL-ji razvojnih
    // gradnikov se spreminjajo ob vsakem prevajanju, cache-first bi v razvoju
    // (?sw=1) strezal zastarele gradnike (v produkciji so URL-ji zakodirani).
    expect(swApi.strategyFor(ORIGIN + "/_next/static/chunks/app-abc123.js", ORIGIN)).toBe(
      "asset-soft"
    );
    expect(swApi.strategyFor(ORIGIN + "/_next/image?url=%2Fcontent%2Fbled.jpg", ORIGIN)).toBe(
      "asset-soft"
    );
  });

  test("slika na neznani poti z destination image → asset-soft (odloča destinacija, ne pot)", () => {
    expect(swApi.strategyFor(ORIGIN + "/slike/nekaj.png", ORIGIN, { destination: "image" })).toBe(
      "asset-soft"
    );
  });

  test("style, script in font po destinaciji → asset-soft", () => {
    expect(swApi.strategyFor(ORIGIN + "/css/tema.css", ORIGIN, { destination: "style" })).toBe(
      "asset-soft"
    );
    expect(swApi.strategyFor(ORIGIN + "/js/iskanje.js", ORIGIN, { destination: "script" })).toBe(
      "asset-soft"
    );
    expect(swApi.strategyFor(ORIGIN + "/pisave/inter.woff2", ORIGIN, { destination: "font" })).toBe(
      "asset-soft"
    );
  });

  test("isti-izvor neznana pot brez destinacije → page (zasilna offline stran)", () => {
    expect(swApi.strategyFor(ORIGIN + "/slike/nekaj.png", ORIGIN)).toBe("page");
  });

  test("navigacija ima prednost pred asset potjo (document na /logo.svg → page)", () => {
    // Uporabnik odpre URL logotipa neposredno v brskalniku — to je dokument
    // (navigacija), ne sredstvo: vrstni red preverb v strategyFor je
    // ploščica → izvor → navigacija → API → sredstvo.
    expect(swApi.strategyFor(ORIGIN + "/logo.svg", ORIGIN, { mode: "navigate" })).toBe("page");
  });
});

describe("sw: trimCacheKeys (omejitev velikosti predpomnilnika)", () => {
  test("dolžina pod ali natanko na meji → ničesar za brisanje", () => {
    expect(swApi.trimCacheKeys(["a", "b", "c"], 3)).toEqual([]);
    expect(swApi.trimCacheKeys(["a"], 5)).toEqual([]);
    expect(swApi.trimCacheKeys([], 0)).toEqual([]);
  });

  test("tri odvečni vnosi → pobriše najstarejše tri (prvih po vrstnem redu vnosa)", () => {
    expect(swApi.trimCacheKeys(["k1", "k2", "k3", "k4", "k5"], 2)).toEqual(["k1", "k2", "k3"]);
  });

  test("meja 0 → vsi vnosi so odvečni", () => {
    expect(swApi.trimCacheKeys(["a", "b"], 0)).toEqual(["a", "b"]);
  });

  test("negativen, NaN ali neskončen argument → [] (neveljaven vhod, ničesar ne pobriše)", () => {
    expect(swApi.trimCacheKeys(["a", "b"], -5)).toEqual([]);
    expect(swApi.trimCacheKeys(["a", "b"], Number.NaN)).toEqual([]);
    expect(swApi.trimCacheKeys(["a", "b"], Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

describe("sw: keepCacheNames (katera imena ob aktivaciji ostanejo)", () => {
  const allNames = [
    "dsa-static-2.4.0",
    "dsa-runtime-2.4.0",
    "dsa-tiles-2.4.0",
    "dsa-static-2.3.1",
    "dsa-runtime-2.3.1",
    "drug-cache",
  ];

  test("iz mešanega seznama ohrani natanko trenutna tri imena", () => {
    expect(swApi.keepCacheNames(allNames, "2.4.0")).toEqual([
      "dsa-static-2.4.0",
      "dsa-runtime-2.4.0",
      "dsa-tiles-2.4.0",
    ]);
  });

  test("stare dsa-* in tuja imena se ne ohranijo", () => {
    const keep = swApi.keepCacheNames(allNames, "2.4.0");
    expect(keep).not.toContain("dsa-static-2.3.1");
    expect(keep).not.toContain("dsa-runtime-2.3.1");
    expect(keep).not.toContain("drug-cache");
  });

  test("druga verzija ohrani le svoja imena; prazen seznam → prazen izhod", () => {
    expect(swApi.keepCacheNames(allNames, "2.3.1")).toEqual([
      "dsa-static-2.3.1",
      "dsa-runtime-2.3.1",
    ]);
    expect(swApi.keepCacheNames([], "2.4.0")).toEqual([]);
  });
});

describe("sw: offlineApiBody / makeOfflineApiResponse (zasilni JSON 503 brez povezave)", () => {
  test("telo je JSON z ok:false, offline:true, izvorno potjo in sporočilom", () => {
    const telo = JSON.parse(swApi.offlineApiBody("/api/trips/abc"));
    expect(telo.ok).toBe(false);
    expect(telo.offline).toBe(true);
    expect(telo.path).toBe("/api/trips/abc");
    expect(typeof telo.error).toBe("string");
    expect(telo.error.length).toBeGreaterThan(0);
  });

  test("odgovor: status 503, statusText Offline, Content-Type aplikacijski JSON", () => {
    const res = swApi.makeOfflineApiResponse("/api/auth/session");
    expect(res.status).toBe(503);
    expect(res.statusText).toBe("Offline");
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  });

  test("telo odgovora se prebere in parsira v isto obliko kot offlineApiBody", async () => {
    const res = swApi.makeOfflineApiResponse("/api/destinations");
    expect(JSON.parse(await res.text())).toEqual(
      JSON.parse(swApi.offlineApiBody("/api/destinations"))
    );
  });

  test("zasilni odgovor se NIKOLI ne predpomni (503 ni predpomnljiv)", () => {
    expect(swApi.isCacheableResponse(swApi.makeOfflineApiResponse("/api/weather"))).toBe(false);
  });
});

describe("sw: isCacheableResponse (vrata za shrambo v predpomnilnik)", () => {
  test("uspešen osnovni odgovor 200 → true", () => {
    expect(swApi.isCacheableResponse(new Response("vsebina", { status: 200 }))).toBe(true);
  });

  test("napake 404, 500 in 503 se ne predpomnijo", () => {
    expect(swApi.isCacheableResponse(new Response("nič", { status: 404 }))).toBe(false);
    expect(swApi.isCacheableResponse(new Response("napaka", { status: 500 }))).toBe(false);
    expect(swApi.isCacheableResponse(new Response("offline", { status: 503 }))).toBe(false);
  });

  test("manjkajoč odgovor → falsy (fail-closed, brez sesutja na undefined)", () => {
    // Opomba: varčni izraz `response && …` vrne operand undefined (ne strogo
    // false) — vsem klicnim mestom v sw.js služi kot boolean (falsy =
    // ne predpomni), zato zaklepamo falsy, ne strogi false.
    expect(swApi.isCacheableResponse(undefined)).toBeFalsy();
  });

  // Opomba: tipov "opaque" / "opaqueredirect" ni mogoče konstruirati v bun
  // testu (nastaneta samo pri no-cors fetch v brskalniku) — ti dve veji sta
  // pokriti z branjem vira public/sw.js (izrecni preverbi type !== "opaque").
});

describe("sw: isTileCacheableResponse (ploščice — edina izjema za opaque)", () => {
  test("uspešen odgovor 200 je predpomnljiv tudi za ploščice", () => {
    expect(swApi.isTileCacheableResponse(new Response("png", { status: 200 }))).toBe(true);
  });

  test("napake (404/500/503) niso predpomnljive niti za ploščice", () => {
    expect(swApi.isTileCacheableResponse(new Response("x", { status: 404 }))).toBe(false);
    expect(swApi.isTileCacheableResponse(new Response("x", { status: 500 }))).toBe(false);
    expect(swApi.isTileCacheableResponse(swApi.makeOfflineApiResponse("/zemljevid"))).toBe(false);
  });

  test("manjkajoč odgovor → strogi false (fail-closed)", () => {
    expect(swApi.isTileCacheableResponse(undefined)).toBe(false);
  });

  // Opomba: ključna razlika — isCacheableResponse ZAVRENE opaque (no-cors
  // <img> odgovori Leafleta), isTileCacheableResponse pa ga SPREJME (edina
  // izjema, gostitelj zaklenjen na tile.openstreetmap.org — kanon v glavi
  // public/sw.js). Opaque tipa ni mogoče konstruirati v bun testu; veja
  // `|| response.type === "opaque"` je zaklenjena z branjem vira.
});
