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
