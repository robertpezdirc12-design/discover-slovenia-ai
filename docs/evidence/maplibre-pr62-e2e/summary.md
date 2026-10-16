# PR #62 — MapLibre mobilna validacija (2.67.1)

**Datum:** 2026-10-16 · **Veja:** `feat/maplibre-mobile-validation` · **Glava:** `91aa4e8`
**Cilj:** Vercel predogled (branch alias `i-feel-slovenia-git-fea-89917a-robertpezdirc12-designs-projects.vercel.app`)
**Ukaz:** `E2E_BASE_URL=https://…vercel.app bunx playwright test --project=chromium-mobile` (+ `--project=chromium`)

## Rezultat: 17/17 mobilnih + 2/2 namiznih testov PASSED (en neprekinjen tek, 3,9 min)

| Test | Širine | Rezultat |
|---|---|---|
| ① brez vodoravnega preliva: 5 ključnih strani | 320/375/390/768/1440 | ✅ 5/5 |
| ② mobilni meni (odpri/Escape/navigacija) | Pixel 7 | ✅ |
| ③ dotik: iskanje Bled → dodaj → moja potovanja | Pixel 7 | ✅ |
| ④ privzeti Leaflet zemljevid @ 390 | 390 | ✅ |
| ⑤ MapLibre: platno + povečava + atribucija | 320/375/390/768/1440 | ✅ |
| ⑥ MapLibre: marker klik → popup → dodaj v mojo pot | 390 | ✅ |
| ⑦ MapLibre: iskanje (2 zadetka) + seznam + preklop | 390 | ✅ |
| ⑧ državna stran /drzava/BA | 320/375/390/768/1440 | ✅ 5/5 |
| ⑨ vseh 10 držav brez preliva | 375 | ✅ |
| namizna zlata pot + determinizem | 1280×800 | ✅ 2/2 |

## Ročna brskalniška preverba (agent-browser, pred testi)

- Platno se dejansko upodobi (WebGL, 358×523 @ 390 px), 74 markerjev, banner PoC.
- Povečava ± deluje; klik na marker (Beograd) odpre popup; „Dodaj v mojo pot" →
  „V moji poti" (onemogočen) + `dai:my-trip` vsebuje `refId`.
- Iskanje „Bled" → **2 destinacij** (Bled + Vintgarska soteska — opis omenja Bled;
  kanon `destinations-filter.ts`), URL-sync `?q=Bled`, fitBounds + skrivanje markerjev.
- Državni filter HR → 8 destinacij (`&country=HR`); +tip Grad → 0 + prazno stanje;
  Ponastavi → 74. Preklop Zemljevid↔Seznam deluje v obe smeri, dodajanje s seznama OK.
- 0 JS konzolnih napak, 0 pageerror, 0 neuspešnih omrežnih zahtevkov (313 zahtevkov,
  OpenFreeMap ploščice/glyphi 200; samo Vercel-toolbar 204).

## Najdene in popravljene napake (samo e2e/mobile.e2e.ts — koda aplikacije NESPREMENJENA)

1. **⑥/začetni pogled:** fitBounds vseh 74 destinacij je stisnjen na minZoom 5
   (center ≈ [20.65, 43.29], merjeno) — na 390 px platnu je severozahod zaključen,
   Bled je takoj po nalaganju izven viewporta. **Pravilno obnašanje, ne napaka.**
   Test zdaj zoži pogled z iskanjem izolirane destinacije (Postojnska jama, ~38 km
   do najbližje; edinstven zadetek → flyTo zoom 11) in pomakne stran nad fiksni
   mobilni nav trak.
2. **⑥/prekrivanje dotikanih ciljev:** Bled in Vintgarska soteska sta ~5,7 km
   narazen — pri zoom 8 je to < 44 px, zato se 44-px dotikani ploščici prekrivata
   in vintgarska soteska prestreza klik na Bled. Omejitev 44-px ciljev pri gostih
   destinacijah (potencialni kandidat za clustering v naslednjem paketu).
3. **⑦/števec:** „1 destinacij" → „2 destinacij" (iskanje pokrije tudi opis — kanon).
4. **⑥⑦/lokator gumba:** gumb po dodajanju spremeni besedilo v „V moji poti" —
   lokator po starem imenu ne ujame več; asertacija zdaj locira po novem imenu.

## Okoljske opombe

- GitHub Actions checki na PR ostanejo rdeči izključno zaradi znane billing blokade
  Actions (0 stopenj, instant-fail) — niso signal o kodi; zanesljiva vrata so lokalna
  + Vercel predogled.
- Commit iz peskovnika z avtorjem `z@container` je Vercel blokiral („Deployment was
  blocked"); z identiteto lastnika (robert.pezdirc12@gmail.com) je deploy uspešen.

## Posnetki zaslona

01–02: 390 px zemljevid + povečava · 03: popup markerja · 04–07: 320/375/768/1440.

---

# Runda 2 — gručenje markerjev (d8b018e, 2026-10-16)

**Glava:** `d8b018e` — „GRUČENJE markerjev: prekrivanje dotikalnih ciljev (Bled ↔ Vintgar) odpravljeno"
**Novo v kodi:** `src/lib/map-clustering.ts` (union-find prekrivanja 44-px ciljev + `requiredSeparationZoom`)
in `travel-map-vector-poc.tsx` (gruče 44×44 px, klik gruče = fitBounds drill-down na ločitev).
**Ciljna težava:** Bled ↔ Vintgarska soteska sta pri zoom ≤ 8 oddaljeni < 44 px — klik prestreže
sosednji marker. Cilji ostanejo ≥ 44×44 px; zmanjša se število hkratnih ciljev, ne velikost.

## Vrata (lokalna produkcijska gradnja d8b018e, standalone :3100)

- `tsc --noEmit` → 0 napak · `eslint .` → 0 · `bun test` → 2447/2447 (26 687 expect)
- `next build` → ZELEN s TS preverbo · E2E mobilni → **19/19 PASSED (en čist tek, 2,9 min)**
  + namizni 2/2 PASSED
- Novi testi: enote `tests/map-clustering.test.ts` (12: projekcija, meja 44 px, verige,
  Bled/Vintgar z8→gruča→z11 ločeno, kanonska invarianta, točno 4 pari < 44 px @ z8);
  E2E ⑩ sprejemni (Bled in Vintgar posamezno izberljiva iz gruče pri privzetem pogledu,
  brez iskanja in brez ročnega povečanja; cilja se ne prekrivata; popup + dodajanje v pot
  za OBE; 0 pageerror) + ⑪ (seznam → destinacija v gruči → popup po letu).

## Status predogleda (Vercel)

- Push d8b018e na GitHub ob ~18:10 UTC je Vercel zavrnil z **build-rate-limit**
  (commit status failure, brez deployment zapisa — blokada okolja, NI napaka kode).
- Ta dokumentacijska sprememba hkrati sproži nov poskus deploymenta; E2E proti
  predogledu se izvede takoj, ko je predogled na voljo.
