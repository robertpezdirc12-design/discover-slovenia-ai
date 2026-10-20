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
| `NEXT_PUBLIC_SITE_URL` | priporočeno | Javni URL za canonical, Open Graph in JSON-LD |

Nikoli ne committaj `.env`; v repozitoriju je samo `.env.example`.

## Seja in osebni profil

- Prijava ustvari uporabnika in **strežniško sejo**: v piškotku je naključen
  žeton, v bazi pa samo njegov SHA-256 hash. Piškotek je `httpOnly`,
  `SameSite=Lax`, v produkciji `Secure`, velja 30 dni.
- Vodeni tok se sinhronizira v `UserProfile.guideData`; priporočila na domači
  strani se izračunajo iz interesov, regije, tempa in rezervacij (brez fiksnih
  odstotkov).
- Rezervacije so per-user (`StayReservation.userId`), zato isti objekt lahko
  shranita dva uporabnika, isti uporabnik pa ne more podvojiti vnosa.
- Brez prijave rezervacija in vodeni tok ostaneta v `localStorage`; prijava
  ju nato sinhronizira v profil. Ob spremembi že zaključenega vodiča se
  priporočila na domači strani osvežijo.

To **ni produkcijska avtentikacija**: ni gesla, e-pošte ali OAuth ponudnika.
Profil je vezan na brskalnik; po čiščenju piškotkov ali odjavi nastane nov
profil (tudi pri enakem imenu). Pred javnim zagonom dodaj OAuth ali magic-link
prijavo ter dopolni demo politiko zasebnosti na `/zasebnost` (upravljavec,
kontakt, pravna podlaga).

### Izvoz in izbris podatkov

- `GET /api/account/export` vrne ime, vodič in rezervacije prijavljenega
  uporabnika kot JSON (brez sejnih žetonov).
- `DELETE /api/account` trajno izbriše uporabnika; kaskadno se odstranijo
  seje, profil in rezervacije. Lokalni vodič v brskalniku ostane, dokler ga
  uporabnik ne počisti z »Začni znova«.
- Oba klica sta v pogovornem oknu **Profil**. Deljene poti niso vezane na
  uporabnika in se z izbrisom profila ne odstranijo.

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
2. V Vercelu nastavi `DATABASE_URL` in `NEXT_PUBLIC_SITE_URL`.
3. Build command je že v `package.json` (`prisma generate && next build`).
4. Po prvem deployu zaženi `bunx prisma migrate deploy` — za migracije
   uporabi **neposredno (nepooled) povezavo**, ker pooled PgBouncer URL ni
   primeren za `migrate deploy` (npr. `DATABASE_URL="<direct-url>" bunx prisma migrate deploy`).
   Pri obstoječi bazi, ustvarjeni z `db push`, najprej primerjaj dejansko
   stanje sheme in označi ustrezne migracije kot uporabljene
   (`prisma migrate resolve --applied <migration>`); če baza že vsebuje
   tudi `User`/`Session`/`UserProfile`, označi obe migraciji.

SQLite ni primeren za Vercel: datotečni sistem je efemeren in write-i se izgubijo.

## Znane omejitve

- Prijava je demo brez gesla (glej zgoraj). Seje so v PostgreSQL; rate
  limiting je per-instance in best-effort (brez globalnega Redis kvota).
- Deljene poti (`/pot/[koda]`) so anonimne, nimajo lastnika ali TTL ter se
  ne izbrišejo z izbrisom profila. Pred javnim zagonom dodaj potek in
  možnost preklica.
- Če isto pot urejata dve napravi hkrati, zadnji uspešni PUT zmaga; ob
  nalaganju se primerja `updatedAt`. Za produkcijo je priporočljivo
  strežniško verzioniranje ali optimistic locking.
- Fotografije prenočišč se v peskovniku iščejo prek `z-ai` CLI; v produkciji
  uporabi licenciranega ponudnika ali funkcijo odstrani.
- Cene so indikativne ocene, ne uradni ceniki; Booking.com ni integriran.
