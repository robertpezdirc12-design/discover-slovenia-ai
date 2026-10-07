# P0-J + P0-B + P0-D — dokazovalnica (issue #1 RECOVER + RECONCILE, v2.7.0)

**Datum:** 2026-10-07 ~19:30 UTC | **Sklop:** P0-J (CI vrata) → P0-B (supply
 plast) → P0-D (deterministični itinerary + day-segments)

## Zajeto v tej dokazovalnici

| Datoteka | Vsebina |
|---|---|
| `01-nacrtuj-načrt-segmenti.png` | Načrtovalnik (?preset=druzinski-izlet): kartice dni s segmentnimi glavami Jutro ☀️ / Popoldan 🌤️ |
| `02-potovanje-casovnica-segmenti.png` | /potovanje: časovnica dneva s segmenti + etapa ~5 km · ~5 min (ocena vožnje) med postankoma Bled → Vintgarska soteska + gumb Navigiraj |
| `03-potovanje-mobilni-390.png` | Mobilni 390 px — brez preliva (scrollWidth ≤ 390) |
| `e2e-rezultati.txt` | strojni izpis E2E preverb |

## Strohne preverbe (agent-browser eval + curl)

- **API P0-D:** `POST /api/itinerary` → `engine: "deterministic"`,
  `fingerprint: 2b8c6d24`; determinizem: 2× isti vhod → **ENAK prstni odtis**;
  dnevi 2, postanki 3, ure `['09:00','13:35']` / `['09:00']`.
- **Segmenti v DOM:** načrtovalnik `{jutro:true, popoldan:true, dan1:true}` —
  Večer izostane iskreno (prednastavitev generira postanke 09:00–13:35, brez
  izmišljenega večera); potovanje `{jutro:true, popoldan:true, legKm:true,
  navigiraj:true}`.
- **Mobilni:** 390 px brez preliva.
- **Konzolne napake:** 0 (errors prazen po čistih navigacijah).

## VLM neodvisna potrditev posnetka 02

1. Glave segmentov **Jutro** (☀️) in **Popoldan** jasno prikazane z emoji ikonami.
2. Oznaka etape **~5 km · ~5 min** (ocena vožnje) med postankoma Bled in Vintgarska soteska.
3. Kartica **Dan 1 · Gorenjska — Bled** jasno označena.

## Ostala vrata (isti sklop, izven posnetkov)

- `bun test` → **599/599** (0 fail; +38 supply-activation, +27 day-segments/deterministic-itinerary)
- `bun run lint` → 0 napak; `bun run typecheck` (tsc --noEmit) → **0 napak**
  (bun-types priključen v tsconfig `types`; 9 predhodnih tipovskih napak odpravljenih)
- `bun run activation:check` → 19 ponudnikov: 🟢 1 · 🔵 1 · ⚪ 10 · 🔴 7
- CI: `.gitlab-ci.yml` + `.github/workflows/ci.yml` — 5 vrat (lint → typecheck
  → test → prisma validate → build); popravljen pokvarjen `branches: ain]` v ci.yml
