# 🇸🇮 Discover Slovenia AI

AI potovalni pomočnik za Slovenijo: vodeni tok, zemljevid z realnimi podatki in poštena uporaba odprtih virov — **vse brez ključev in brez skritih stroškov**.

## Funkcije

- **Vodeni tok (vodič)** — uporabnik odgovori na nekaj vprašanj, aplikacija pripravi pot in jo pokaže na zemljevidu.
- **Zemljevid (Leaflet)** — destinacije, rezervirana prenočišča, OSRM cestna pot, navigacija postanek-po-postanku, višinski profil (ARSO LiDAR), dnevni trak z OSRM časi.
- **Proračun poti** — okvirna ocena stroška prenočišč (indikativne cene, delitev na osebo).
- **POI ob poti** — živi OpenStreetMap zadetki (Overpass) z rezervo iz urejenega izbora slovenskih znamenitosti.
- **RKD sloj** — Register nepremične kulturne dediščine (31.107 enot) kot ločen sloj na zemljevidu s fotografijami in povezavami eID.
- **Javni prevoz** — naslednje povezave (bus/vlak) iz Ljubljane do postankov (OJPP / brezavta.si), narisane na zemljevidu.
- **Deljena pot** — kratka povezava `/pot/[koda]` z varnim uvozom (stateless rezerva, ko baza ni na voljo).
- **Izvoz GPX 1.1** in **tisk / shrani kot PDF** načrta poti (offline HTML).
- **Prerazporeditev postankov** — povleci in spusti, tipkovnica, shranjen vrstni red (vpliva na vse izpeljanke).
- **SEO** — sitemap, robots, JSON-LD, dinamična OG slika, statične strani destinacij `/kraj/[slug]`.

## Tehnologije

Next.js (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Leaflet · Prisma (SQLite lokalno) · Bun · Playwright (E2E scenariji v `.playwright-cli/`).

## Viri podatkov (brez ključev)

| Vir | Uporaba | Licenca |
|---|---|---|
| OpenStreetMap (ploščice, Photon/Nominatim, Overpass) | zemljevid, geokodiranje, POI | © OSM, ODbL |
| ARSO LiDAR | višinski relief | CC BY 4.0 |
| CKAN / podatki.gov.si (RKD RNPD) | kulturna dediščina | OPSI / CC BY 4.0 |
| OJPP / brezavta.si | javni prevoz (načrtovanje) | skupnostni odprti podatki |
| Open-Meteo / wttr.in | vreme, zrak | CC BY 4.0 |

Vsak vir je v UI izrecno označen; ko javni vir odpove, aplikacija pošteno degradira (rezerve, sporočila).

## Zagon

```bash
bun install
bun run db:generate      # Prisma client (lokalno SQLite)
bun run dev              # http://localhost:3000
```

Preverba pred oddajo:

```bash
bun run verify           # typecheck + lint + testi + zgradba
```

> Opomba: nekateri testi (`tests/open-data.*`, `overpass`, `stays`) kličejo ŽIVE javne API-je — brez omrežja preskoči tiste datoteke, npr. `bun test tests/$(ls tests | grep -v 'open-data\|overpass\|stays')`.

## Testi

- Enote/pure logike: `bun test` (301 testov · 2237+ expect).
- Brskalniški smoke scenariji (Playwright, lokalno/produkcija): `.playwright-cli/*.cjs` (gitignorirani, uporaba `node .playwright-cli/<ime>.cjs <baseUrl>`).

## Arhitektura

- `src/lib/*` — čiste, testabilne plasti (brez Reacta/Leafleta) za vsako domeno (guide, trip-plan, day-track, budget, poi, rkd, public-transport, destinations, share-trip, gpx, print).
- `src/app/api/*` — strežniški posredniki (OSRM, Overpass, RKD data, transit, share …) z varstvom vnosa in časovnimi omejitvami.
- `src/components/home/*` — UI: vodič, zemljevid (map-section), plošče, dialogi.
- Vsa stanja, ki bi zahtevala `setState` v efektih, so **izpeljana/ključana** (React Compiler čisto).

## Deploy

- **Produkcija (Vercel)**: avtomatsko iz GitHub `main` (`i-feel-slovenia.vercel.app`).
- **GitLab**: priporočen ogled na veji `sandbox/guided-ux-line` (GitLab `main` vsebuje obnovljeni platformni projekt — obe liniji sta namenoma ločeni).

## Varnost

- Skrivnosti (API ključi, žetoni) se ne shranjujejo v kodo/worklog; lokalno le v `.env.local` / `.git/config` (gitignorirano).
- Po deljenju žetona v klepetu je priporočena rotacija.
