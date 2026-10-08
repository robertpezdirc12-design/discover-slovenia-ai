# RECOVERY MODEL MATRIX — 1.163.4 (39) ↔ 2.x (27)

> **Namen (issue #2 §4):** klasifikacija VSEH 39 modelov izvirne produkcijske
> sheme ([`docs/recovery/schema-1.163.4.prisma`](recovery/schema-1.163.4.prisma),
> Postgres/Neon, izgubljen ob incidentu 2026-10-06) proti aktivni 2.x shemi
> (27 modelov). **Nič ni obnovljeno na slepo** — vsaka vrstica ima akcijo,
> razlog in dokaz.
>
> **Prenos podatkov** izvaja [`scripts/migrate-legacy-data.ts`](../scripts/migrate-legacy-data.ts)
> (idempotenten, `--dry-run`/`--apply`, E2E testiran v
> `tests/legacy-migration-e2e.test.ts`). »DA« pomeni mehanski prenos;
> »NE (arhiv)« pomeni, da podatki ostanejo v backupu (korak 1 runbooka) —
> nikoli se ne izbrišejo in nikoli se ne izgubijo brez sledi.

**Legenda akcij:** `RESTORE` potreben in manjka · `RECONCILE` obstaja drugače ·
`KEEP` že pravilno obstaja · `RETIRE` ni več potreben (z razlogom).

**Povzetek: RESTORE 0 · RECONCILE 14 · KEEP 0 · RETIRE 25** — noben model ne
manjka za delujoč 2.x (P0/P1 sta zaključena brez njih); vsi skupni so bili v
rekonstrukciji ZAVESTNO preoblikovani (zato KEEP 0), 25 pa je upokojenih z
eksplicitnimi razlogi. **Brez izgube funkcij:** vsaka upokojitev je bodisi
( a ) funkcija, ki je v 2.x nadomeščena z drugim kanonom (npr. `Owner` →
`User.role="partner"`), bodisi ( b ) zavestno odložena plast (matrika §12,
issue #3), bodisi ( c ) v nasprotju z 0-AI odločitvijo lastnika
(`AIUsageLog`).

## 1. RECONCILE — obstaja drugače; prenos je definiran (14)

| Model (1.163.4) | 2.x cilj | Razlike in preslikava | Prenos |
|---|---|---|---|
| `User` | `User` | jedro (id/email/passwordHash) identično; legacy `preferences` JSON → ločena plast `UserPreference` (source `IMPORTED`); `name` nullable → `email` (identiteta, ne izmišljeno); email-verifikacija/`tokenVersion` ne obstajajo v 2.x (bodoča želja). **bcrypt zapisi se preverjajo** (`src/lib/password.ts` — prijava brez izgube). | **DA** |
| `SavedItinerary` | `TravelJourney` | `itinerary` JSON → kanonski `data` (SharedPlan — normalizacija dnevi/lokacije, isto pravilo kot `normalizePlanInput`, a strožje: prenese se samo pot z ≥1 razpoznavno lokacijo); `name` → `title` (brez imena: fiksna oznaka »Prenesena pot«); `editTokenHash`/`views`/`contentVersion` izpadli (2.x lastništvo = račun); `dateStart/dateEnd` sta v 2.x novi (null ob prenosu). Anonimne poti (userId null) se NE prenesejo — 2.x zahteva lastnika (iskreno poročano). | **DA** |
| `TripCollaborator` | `TripCollaborator` + `TripInvite` | v 1.163.4 ena tabela (status + inviteToken); 2.x ločuje sodelovanje (journeyId+userId+role) od vabil (žeton+status). Prenese se SAMO `ACTIVE` z uporabnikom; `COMMENTER` → `VIEWER` (2.x nima komentar-vloge); PENDING vabila izda lastnik znova. | **DA** (samo ACTIVE) |
| `TripComment` | `TripMessage` | stari komentarji = zgodovina skupinskega klepeta (isti vzorec kot 1.131.0); `isAI` → `isAiBot` (strežniška značka); `payload` (AI predlogi krajev) izpade — 2.x @AI koncept je drugačen (deterministični `trip-chat-engine`). | **DA** |
| `TripPoll` | `TripPoll` + `TripPollOption` | `options` JSON niz → ločena tabela možnosti (sortOrder); `closed` → `status OPEN/CLOSED`; `authorClientId` → `createdBy` (lastnik pote — 2.x zahteva račun). | **DA** (brez glasov) |
| `TripPollVote` | `TripPollVote` | glas je bil vezan na ANONIMNI `voterId`; 2.x zahteva `userId` FK — anonimnih glasov NI MOGOČE preslikati brez lažnega izvora (iskrena odločitev: glasovi se ne prenesejo, anketa se; uporabniki glasujejo znova prijavljeni). | **NE** (vsebina glasov; arhiv) |
| `Listing` | `Listing` | 2.x Listing je minimalni register (name/category/lat/lng/address) — statusni stroj/partner/sponsored/draftNudge plast ne obstaja (partner plast 2.x = `Product`). `destinationName` ≠ `region` — se NE preslika (iskrena null). | **DA** (osnovni stolpci) |
| `Product` | `Product` | `price` Float EUR → `priceCents` Int (×100 zaokroženo); `category` (food/wine/…) → `kind="product"` (1.163.4 tržnica = fizični izdelki); status preslikan (published/pending/draft/rejected; neznan → draft); `seller*`/`longDescription`/`compareAtPrice` izpadli (2.x nima stolpcev). | **DA** |
| `Order` | `Order` + `OrderItem` | `orderNumber`/`buyer*`/naslov izpadli (2.x gost = userId/visitorKey — buyerEmail se NE prenese, ker 2.x nima stolpca; arhiv: backup); `items` JSON → vrstice (samo za prenesene izdelke, cena iz zapisa — nikoli izmišljena); `total` Float → `totalCents`; `demo` KONSERVATIVNO `true` (legacy nima zastavice — dvoumen prihodek NIKOLI ne vstopi v payout osnovo). Neznan status → arhiv (status poganja izplačila). | **DA** |
| `AuditLog` | `AuditLog` | `actorRole` (admin/owner/system/stripe) → `actorType` (owner/partner/system/system); `resourceType/resourceId` → `entityType/entityId` (brez obeh → arhiv); `actorEmail` → `actorId` povratno. Zgodovina se ohrani (append-only kanon obeh). | **DA** |
| `ProcessedStripeEvent` | `ProcessedStripeEvent` | legacy `id` = `evt_…` → 2.x `eventId` (unique — dedup kanon); `eventType` → `type`. | **DA** |
| `Consultation` | `Consultation` | skoraj 1:1; `answerSource "ai"` → `"manual"` (2.x odgovori so deterministični iz registra — 0-AI); `recommendedPartners` izpade (2.x nima stolpca). | **DA** |
| `Lead` | `Lead` | `businessName`/`message` → `note` (»podjetje — sporočilo«; oba DEJSTVI iz vrstice); `businessType` → `interest`; status `nov/kontaktiran` → `new/contacted`; `zakljucen` → arhiv (zaključen lead ne potrebuje akcije). | **DA** |
| `NewsletterSubscriber` | `NewsletterSubscriber` | `source` izpade (2.x nima stolpca); email+createdAt mehansko. | **DA** |

## 2. RETIRE — ni več potreben, z razlogom (25)

| Model (1.163.4) | Razlog (dokaz) | 2.x nadomestilo |
|---|---|---|
| `Owner` | B2B lastnik je bil ločen račun z naročnino | `User.role="partner"` (odobri skrbnik prek `/admin` — `Lead` approve, P0-H) + `src/lib/partner-session.ts` |
| `UserTripItem` | strežniška refleksija zbirke »Moja pot« | localStorage `dai:my-trip` + `buildPlanFromMyTrip` (klientna plast — P0 odločitev: anonimna zbirka brez računa) |
| `SavedItineraryRevision` | strežniške revizije vsebine | 2.x nima (plan-edit undo je klientni sklad 10 — `plan-edit-panel.tsx`); prihodnja želja, ločena naloga |
| `TripGuide` | skupnostni vodniki avtorjev | **§8 issue #3 — zavestno odloženo na lastnika** (odprta točka matrike P1) |
| `TripVote` | anonimno glasovanje za lokacije | 2.x nima funkcije; naslednik koncepta = ankete (`TripPoll`) |
| `TripLike` | srčki na deljeni povezavi | 2.x nima funkcije (ni bila del P0/P1 obsega) |
| `TripDiaryEntry` | potni dnevnik (tekstovni spomini) | 2.x nima (kandidat za prihodnjo fazo; ni v issuejih #1–#3) |
| `ListingEvent` | analitika lokalov (impression/click/lead) | 2.x nima analitične plasti |
| `Experience` | ločena tržnica izkušenj | 2.x: izkušnje = `Product.kind="experience"` (enotna tržnica, en statusni stroj) |
| `Review` | UGC mnenja obiskovalcev | 2.x zaupanje = atestacije/statusi (kanon `booking.ts` — nikoli self-asserted dokaz) |
| `Booking` | B2C checkout izkušenj (1.163.4 tok) | 2.x B2C = `Order`/`OrderItem` (Stripe Checkout, P0-E); potne rezervacije = `TripReservation` — semantično DRUGAČEN tok, preslikava bi izmišljevala pomen |
| `ExperienceAvailability` | koledar kapacitet izkušenj | 2.x inventar = `Product.stock` (en vir resnice) |
| `ExperienceAvailabilityDay` | dnevni prepisi/blackout | isto — brez koledarja |
| `JourneyBooking` | provider potrditve (shareId/sessionKey veza) | 2.x istoimenska lupina (`ref/title/status/payload`, Go Mode priponke) je SEMANTIČNO drugačna — starih zapisov ni mogoče preslikati brez lažnega izvora (ročni pregled: runbook §6.4) |
| `TripExpense` | uporabniški stroški na poti | 2.x nima (issue #4 1.x — ni del 2.x obsega) |
| `TripDocument` | metapodatki dokumentov poti | 2.x nima |
| `Sponsorship` | sponzorirana mesta lokalov | 2.x monetizacija = affiliate provizije (`AffiliateClick`/`CommissionEntry`) + tržnica |
| `PageView` | funnel analitika strani | 2.x nima analitične plasti |
| `AnalyticsEvent` | vedenjski dogodki | isto |
| `AIUsageLog` | dnevnik stroškov LLM klicev | **0-AI projekt** (lastnikova izrecna odločitev — 0 LLM klicev, vse skripte) — ta model bi bil VEDNO prazen; njegova odsotnost JE izraz arhitekture |
| `LocalQuestion` | javni Q&A z AI odgovori | naslednik = `Consultation` (zasebni žeton + deterministični `consultation-fallback.ts`, P0-H §20) |
| `PushSubscription` | Web Push naročnine (VAPID) | **PWA push ni implementiran** (P1-C iskrena odločitev — ni infrastrukture); notifikacije 2.x = in-app `Notification` inbox |
| `CommissionInvoice` | mesečni provizijski računi | 2.x provizije = `CommissionEntry` (izključno iz poročil) + `recalculate-status` cron (P0-H) |
| `PayoutEntry` | knjigovodske postavke izplačil | 2.x izplačila = `Order.payoutStatus` materializacija (not_due→due→processing→paid, P0-E §11) |
| `PayoutSettlement` | mesečne poravnave | isto |

## 3. NOVI 2.x modeli (12) — ne obstajajo v 1.163.4

| Model | Zakaj je nov (izvor) |
|---|---|
| `Destination` | semenska hramba kanonskega registra 38 destinacij (`src/lib/slovenia-data.ts` — vir resnice ostaja register; tabela je aditivna hramba) |
| `ContactMessage` | kontaktni obrazec (hramba ≤12 mesecev — politika) |
| `TravelJourney` | kanonska deljena pot v oblaku (P0-E — naslednik `SavedItinerary` z lastništvom prek računa; glej RECONCILE zgoraj) |
| `TripInvite` | vabila z žetoni ločeno od sodelovanj (P0-E) |
| `TripReservation` | rezervacijske vrstice na poti (IDEA/CONFIRMED/CANCELLED — 14-statusni stroj je v `booking.ts`) |
| `TripPollOption` | možnosti anket kot tabela (ne JSON) |
| `OrderItem` | vrstice naročil z zajemom imena/cene (resnica ob nakupu) |
| `AffiliateClick` | sledenje klikanjem brez PII (v2.5.0 vzorec) |
| `CommissionEntry` | provizijski dnevnik izključno iz poročil (P0-H) |
| `UserPreference` | P1-A §1 — preference 9 fiksnih ključev, izvor vedno razkrit |
| `MemoryItem` | P1-A §2 — dolgoročni spomin (active mehko brisanje, retention 90 dni) |
| `WatchItem` | P1-C §4 — uporabniška spremljanja (4 vrste) |
| `Notification` | P1-C §10 — in-app inbox z dedupe |

> **Iskren opombe:** (1) 2.x `JourneyBooking` (lupina Go Mode) nima aktivnih
> `db.journeyBooking` klicev — pripravljena struktura, ohranjena aditivno
> (kanon »samo dodajaj«); (2) `UserTripItem` ekvivalent obstaja SAMO kot
> klientna plast — to je zavestna odločitev P0 (zbirka deluje brez računa).

## 4. Zgostitev po podatkovnih virih (issue #2 §3)

Kritične tabele za integrity vrata (`--expect-zero` v `db:integrity`):
`User`, `NewsletterSubscriber`, `Consultation`, `Lead`, `ProcessedStripeEvent`,
`AuditLog` (celoten prenos brez izgube). Tabele z ZAVESTNIM delnim prenosom
(delta > 0 je dokumentiran z razlogom v poročilu skripte): `SavedItinerary`
(anonimne/nerazčrljive → arhiv), `TripPollVote` (anonimni glasovi),
`Order` (neznan status → arhiv), `Product` (neveljavna cena → arhiv).
