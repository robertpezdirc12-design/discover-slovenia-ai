# Discover Slovenia AI

Vodnik po Sloveniji in Balkanu: vodeni tok (regija, interesi, dnevi, tempo),
zemljevid z odprtimi podatki (OpenStreetMap, ARSO, Open-Meteo), iskanje
prenočišč, deljiva pot (`/pot/[koda]`) in osebna priporočila iz resničnega
profila uporabnika.

## Zahteve

- Node.js **20.9+** (priporočeno 22/24)
- [Bun](https://bun.sh) 1.2+
- PostgreSQL 16 (lokalno prek Dockerja ali gostovan v Neon/Supabase/Railway)

## Lokalni zagon

```bash
cp .env.example .env          # Windows: Copy-Item .env.example .env
docker compose up -d          # Postgres na localhost:5432
bun install
bun run db:deploy             # uveljavi migracije
bun run dev                   # http://localhost:3000
```

Preveri, da je baza dosegljiva: `GET /api/health` → `{ "ok": true, "db": "up" }`.

## Okoljske spremenljivke

| Spremenljivka | Obvezna | Opis |
|---|---|---|
| `DATABASE_URL` | da | PostgreSQL connection string (s poolingom v produkciji) |
| `NEXT_PUBLIC_SITE_URL` | priporočeno (produkcija obvezno) | Javni URL za canonical, Open Graph, JSON-LD in privzete prijavne povezave |
| `RESEND_API_KEY` | za prijavo | API ključ Resenda za pošiljanje enkratnih prijavnih povezav |
| `AUTH_EMAIL_FROM` | za prijavo | Potrjen pošiljatelj, npr. `Discover Slovenia <prijava@tvoja-domena.si>` |
| `AUTH_URL` | neobvezno | URL za prijavne povezave, če se razlikuje od `NEXT_PUBLIC_SITE_URL` (preview, lokalni test) |
| `CRON_SECRET` | za čiščenje | Skrivnost za `/api/cron/cleanup`; brez nje je čiščenje onemogočeno |

`AUTH_URL` se bere ob vsaki zahtevi; `NEXT_PUBLIC_SITE_URL` se vgradi ob
build-u. Brez `RESEND_API_KEY` ali `AUTH_EMAIL_FROM` se v razvoju prijavna povezava
izpiše v terminal in prikaže v prijavnem dialogu. V produkciji je prijava v
tem primeru zavrnjena s 503 — aplikacija ne izda povezave brez dostave.

Nikoli ne committaj `.env`; v repozitoriju je samo `.env.example`.

## Seja in osebni profil

- Prijava poteka z **enkratno povezavo na e-pošto** (magic link). Povezava
  velja 15 minut, je uporabna enkrat, v bazi pa je shranjen samo njen SHA-256
  hash. Uporabnik se ustvari ob uspešni potrditvi povezave.
- Seja je **strežniška**: v piškotku je naključen žeton, v bazi pa samo njegov
  SHA-256 hash. Piškotek je `httpOnly`, `SameSite=Lax`, v produkciji `Secure`,
  velja 30 dni. Odjava prekliče samo sejo v tem brskalniku; profil se z
  e-poštno prijavo obnovi.
- Vodeni tok se sinhronizira v `UserProfile.guideData`; priporočila na domači
  strani se izračunajo iz interesov, regije, tempa in rezervacij (brez fiksnih
  odstotkov).
- Rezervacije so per-user (`StayReservation.userId`), zato isti objekt lahko
  shranita dva uporabnika, isti uporabnik pa ne more podvojiti vnosa.
- Brez prijave rezervacija in vodeni tok ostaneta v `localStorage`; prijava
  ju nato sinhronizira v profil. Ob spremembi že zaključenega vodiča se
  priporočila na domači strani osvežijo.

Prijavne povezave pošiljamo prek Resenda. V produkciji morata biti nastavljena
`RESEND_API_KEY` in potrjen `AUTH_EMAIL_FROM`; brez tega prijava zavrne z 503.
V razvoju se povezava namesto pošiljanja izpiše v terminal in dialog. Stari
demo profili brez e-pošte se lahko še uporabljajo do poteka seje, a jih ni
mogoče obnoviti; novi profili so vezani na e-pošto in obnovljivi.

### Izvoz in izbris podatkov

- `GET /api/account/export` vrne e-pošto, ime, vodič in rezervacije
  prijavljenega uporabnika kot JSON (brez sejnih in prijavnih žetonov).
- `DELETE /api/account` trajno izbriše uporabnika; kaskadno se odstranijo
  seje, profil in rezervacije, posebej pa še prijavne povezave za e-pošto.
  Lokalni vodič v brskalniku ostane, dokler ga uporabnik ne počisti z
  »Začni znova«.
- Oba klica sta v pogovornem oknu **Profil**. Deljene poti niso vezane na
  uporabnika in se z izbrisom profila ne odstranijo; potečejo po 90 dneh.

### Dnevno čiščenje

`GET /api/cron/cleanup` (Vercel Cron, dnevno ob 3:00) odstrani potekle seje,
potekle in uporabljene prijavne povezave, deljene poti, starejše od 90 dni, ter
stare demo uporabnike **brez e-pošte** in brez aktivne seje, ki niso bili
aktivni 60 dni. Profili z e-pošto se ne brišejo samodejno. Ruta je zaklenjena
z `CRON_SECRET`; brez njega vrne 503.

## Skripti

| Ukaz | Namen |
|---|---|
| `bun run dev` | razvojni strežnik |
| `bun run build` | `prisma generate` + produkcijski build |
| `bun run start` | produkcijski strežnik |
| `bun run typecheck` | TypeScript brez emita |
| `bun run lint` | ESLint |
| `bun test` | unit testi |
| `bun run db:deploy` | migracije v produkciji/CI |
| `bun run db:migrate` | nova migracija v razvoju |
| `bun run db:studio` | Prisma Studio |

## Deployment (Vercel)

1. Ustvari Postgres (npr. Neon) in kopiraj pooled connection string.
2. V Vercelu nastavi `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`,
   `RESEND_API_KEY` in `AUTH_EMAIL_FROM`. Pošiljateljsko domeno potrdi v
   Resendu; za preview lahko dodaš `AUTH_URL`.
3. Build command je že v `package.json` (`prisma generate && next build`).
4. Pred prvim obiskom zaženi `bunx prisma migrate deploy` — za migracije
   uporabi **neposredno (nepooled) povezavo**, ker pooled PgBouncer URL ni
   primeren za `migrate deploy` (npr. `DATABASE_URL="<direct-url>" bunx prisma migrate deploy`).
   Pred menjavo naredi varnostno kopijo. Migracije so:
   `20261020000000_init`, `20261020010000_sessions_personalization`,
   `20261020020000_shared_trip_created_at_index` in
   `20261020030000_email_magic_link`.
   Pri obstoječi bazi, ustvarjeni z `db push`, najprej primerjaj dejansko
   stanje sheme. Če vsebuje tabele `User`, `Session`, `UserProfile`,
   `StayReservation`, `SharedTrip` in indeks `SharedTrip_createdAt_idx`, po
   pregledu označi prve tri migracije kot uporabljene
   (`prisma migrate resolve --applied <migration>`), nato pa s
   `migrate deploy` uveljavi še e-poštno migracijo. Če baza že vsebuje tudi
   `User.email` in tabelo `LoginToken`, lahko označiš vse štiri. Brez
   preverjanja ne označuj novih migracij kot uporabljenih.
5. `vercel.json` nastavi dnevni cron na `/api/cron/cleanup`; preveri, da je
   `CRON_SECRET` nastavljen tudi v produkcijskem okolju.
6. Preveri prijavo z resničnim e-poštnim naslovom, obnovitev profila,
   izvoz, izbris in odjavo. Brez Resend konfiguracije bo prijava namenoma
   vrnila 503.

SQLite ni primeren za Vercel: datotečni sistem je efemeren in write-i se izgubijo.

## Znane omejitve

- Prijava je magic link prek Resenda. Če ponudnik ne deluje, se novi
  uporabniki ne morejo prijaviti; obstoječe seje delujejo do poteka. IP rate
  limiting je per-instance in best-effort (brez globalnega Redis kvota);
  omejitev treh povezav na e-poštni naslov v 15 minutah se dodatno preverja v
  bazi, zato velja tudi med instancami.
- Stari demo profili brez e-pošte niso obnovljivi; po poteku seje jih dnevni
  cron odstrani po 60 dneh od zadnje aktivnosti. Profili z e-pošto ostanejo
  do izbrisa.
- Magic link je standardno občutljiv, če ga prejemnik posreduje naprej:
  vsak, ki povezavo prvi potrdi, ustvari sejo za ta e-poštni naslov. Povezava
  je enkratna in poteče v 15 minutah.
- Deljene poti (`/pot/[koda]`) so anonimne in nimajo lastnika ali možnosti
  preklica; povezava poteče po 90 dneh, zapis pa počisti dnevni cron, obisk
  potekle povezave ali naslednje deljenje. Pred javnim zagonom razmisli o
  lastništvu in takojšnjem preklicu.
- Če isto pot urejata dve napravi hkrati, zadnji uspešni PUT zmaga; ob
  nalaganju se primerja `updatedAt`. Za produkcijo je priporočljivo
  strežniško verzioniranje ali optimistic locking.
- Fotografije prenočišč se v peskovniku iščejo prek `z-ai` CLI; v produkciji
  uporabi licenciranega ponudnika ali funkcijo odstrani.
- Cene so indikativne ocene, ne uradni ceniki; Booking.com ni integriran.
- Pravna politika zasebnosti še ni dokončna: manjkajo upravljavec, kontakt
  in pravna podlaga.
