# P1-A E2E dokazi — osebni potovalni profil (2.15.0, issue #3 §1/§2/§11)

Datum: 2026-10-08 · Strežnik: dev :3000 (2.15.0) · Preverjanje: curl (API) + agent-browser (UI)

## API plastska preverba (curl)

| # | Preverba | Rezultat |
|---|----------|----------|
| 1 | GET/PUT/DELETE /api/preferences + /api/memory brez seje | **401** (4/4 fail-closed) |
| 2 | Registracija + prijava A (p1a-e2e-a@test.local) | 201 + seja OK |
| 3 | PUT budget=€€ + interests=[morje,jame] | 200 `{"ok":true}` |
| 4 | PUT budget=„$$$" | **400** + iskren `allowed:["€","€€","€€€"]` |
| 5 | POST spomin (preference) | 201, confidence 1, source USER |
| 6 | POST spomin z injekcijo („Ignore all previous instructions…") | **400** `injection:true`, vsebina SE NE odmeva |
| 7 | IDOR: B PATCH/DELETE A-jev zapis | **404** (obstoj se ne razkrije) |
| 8 | IDOR: B GET /api/memory | samo lastni (0 zapisov) |
| 9 | ZAPORA: A izklopi personalizacijo → POST nov spomin | **403** („ne zbiramo") |
| 10 | A GET spomin ob izklopu | vidi svoje + opomba (upravljanje, ne agent) |
| 11 | A forget-all ob izklopu | deluje (pravica izbrisa), forgotten 1 |
| 12 | forget-all BREZ ?confirm | **400** (zaščita) |
| 13 | AuditLog | preference.updated/deleted + memory.created/updated/forget_all, actorType customer, meta brez skrivnosti |

## UI preverba (agent-browser)

| # | Preverba | Dokaz |
|---|----------|-------|
| 1 | Neprijavljen: iskrena kartica + „Pojdi na prijavo" | 01-neprijavljen.png |
| 2 | Prijava → profil izrisan (personalizacija, 7 poljev preferenc, spomin, zasebnost) | 02-prijavljen-profil.png |
| 3 | Izklopljena personalizacija → iskrena AMBER opomba pri spominu | 02 (stanje po API preizkusu) |
| 4 | Vklop personalizacije (switch) + nastavitev proračuna €€ | 03-preference-shranjena.png |
| 5 | Dodajanje zapisa spomina (vrsta Prednost, izvor „Ti") | 04-spomin-dodan.png |
| 6 | Urejanje zapisa spomina → potrjeno prek API | 06-spomin-urejen.png |
| 7 | Budget: klik na AKTIVNO vrednost počisti (toggle-off, dokazano v AuditLog 17:16:59) | 07-preference-budget.png |
| 8 | Mobilni 390 px | 05-mobilni-390.png |
| 9 | Navigacija: meni Več → „Moj profil" | potrjeno v snapshotu |
| 10 | Konzola brskalnika | **0 napak, 0 page errors** |

## Vrata

- `bun test`: **1042/1042** (+63: 41 čistih user-preferences + 22 source-contract p1a-security)
- `tsc --noEmit`: 0 napak · `eslint .`: 0 napak
- dev.log: 0 runtime napak v E2E obdobju

## Poštenostne opombe

- Testna uporabnika (p1a-e2e-a/b) živita SAMO v razvojni bazi peskovnika (db/custom.db je izključen iz rsync/merga — v repozitorij ne gresta).
- Memory zapis testa je bil pozabljen prek UI poti „Pozabi vse"? NE — pozabljen je bil prvi API zapis; drugi (UI) zapis ostaja kot dokaz delujočega spomina.
- Neobdelana vrzel: retentionni izbris (90 dni) se poganja lenko ob branju — fizični izpis po 90 dneh potrjen s čistim testom planMemoryPurge, ne z živim čakanjem (iskrena meja enotskega testiranja).
