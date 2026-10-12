/**
 * DISCOVER SLOVENIA AI — PWA OFFLINE SERVICE WORKER (v2.4.0)
 * =========================================================
 *
 * Zadnji manjkajoči del kanona izvirnika (README „Kaj ŠE MANJKA": sw.js
 * offline). Manifest že obljublja „načrti, ki ostanejo dostopni tudi brez
 * povezave" — ta service worker obljavko izpolni.
 *
 * STRATEGIJE (fetch):
 *   - asset        (isti izvor, NESPREMENLJIVE datoteke: /content/*, /icons/*,
 *                   manifest, logotip, ikone, offline.html, rss.xml)
 *                   → CACHE-FIRST (teh datotek razvoj ne spreminja)
 *   - asset-soft   (/_next/* — gradniki in slike Next; style/script/image/
 *                   font po destinaciji) → NETWORK-FIRST z zasilnim
 *                   predpomnilnikom. Razlog: URL-ji razvojnih gradnikov se
 *                   spreminjajo ob vsakem prevajanju — cache-first bi v
 *                   razvoju (?sw=1) strezal ZASTARELE gradnike; v produkciji
 *                   so /_next/static URL-ji vsebinsko zakodirani, zato
 *                   network-first tu stane le en obisk mreže (HTTP predpomnilnik
 *                   brskalnika poskrbi za hitrost).
 *   - tile         (tile.openstreetmap.org) → CACHE-FIRST z OMEJENIM
 *                   pomnilnikom (MAX_TILES) — brez povezave ostane zemljevid
 *                   nazadnje pregledanega območja; opaque (no-cors <img>)
 *                   je za ploščice izrecno dovoljen
 *   - page         (navigacije + isti-izvor GET) → NETWORK-FIRST z zasilnim
 *                   predpomnilnikom in konec offline.html
 *   - api-public   (/api/destinations, /api/weather) → NETWORK-FIRST z
 *                   zasilnim predpomnilnikom (vreme nosi fetchedAt — žetje
 *                   vedno povedo, kako staro je)
 *   - api-private  (/api/auth, /api/trips, /api/invites, /api/journey,
 *                   /api/checkout, /api/stripe, /api/contact, /api/newsletter)
 *                   → SAMO MREŽA. Odgovor se NIKOLI ne predpomni (zasebni/
 *                   uporabniški podatki); ob napaki pošten JSON 503
 *                   { ok:false, offline:true }.
 *   - network-only (ne-GET, ostali tuji izvori) → prepuščeno brskalniku
 *
 * ZASEBNOST (kanon go-gps/weather): predpomnilnik vsebuje izključno javne
 * vire; uporabnikova GPS lega in seje NIKOLI niso del predpomnilnika.
 * Vreme se shranjuje po zaokroženih koordinatah postanka (isti ključ kot
 * strežniški proxy — ~1,1 km mreža).
 *
 * TESTABILNOST: čiste strategijske funkcije so izvožene prek module.exports
 * (service worker nima `module` — veja se v SW kontekstu ne izvede).
 * Registracija se izvede SAMO v ServiceWorkerGlobalScope (prepoznana prek
 * importScripts). Testna vrata: tests/pwa-sw.test.ts.
 *
 * Verzija SW_VERSION razveljavi vse stare predpomnilnike (activate počisti
 * vse dsa-* imeni, ki niso trenutna).
 */

"use strict";

/** Verzija service workerja — usklajena s package.json ob izdaji. */
const SW_VERSION = "2.43.0";

/** Predpona imen predpomnilnikov (čistilni kriterij ob activate). */
const CACHE_PREFIX = "dsa";

/** Zasilna stran za nepredpomnjene navigacije brez povezave. */
const OFFLINE_HTML = "/offline.html";

/** Gornja meja predpomnjenih ploščic zemljevida (≈ 7–8 zaslonskih polj). */
const MAX_TILES = 240;

/** Gornja meja predpomnjenih HTML strani (zasilni runtime predpomnilnik). */
const MAX_PAGES = 40;

/** Časovni zamik omrežja za navigacije, po katerem prevzame predpomnilnik. */
const NAVIGATION_TIMEOUT_MS = 6000;

/**
 * Lupina aplikacije — ob namestitvi predpomnjena (allSettled: ena napaka
 * ne sesuje celotne namestitve). P0-G: /na-poti (Go Mode) je NAMENOMA
 * v lupini — stran obljublja „deluje tudi brez signala“, zato mora biti
 * dosegljiva offline ŽE OB PRVEM obisku (ne šele po prejšnjem obisku
 * prek runtime predpomnilnika).
 */
const APP_SHELL = [
  "/",
  "/na-poti",
  OFFLINE_HTML,
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.svg",
];

/** Gostitelj ploščic zemljevida (Leaflet/OSM — kanon travel-map.tsx). */
const TILE_HOST = "tile.openstreetmap.org";

/** Javni APIji, ki se smejo predpomniti (vse ostalo /api/* je zasebno). */
const PUBLIC_API_PREFIXES = ["/api/destinations", "/api/weather"];

/** Zasebne poti API — NIKOLI predpomnjene (uporabniški podatki/seje). */
const PRIVATE_API_PREFIXES = [
  "/api/auth",
  "/api/trips",
  "/api/invites",
  "/api/journey",
  "/api/checkout",
  "/api/stripe",
  "/api/contact",
  "/api/newsletter",
];

/** Statične predpone NESPREMENLJIVIH datotek (cache-first). */
const ASSET_PREFIXES = ["/content/"]; // P0 AUDIT: /icons/ odstranjen (mapa ne obstaja)

/** Predpone gradnikov Next (network-first — glej strategijo asset-soft). */
const SOFT_ASSET_PREFIXES = ["/_next/"];

/** Imena predpomnilnikov za podano verzijo (čisto preslikava). */
function cacheNames(version) {
  return {
    static: CACHE_PREFIX + "-static-" + version,
    runtime: CACHE_PREFIX + "-runtime-" + version,
    tiles: CACHE_PREFIX + "-tiles-" + version,
  };
}

/** Ali URL pripada gostitelju ploščic OSM? */
function isTileUrl(url) {
  return url.hostname === TILE_HOST;
}

/** Ali pot (pathname) se začne s katero od podanih predpon? */
function hasPrefix(pathname, prefixes) {
  return prefixes.some(function (p) {
    return pathname === p || pathname.indexOf(p) === 0;
  });
}

/** Ali je pot API zasebna (nikoli predpomnjena)? */
function isPrivateApiPath(pathname) {
  return hasPrefix(pathname, PRIVATE_API_PREFIXES);
}

/** Ali je pot API javna (sme se predpomniti z network-first)? */
function isPublicApiPath(pathname) {
  return hasPrefix(pathname, PUBLIC_API_PREFIXES);
}

/** Ali je pot NESPREMENLJIVO statično sredstvo (cache-first)? */
function isAssetPath(pathname) {
  if (hasPrefix(pathname, ASSET_PREFIXES)) return true;
  return (
    pathname === "/manifest.json" ||
    pathname === "/logo.svg" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    pathname === "/offline.html" ||
    pathname === "/rss.xml"
  );
}

/** Ali je pot gradnik/slika Next (network-first z zasilnim predpomnilnikom)? */
function isSoftAssetPath(pathname) {
  return hasPrefix(pathname, SOFT_ASSET_PREFIXES);
}

/**
 * Strategija za eno zahtevo — ČISTA funkcija, jedro testne vrata.
 *
 * @param {string} rawUrl        - absolutni URL zahteve
 * @param {string} selfOrigin    - izvor aplikacije (npr. https://app.example)
 * @param {{mode?: string, destination?: string}} [requestInfo]
 *        - mode: "navigate" za navigacije; destination: "document"|"style"|
 *          "script"|"image"|"font"|… (Request.destination)
 * @returns {"asset"|"asset-soft"|"tile"|"page"|"api-public"|"api-private"|"network-only"}
 */
function strategyFor(rawUrl, selfOrigin, requestInfo) {
  const info = requestInfo || {};
  const url = new URL(rawUrl);
  const sameOrigin = url.origin === selfOrigin;

  if (isTileUrl(url)) return "tile";
  if (!sameOrigin) return "network-only";

  const isNavigation = info.mode === "navigate" || info.destination === "document";
  if (isNavigation) return "page";

  if (url.pathname.indexOf("/api/") === 0) {
    if (isPrivateApiPath(url.pathname)) return "api-private";
    if (isPublicApiPath(url.pathname)) return "api-public";
    return "api-private"; // neznan API = varčno: ne predpomni
  }

  if (isAssetPath(url.pathname)) return "asset";
  const dest = info.destination || "";
  if (isSoftAssetPath(url.pathname) || dest === "style" || dest === "script" || dest === "image" || dest === "font") {
    return "asset-soft";
  }

  // Preostali isti-izvor GET (rss.xml obravnavan kot sredstvo zgoraj;
  // druge strani/delne poti obravnavamo kot stran z offline zasilno).
  return "page";
}

/**
 * Kateri ključi predpomnilnika se pobrišejo, da velikost pade pod `max`
 * (Cache.keys() je približno po vrstnem redu vnosa — pošteno OMEJENA
 * zajemnica, ne LRU izmišljotine).
 */
function trimCacheKeys(keys, max) {
  if (!Number.isFinite(max) || max < 0) return [];
  const excess = keys.length - max;
  if (excess <= 0) return [];
  return keys.slice(0, excess);
}

/** Imena predpomnilnikov, ki se ob aktivaciji POHRANJO (trenutna). */
function keepCacheNames(allNames, version) {
  const current = cacheNames(version);
  const keep = [current.static, current.runtime, current.tiles];
  return allNames.filter(function (name) {
    return keep.indexOf(name) !== -1;
  });
}

/** Telo zasilnega JSON odgovora za API brez povezave. */
function offlineApiBody(pathname) {
  return JSON.stringify({
    ok: false,
    offline: true,
    error: "Brez povezave — ta zahtevek je mogoč le prek mreže.",
    path: pathname,
  });
}

/** Odgovor 503 z aplikacijskim JSON (isti izvor — brez CORS dodatkov). */
function makeOfflineApiResponse(pathname) {
  return new Response(offlineApiBody(pathname), {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Ali naj se odgovor shrani v predpomnilnik (samo uspešni, bazični). */
function isCacheableResponse(response) {
  return (
    response && response.status === 200 && response.type !== "opaque" && response.type !== "opaqueredirect"
  );
}

/**
 * Ali je odgovor predpomnljiv za PLOŠČICE zemljevida — Leaflet nalaga
 * ploščice prek <img> (no-cors), zato so odgovori tipa "opaque" (status 0,
 * telo nevidno SW-ju). Opaque je za tiles EKSPRESNO dovoljen — to je
 * standardna praksa predpomnjevanja kart; za vse ostalo velja stroga
 * preverba isCacheableResponse (zasebnost: tujih odgovorov ne shranjujemo
 * slepo — ploščice so edina izjema, gostitelj je zaklenjen na TILE_HOST).
 */
function isTileCacheableResponse(response) {
  return !!response && (isCacheableResponse(response) || response.type === "opaque");
}

/** Konstante + čiste funkcije — izvoženo za testna vrata (bun test). */
const SW_API = {
  SW_VERSION: SW_VERSION,
  CACHE_PREFIX: CACHE_PREFIX,
  OFFLINE_HTML: OFFLINE_HTML,
  APP_SHELL: APP_SHELL.slice(),
  MAX_TILES: MAX_TILES,
  MAX_PAGES: MAX_PAGES,
  NAVIGATION_TIMEOUT_MS: NAVIGATION_TIMEOUT_MS,
  TILE_HOST: TILE_HOST,
  cacheNames: cacheNames,
  isTileUrl: isTileUrl,
  isPrivateApiPath: isPrivateApiPath,
  isPublicApiPath: isPublicApiPath,
  isAssetPath: isAssetPath,
  isSoftAssetPath: isSoftAssetPath,
  strategyFor: strategyFor,
  trimCacheKeys: trimCacheKeys,
  keepCacheNames: keepCacheNames,
  offlineApiBody: offlineApiBody,
  makeOfflineApiResponse: makeOfflineApiResponse,
  isCacheableResponse: isCacheableResponse,
  isTileCacheableResponse: isTileCacheableResponse,
};

/* ----------------------------------------------------------------------
 * REGISTRACIJA DOGAJKOV — izključno v ServiceWorkerGlobalScope
 * (importScripts obstaja samo v workerjih; bun test ga nima).
 * ------------------------------------------------------------------- */
if (typeof importScripts === "function" && typeof self !== "undefined") {
  var NAMES = cacheNames(SW_VERSION);

  /** Omeji predpomnilnik na zgornjo mejo (pošteno, brez izmišljenega reda). */
  function limitCache(cacheName, max) {
    return caches.open(cacheName).then(function (cache) {
      return cache.keys().then(function (keys) {
        var remove = trimCacheKeys(keys, max);
        var chain = Promise.resolve();
        remove.forEach(function (request) {
          chain = chain.then(function () {
            return cache.delete(request);
          });
        });
        return chain;
      });
    });
  }

  /** Shranitev odgovora v predpomnilnik (ploščice dovoljujejo opaque). */
  function putIfCacheable(cacheName, request, response, allowOpaque) {
    var ok = allowOpaque ? isTileCacheableResponse(response) : isCacheableResponse(response);
    if (!ok) return Promise.resolve();
    var clone = response.clone();
    return caches.open(cacheName).then(function (cache) {
      return cache.put(request, clone);
    });
  }

  /** NETWORK-FIRST z zasilnim predpomnilnikom (strani / javni API). */
  function networkFirst(request, cacheName, fallback) {
    return fetch(request)
      .then(function (response) {
        putIfCacheable(cacheName, request, response);
        limitCache(cacheName, MAX_PAGES);
        return response;
      })
      .catch(function () {
        return caches
          .match(request)
          .then(function (cached) {
            if (cached) return cached;
            if (fallback) return caches.match(fallback);
            if (request.mode === "navigate" || new URL(request.url).pathname.indexOf("/api/") === 0) {
              return makeOfflineApiResponse(new URL(request.url).pathname);
            }
            return makeOfflineApiResponse(new URL(request.url).pathname);
          });
      });
  }

  /** CACHE-FIRST z zasilnim mrežnim padcem (sredstva, ploščice). */
  function cacheFirst(request, cacheName, maxEntries, allowOpaque) {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request)
        .then(function (response) {
          putIfCacheable(cacheName, request, response, allowOpaque);
          if (typeof maxEntries === "number") limitCache(cacheName, maxEntries);
          return response;
        })
        .catch(function () {
          if (request.mode === "navigate") {
            return caches.match(OFFLINE_HTML).then(function (page) {
              if (page) return page;
              return Response.error();
            });
          }
          return Response.error();
        });
    });
  }

  /** SAMO MREŽA za zasebne API — ob napaki pošten 503 JSON. */
  function privateApi(request) {
    return fetch(request).catch(function () {
      return makeOfflineApiResponse(new URL(request.url).pathname);
    });
  }

  self.addEventListener("install", function (event) {
    event.waitUntil(
      Promise.allSettled(
        APP_SHELL.map(function (path) {
          return caches.open(NAMES.static).then(function (cache) {
            // cache: "reload" OBVODI HTTP predpomnilnik brskalnika —
            // lupina se vedno pridobi iz mreže (deterministična namestitev;
            // v razvoju je sicer HTTP predpomnilnik lahko ujel datoteko).
            return cache.add(new Request(path, { cache: "reload" }));
          });
        })
      ).then(function () {
        // Ne skipWaiting — uporabnik potrjuje osvežitev prek UI prompta.
        return Promise.resolve();
      })
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (allNames) {
          var keep = {};
          keepCacheNames(allNames, SW_VERSION).forEach(function (n) {
            keep[n] = true;
          });
          var doomed = allNames.filter(function (name) {
            return name.indexOf(CACHE_PREFIX + "-") === 0 && !keep[name];
          });
          return Promise.all(
            doomed.map(function (name) {
              return caches.delete(name);
            })
          );
        })
        .then(function () {
          return self.clients.claim();
        })
    );
  });

  self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET") return; // prepuščeno brskalniku

    var rawUrl = request.url;
    var strategy = strategyFor(rawUrl, self.location.origin, {
      mode: request.mode,
      destination: request.destination,
    });

    if (strategy === "network-only") return;

    if (strategy === "asset") {
      event.respondWith(cacheFirst(request, NAMES.static));
      return;
    }
    if (strategy === "asset-soft") {
      event.respondWith(networkFirst(request, NAMES.static));
      return;
    }
    if (strategy === "tile") {
      event.respondWith(cacheFirst(request, NAMES.tiles, MAX_TILES, true));
      return;
    }
    if (strategy === "api-public") {
      event.respondWith(networkFirst(request, NAMES.runtime));
      return;
    }
    if (strategy === "api-private") {
      event.respondWith(privateApi(request));
      return;
    }
    // "page"
    event.respondWith(networkFirst(request, NAMES.runtime, OFFLINE_HTML));
  });

  self.addEventListener("message", function (event) {
    var data = event.data;
    if (data && data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  });
}

/* Izvoz za testna vrata — service worker nima `module` (veja se ne izvede). */
if (typeof module === "object" && module.exports) {
  module.exports = SW_API;
}
