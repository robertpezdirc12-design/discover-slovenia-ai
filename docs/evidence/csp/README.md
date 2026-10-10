# CSP nonce (2.23.0) — dokazi lokalne verifikacije

Datum: 2026-10-10 · strežnik: `next start -p 3100` (PRODUKCIJSKI build,
brez 'unsafe-eval'; `upgrade-insecure-requests` aktiven)

## Glava + telo (isti odziv)

- `content-security-policy` prisotna na dokumentih (matcher izključuje
  api/_next/_vercel/statiko)
- nonce glave ≡ nonce VSEH 24 `<script>` oznak (zunanji chunki + inline
  next-themes) — preverjeno znotraj enega odziva (curl -D + body)
- vsaka zahteva dobi SVEŽ nonce (dve zaporedni zahtevi = dva različna)

## Browser (agent-browser, production mode)

| Preverba | Rezultat |
|---|---|
| Domov `/` — render + naslov | ✅ 0 CSP kršitev, 0 page errors |
| Zemljevid `/zemljevid` | ✅ 12 OSM ploščic naloženih, 38 markerjev, 0 kršitev |
| Tema (next-themes inline skripta) | ✅ klik → `dark` na `<html>` (hidracija deluje) |
| Načrtovalnik `/nacrtuj` @390px | ✅ render, 0 kršitev, 0 napak |
| Neznana pot → [locale] catch-all | ✅ „Te strani (še) ni na zemljevidu", 0 kršitev |
| Korenska 404 | nedosegljiva prek običajnih poti (next-intl preusmeri v [locale]) |

## Smoke (scripts/smoke.ts, SMOKE_BASE_URL=:3100)

**19/19 PASS** — vključno cron fail-closed (401 brez žetona) in
health `2.23.0`.

## Slike

- `01-nacrtuj-mobilni-390.png` — načrtovalnik, mobilni 390px
- `02-zemljevid-ploscice.png` — zemljevid z OSM ploščicami (img-src dokaz)
- `03-domov.png` — domov, desktop 1280px
- `04-404-locale.png` — 404 znotraj dinamičnega [locale] layouta

## Vrata

- `bunx tsc --noEmit` → 0
- `bun run lint` → 0
- `bun test` → 1315/1315 (+14 novih csp-contract)
- `bun run build` → uspešen; VSE [locale] poti ƒ (dinamične — zahteva
  nonce), `/_not-found` ○ (dokumentirana mila degradacija)
