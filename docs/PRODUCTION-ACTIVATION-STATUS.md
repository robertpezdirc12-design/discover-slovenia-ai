# PRODUCTION ACTIVATION STATUS — master matrika ponudnikov

> **Vir resnice:** [`src/lib/supply/production-matrix.ts`](../src/lib/supply/production-matrix.ts) —
> stanja so IZPELJANA MEHANSKO (`src/lib/supply/activation-check.ts`), nikoli
> zapisana ročno. Ta dokument jih samo izpisuje. Če se matrika in ta tabeli
> razideta, velja matrika.
>
> **Zagon:** `bun run activation:check`

**Stanje rekonstrukcije 2.x (P0-B, 2026-10-07):** 19 ponudnikov —
🟢 **1 dejansko živ** · 🔵 **1 konfiguriran** · ⚪ **10 nekonfiguriranih** ·
🔴 **7 zunanjih ovir**.

## Kaj štiri stanja pomenijo (iskrenostni kanon)

| Stanje | Pomen |
|---|---|
| 🟢 **ACTIVE** | Deluje zdaj — brez zadržkov. |
| 🔵 **CONFIGURED** | Koda živa, a NAMERNO stopnja nižje — eskalacija šele ob dokazu (npr. živi partnerji s pini). |
| ⚪ **NOT_CONFIGURED** | Aktivacija je v **naših** rokah: env nastavitev, obnova sloja (P0-C/P0-D) ali razširitev registra. |
| 🔴 **BLOCKED** | **Zunanja** ovira: odobritev partnerja, pogodba (B4B) — env tega ne more odkleniti. |

Kanon izvirnika ohranjen: **CODE_READY ≠ PRODUCTION_ACTIVE** in
**affiliate preusmeritev ≠ inventar**.

## RECONCILE: 16 izvirnikovih + 3 novi

Izvirnikova omrežja (16 ponudnikov, izgubljeno ob incidentu 2026-10-06) ni
bil kopiran slepo — usklajen je z 2.x resnico po načelu „en vir resnice":

- **10/16** je ali živih v 2.x (booking, getyourguide, omio, own) ali
  ohranjenih kot /go vsebina z iskrenim razlogom (viator, tiqets,
  skyscanner, airalo, travelpayouts, discovercars, worldnomads, safetywing);
- **4/16** odkritovalne plasti (fsq, osm, sto, kiwitaxi) čakajo obnovo
  **P0-C** — specifikacija in del kode so v arhivu (worklog 2033 vrstic,
  tool-results, README);
- **3 novi** po vzorcu MindTrip (2.5.0): **Kiwi.com** (leti — naslednik
  SkyScanner vrzeli v booking plasti), **Rentalcars.com** (najem — naslednik
  DiscoverCars zasnove), **osm-fuel** (bencinske črpalke, odprti podatki
  ODbL, izrecno 0 % provizije).

## Matrika (izpis iz `bun run activation:check`, stanje brez env žetonov)

| Ponudnik | Zmožnost | Dostop | Koda 2.x | Stanje | Kaj odklepa aktivacijo |
|---|---|---|---|---|---|
| **osm-fuel** | 66 bencinskih črpalk (ODbL) | odprti podatki | LIVE | 🟢 ACTIVE | — (deluje) |
| **own** | Lastna tržnica + geo pini | lastni booking | LIVE | 🔵 CONFIGURED | dokaz živih partnerjev s pini |
| booking | Nastanitve | affiliate povezava | LIVE | ⚪ | `AFFILIATE_BOOKING_ID` (+ TMPL) |
| getyourguide | Izkušnje | affiliate povezava | LIVE | ⚪ | `AFFILIATE_GYG_ID` (+ TMPL) |
| kiwi | Leti | affiliate povezava | LIVE | ⚪ | `AFFILIATE_KIWI_ID` (+ TMPL) |
| rentalcars | Najem avtov | affiliate povezava | LIVE | ⚪ | `AFFILIATE_RENTALCARS_ID` (+ TMPL) |
| omio | Vlaki/avtobusi | affiliate povezava | LIVE | ⚪ | `AFFILIATE_OMIO_ID` (+ TMPL) |
| fsq | 125.446 krajev (SI·HR·ME·AL) | odprti podatki | PENDING_RESTORE | ⚪ | P0-C: dataset + loader + licenca |
| osm | Živi POI po viewportu (Overpass) | odprti podatki | PENDING_RESTORE | ⚪ | P0-C: adapter z omejitvami |
| sto | Uradna vsebina (llms.txt) | statična vsebina | PENDING_RESTORE | ⚪ | P0-C: ingest |
| kiwitaxi | Transferji (objavljene cene) | partner feed | PENDING_RESTORE | ⚪ | P0-C: ingest + validacija |
| travelpayouts | Podatkovni API letov | API | CONTENT_LIVE | ⚪ | obnova adapterja + self-serve žeton |
| viator | Vodeni izleti | affiliate povezava | CONTENT_LIVE | 🔴 | odobritev programa + razširitev registra |
| tiqets | Vstopnice | affiliate povezava | CONTENT_LIVE | 🔴 | odobritev prek Awin |
| skyscanner | Leti | affiliate povezava | CONTENT_LIVE | 🔴 | prijava partners.skyscanner.net |
| airalo | eSIM | affiliate povezava | CONTENT_LIVE | 🔴 | odobritev Partner API (OAuth2) |
| discovercars | Najem avtov | affiliate povezava | CONTENT_LIVE | 🔴 | B4B pogodba |
| worldnomads | Zavarovanje | affiliate povezava | CONTENT_LIVE | 🔴 | odobritev programa |
| safetywing | Zavarovanje | affiliate povezava | CONTENT_LIVE | 🔴 | ambassador program |

## Kanonska stanja cen

Vsak vir v registru nosi natanko ENO stanje (vir:
[`src/lib/supply/registry.ts`](../src/lib/supply/registry.ts)):

- **LIVE_PRICE** — lastna živa cena (lastna tržnica);
- **FROM_PRICE** — objavljena „od"-cena vira (KiwiTaxi feed) — znana, NI živ citat;
- **UNKNOWN** — cena se pokaže šele pri partnerju (vse globoke povezave; 2.6.0
  kanon: cena vstopi v zapis šele iz partnerjevega potrdila ob atestaciji);
- **NOT_SUPPORTED** — plast cen izrecno ni podprta (odkrivanje, vsebina, črpalke).

## Varnostni kanon (UNTRUSTED SOURCE)

- Env spremenljivke se preverjajo **SAMO po Boolean prisotnosti** — vrednosti
  se nikoli ne izpišejo (kanarček: `tests/supply-activation.test.ts`).
- Matrika in register sta čista podatka — brez `process.env`, brez db; env
  vbrizga samo tanek CLI (`scripts/activation-check.ts`) ali strežniški sloj.
- Nič iz GitHub recovery vira ni bilo kopirano slepo: matrika nastane iz
  arhiva (specifikacije) + 2.x dejstev, vsaka trditev je preverjena proti
  kodi na mainu (RECOVERY_CLAIM_ONLY oznake živijo v issue #1 P0-A inventuri).

## Runbook po ponudniku (izpis korakov)

`bun run activation:check` izpiše za vsakega ponudnika iskren razlog
trenutnega stanja + numbered korake do aktivacije — enako kot zgoraj
zapisuje `stepsSl` v matriki (strojno berljivo, en vir resnice).
