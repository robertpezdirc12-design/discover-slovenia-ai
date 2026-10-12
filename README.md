# 🇸🇮 Discover Slovenia AI

> **AI potovalni concierge za Slovenijo in jadransko regijo (SI · HR · ME · AL).**
> Načrtovanje večdnevnih potovanj, odkrivanje 38 kuriranih destinacij, zemljevid z
> realnimi koordinatami in deterministični načrtovalnik poti (isti vhod → isti načrt,
> 0 AI žetonov). Od 2.24.0: SKRIPTE NAMESTO AI MODELOV — prosti opis potovanja
> razume deterministična NLU skripta (/api/plan-intent), @AI svetovalec pa odgovarja
> z živim vremenom (Open-Meteo) in citati STO slovenia.info nad istim kanonom.
> Od 2.25.0: SKRIPTNI START ANYWHERE — prilepi povezavo (YouTube/članek/TikTok)
> ali besedilo → SSRF-varovano strežniško branje + ujemanje krajev po korenu
> (slovenski skloni) z registrom 38 destinacij + predlog izhodišča za isti
> deterministični motor (/api/start-anywhere); z-ai-web-dev-sdk odstranjen —
> kanon P1: 100 % deterministično, 0 AI modelov.

**Verzija: 2.37.0 — HIDRACIJSKI MISMATCH NONCE NA JSON-LD (2026-10-12): peti krog poliranja po naročilu »isci po spletu razvijaj primerjaj z najboljsimi na spletu poliraj« — tokrat ŽIVA hidracijska napaka, ki je bila potrjena v konzoli že v POLIR7–9 verifikacijah (»PREDHODNO hidracijsko opozorilo na domači strani«) in je tokrat ujeta z dokazom: React ob hidraciji izpiše »A tree hydrated but some attributes of the server rendered HTML didn't match the client properties«, dev-diff pa razkrije točen vzrok — JSON-LD skripta na domači strani in straneh destinacij nosi CSP nonce (per-zahtevek atribut: middleware postavi x-nonce, stran ga prebere s (await headers()).get(„x-nonce“) in ga da na <script type=„application/ld+json“>; POLIR6 CSP revizija je dokazala nonce glave ≡ nonce skript v isti zahtevi), ob hidraciji pa odjemalec primerja atribut DOM elementa s PRAZNIM nizom v flight podatkih → opozorilo; vsebina JSON-LD je deterministična, razlika je SAMO v atributu nonce: (1) obseg empirično določen (dev :4003 zanesljiv reproduktor, svež kontekst na stran, 9 strani × 2 temi × 6 jezikov): natanko strani z ld+json skripto — / ×6 jezikov in /destinacija/[slug] ×38 slugov ×6, tema- in jezik-neodvisno (kontrola /zemljevid brez opozoril); na produkciji se opozorje pojavlja intermitentno (odvisno od izvora HTML/flight — POLIR9 ga je ulovil živo na domov), popravek pa ga utiša NEODVISNO od sprožitelja, ker je razlika vedno isti atribut; (2) popravek po kanonu react.dev (»suppressHydrationWarning — React will not warn you about mismatches in the attributes and the content of that element. It only works one level deep, and is intended to be used as an escape hatch.«) — na obeh JSON-LD skriptah dodan SAMO atribut suppressHydrationWarning; nonce, dangerouslySetInnerHTML, type ostanejo nedotaknjeni (dokaz CSP neblokirnosti po popravku: DOM .nonce neprazen — 48-znakovni UUID, CSP glava ≡ skripta v isti zahtevi, skripta se izvede, vsebina JSON.parse-veljavna — zaklep POLIR6 živ); enak vzorec zdravlja že <html suppressHydrationWarning> za next-themes v [locale]/layout.tsx — POLIR10 le razširi isti kanon na <script>; (3) raziskava: nextjs.org CSP vodič potrdi naš vzorec (middleware/Proxy → request header → branje v strani = »Reading the nonce«, headers() forsira dinamični render = pričakovano), react.dev pa podaja utišanje atributov; (4) 6 novih testov-zaklepov (tests/hydration-nonce.test.ts, bun:test, source-contract, 0 omrežja/0 DOM/0 AI): source-contract obeh skript (vsi 4 atributi v isti skripti), kanon x-nonce, defenzivna rekurzivna hoja po src/ — natanko 2 ld+json elementa, obe z utišanjem in nonce (+ zaklep poti), regresija <html suppressHydrationWarning> v layoutu, izpisi jsonldScriptHtml (83 vzorcev: 6 jezikov + 38 destinacij ×2) brez žetona »nonce«; živa verifikacija (dev, PRED/PO z git stash): / in /destinacija/bled ×2 temi 0 console.error hidracijskih (prej DA z diffom nonce), kontrola /zemljevid nespremenjena, preliv 0 px @390 (regresija POLIR7/8), zagon health 200 — 0 AI žetonov, 0 novih npm odvisnosti, 0 besedilnih sprememb, 0 i18n sprememb, 1.898/1.898 testov. Prej 2.36.0— WCAG 1.4.3 KONTRAST + ŽIVA NAPAKA NEVIDNE GLAVE (2026-10-12): četrti krog dostopnostnega loka po standardu WCAG 2.1 — tokrat uspešnost 1.4.3 Contrast Minimum (besedilo ≥ 4,5:1, veliko besedilo ≥ 3:1; raziskava: najpogostejša samodejno odkrita kršitev je »brand muted« sekundarno besedilo, priporočilo pa eksplicitni barvni žetoni namesto opacity-zatemnjevanja), izmerjeno z novim dvofaznim revizijskim orodjem na živi produkciji (faza 1: izračunana razmerja iz getComputedStyle + učinkovitih ozadij z hojo prednikov in mešanjem polprosojnih plasti; faza 2 za programsko nedoločljive primere — gradienti, slike, sticky glava — vzorčenje pikslov posnetka VIDNEGA polja s skritim besedilom; pasti: Tailwind 4 oklch() barve zahtevajo pretvorbo prek canvas fillStyle+getImageData, posnetek --full pa laže za vh-postavitve): (1) NAJVEČJA ŽIVA NAPAKA: bela pisava glave na domači strani pri vrhu (scroll 0) je bila NEVIDNA — sticky glava stoji v lastnem pretoku (za njo belo telo), hero se je začel šele 64 px nižje, komentar v kodi pa opozarja natanko na to past (»bela pisava na belem ozadju bi bila nevidna«), ki je prekrivanje nikoli ni sprožilo → hero dobi -mt-16 in se zavleče pod prozorno glavo (standardni vzorec vrhunskih: transparent header nad herojem; dokaz: piksli y 0–64 so zdaj zeleni, znamenje 6,68:1, VLM prej »nearly invisible«; ikone glave zdaj tudi WCAG 1.4.11 ≥ 3:1); (2) SISTEMSKO: svetli --muted-foreground oklch(0.556 0 0) = 4,37:1 na belem — vsak text-muted-foreground na spletišču je odpadel (opombe kartic, mikrocopy, stepper številke 4,35) → oklch(0.525 0 0) = 5,40 na belem / 4,96 na bg-muted / 4,83 na bg-primary/5 / 4,62 na bg-primary/10, temna tema 7,66:1 nedotaknjena; (3) TEMNI HERO GRADIENT: v temni temi je --primary svetlejša zelena (≈ rgb(0,178,0)) → vso belo besedilo heroja je padalo (h1 2,85 < 3, uvod 2,06, statistike 2,70, outline CTA 3,72 — merjeno piksli) → izrecne temne stopnje dark:from-[#0b4d20] dark:via-[#0e5c28] dark:to-[#063615] (čista bela 8,15:1, pod dekorativnimi belimi lisami 5,06:1, white/85 6,41:1); (4) ob živi verifikaciji odkrito in popravljeno še: tagline glave text-white/70 (po prekrivanju 4,47:1 v temni) → /80; tabletka jezikovnega stikalnika »SL« text-primary na steklu (3,41:1 nad herojem) → bela steklena tabletka prek novega propa overHero (običajna oblika na podstraneh ostaja); aria-hidden dekorativni ločili »→« (1,96/2,70) dokumentirani kot WCAG 1.4.3 izjema (dekoracija — vrstni red korakov je v besedilu); 10 novih testov-zaklepov (tests/contrast-wcag143.test.ts: source-contract vseh točk + DETERMINISTIČNA oklch→sRGB matematika po CSS Color 4 matrikah, implementirana v testu z 0 odvisnostmi — zaklepi razmerij za žeton muted-foreground in vse stopnje gradienta); dvofazna revizija 9 strani × 2 temi na produkciji 2.35.0: domov 9 (svetla) + 7 (temna) kršitev → 0, vse ostale prizadete strani (destinacija, načrtuj, zemljevid, tržnica, lokal, vir, kontakt, skupna pot) → 0 (1 dokumentirana izjema); regresija POLIR7/8: 0 px horizontalnega preliva @390 na osrednjih poteh, noga prilepljena, affiliate preusmeritev 302, 0 napak konzole — 0 AI žetonov, 0 novih npm odvisnosti, 1.892/1.892 testov. Prej 2.35.0 — WCAG 1.4.10 REFLOW @320 + STRAN DESTINACIJE (2026-10-11): tretji krog boja proti vodoravnemu prelivu — tokrat po standardu dostopnosti WCAG 2.1 uspešnost 1.4.10 Reflow (vsebina se mora pretočiti pri 320 CSS px brez vodoravnega drsenja; ~30 % mobilnih resolucij je okoli 300–400 px — developer.samsung.com) in strani podrobnosti destinacije, ki je bila izpuščena iz POLIR7 vzorca poti: (1) NAJVEČJA ŽIVA NAPAKA: /destinacija/[slug] je prelivila 161 px ŽE PRI 390 px (DE 276 px @320) — rezervacijska vrstica flex shrink-0 (ni dovolila skrčitve) + nowrap gumb »Leti do Letališče Jožeta Pučnika Ljubljane (SBNZ)« (510 px) → shrink-0 odstranjen, min-w-0 dodan, gumbom whitespace-normal h-auto shrink (tailwind-merge preglasi oba osnovna razreda Button); (2) noga na VSEH straneh v DE 14 px — povezave z enojnimi nemškimi sestavljenkami (»Nutzungsbedingungen« 158 px v stolpcu 128 px) → inline-block max-w-full break-words (empirično dokazano: break-words na inline-flex NE deluje, ker anonymous flex item zadrži min-content); (3) H1 s page-header.tsz (ene spremembe za vse PageHeader klicatelje) break-words — »Nutzungsbedingungen« kot H1 text-3xl je bil 368 px → 64 px preliva na /pogoji-uporabe, »Datenschutzerklärung« 57 px na /politika-zasebnosti; (4) zemljevid aside min-w-0 (predmet mreže min-width:auto — živi dokaz: style.minWidth=0 takoj 4→0; FR/IT/ES 3–4 px @360, 37–44 px @320); (5) partner CTA na domov (»Odpri pri Viator (Tripadvisor)« min 275 px je razširil kartico na 313 px) + NextStepCard CTA (FR »Parcourir les destinations« 251 px → 16 px preliva na /nacrtuj in /trznica) + vzorčni načrti /moja-potovanja (FR »Plan type : Un week-end paisible au bord de la rivière« 423 px! → 138 px preliva) + gost gumb — vsi whitespace-normal h-auto (shrink kjer treba); (6) kartice virov na /vir-podatkov min-w-0 (nowrap URL www.openstreetmap.org/copyright 263 px nedeljiv, 1 px sub-pixel → 0); 21 novih testov-zaklepov (tests/reflow-320.test.ts: source-contract vseh točk + defenzivni zaklepi text-balance/badge osnove); živa verifikacija: destinacija 161→0 @390, vse prizadete poti × jeziki 0 px @320/360, živi tok skupne pote 0 @320, vodeni affiliate klik 302 ohranjen, QR + elipsizacija delujeta, 0 napak konzole — 0 AI žetonov, 0 novih npm odvisnosti, 1.882/1.882 testov. Prej 2.34.0 — ODSTRANITEV VZPOREDNEGA PRELIVA NA MOBILNEM (2026-10-11): sistematičen empirični pregled vseh 27 javnih poti × 6 jezikov na produkciji (390 px, meritev scrollWidth−clientWidth + getBoundingClientRect dokazi) je odkril 4 vzorce horizontalnega preliva: (1) QR/grid razdelek skupnega pogleda /pot/[shareId] — 37 px v VSEH jezikih, kartice-predmeti mreže brez min-w-0 so se razširile na nowrap min-vsebino truncate URL (kartica 411 px > ekran 390 px) → min-w-0 na vseh 4 karticah (oblak QR + vir baza, lokalno QR + vir shramba) po kanonu defensivecss »Minimum Content Size In CSS grid« / css-tricks »Preventing a Grid Blowout« — URL zdaj pošteno elipsizira; QR razdelek živi v DOM pod vsemi zavihki, zato je ena napaka puščala preliv na vseh zavihkih; (2) Badge s CELOTNIM stavkom (lokali 9–48 px, trznica 1–32 px po jezikih) — osnova badge.tsx ima whitespace-nowrap → whitespace-normal text-left prek cn()/tailwind-merge (zanesljiv preklop, zaklenjen s testom osnove); (3) nemška sestavljenka »Durchschnittsbewertung« (172 px, ena nedeljiva beseda) je raznesla 3-stolpčno statistiko /zemljevid (62 px) → break-words na oznaki statistike; (4) dva whitespace-nowrap gumba (Prepoznaj kraje + Uvozi KML/GPX) v flex vrstici /nacrtuj — v FR (15 px) in ES (23 px) skupaj širša od ekrana → flex-wrap na vrstici (oznaki ostaneta enovrstni, VRSTICA se lomi); + odkrito ob živi verifikaciji: vrstica gumbov na kartici lokala (DE 2 px, isti vzorec); 21 novih testov-zaklepov (source-contract vseh 5 točk + defenzivna preverba vzorca truncate↔min-w-0 + zaklep osnov badge.tsx/button.tsx); živa verifikacija: 0 preliva na vseh prizadetih poteh × jezikih na 390 in 360 px (prej do 62 px), regresija osrednjih poti čista, QR izris deluje, elipsizacija dokazana; TabsList drseči zavihki in leaflet ploščice izključeni kot napačni sumi (lastni drsniki / overflow:hidden) — 0 AI žetonov, 0 novih npm odvisnosti, 1.861/1.861 testov. Prej 2.33.0 — IZMERJENE RAZDALJE V VSEH POGLEDIH POTI (2026-10-11): poročevalna pariteta /nacrtuj ↔ /potovanje ↔ /pot/[shareId] (oblak + lokalno) — vrstica izmere/ocene POD glavo dneva in skupna vrstica SAMO nad izmerjenimi zdaj stojita na vseh pogledih poti (zaprta odložena vrzel izdaje 2.32.0; Roadtrippers v deljeni/javni poti prikaže »View mileage, estimated fuel costs, and trip time« — pregled cruiseamerica; Wanderlog »See time and distance between places« povsod, vključno z natisom); dayEstimate + fmtKm1 PRESTAVLJENI iz nacrtuj/view.tsx v plan-map-data.ts (EN izvor resnice: ocena dneva = VSOTA LegRow vrednosti — round5(roadKm) + travelMinutes po skokih OBA postanka s koordinatama, hops === 0 → null iskrena odsotnost; km na 1 decimalko, EN pika / ostali vejica, brez Intl); skupni pogled /pot/[shareId]: MEMOIZIRANI dnevi (useMemo [plan, shareId] — stabilna referenca je pogoj kanona vezave stanja {forDays === days} in preprečuje ponoven zagon efekta PlanMap ob vsakem re-renderju), obe točki PlanMap (zavihek Pot oblak + lokalna pota) poročata prek onMeasured, vrstica pod h2 glavo vsakega dneva v PlanDays, skupna vrstica pod seznamom dni; /potovanje (JourneyPage): vrstica TRENUTNEGA dneva pod glavo dnevne kartice se menja z dnevno navigacijo, skupna vrstica nad izmerjenimi; L10N ×6 (measuredDay/estimatedDay/measuredTotal/measuredMissing/measuredSrPrefix — dobešedna semantika 2.32.0 v L strukturah obeh pogledov); print-VIDNO (del natisa, NE print:hidden) + sr-only predpona za bralce zaslonov; urnik motorja, LegRow, proxy route.ts in logika PlanMap NEPREMJENJENI; 0 novih omrežnih zahtevkov — izmere iz ŽE obstoječega klica proxyja (onMeasured dodan že v 2.32.0 prav zato); živa verifikacija: številke IDENTIČNE med /nacrtuj, /pot (oblak + lokalno) in /potovanje (isti proxy odgovor), mešani primer (route + straight) pokaže oceno + opombo o padlem dnevu z pravilno dvojino — 0 AI žetonov, 0 novih npm odvisnosti, 1.840/1.840 testov. Prej 2.32.0 — IZMERJENE RAZDALJE V POVZETKU NAČRTA (2026-10-11): dnevne skupne razdalje in časi vožnje v povzetku načrta po vzorcu vrhunskih (uradna pomoč Wanderlog: »total time and distance traveled for a given day displayed under that day's heading«; Roadtrippers: uporabniška zahteva »daily miles/time totals«) — proxy /api/plan/directions zdaj iz ISTEGA OSRM odgovora vrača še izmerjena distanceM/durationS (0 novih poizvedb; aditivno — stari odjemalci se ne prelomijo; validacija končno ≥ 0; fail-closed PO DNEVIH ostaja — padel dan je »straight« in NE pokvari vsote); čista summarizeMeasured (plan-map-data) → vrstica POD GLAVO DNEVA: izmerjen dan »21,6 km · 40 min vožnje — izmerjeno (OSRM/OpenStreetMap)«, padel dan → ISTA ocena kot LegRow (~ premočna ×1,3 @ ~60 km/h — iskerno enaka vrsticam med postanki); SKUPNA vrstica povzetka SAMO nad izmerjenimi dnevi (»Skupaj izmerjeno: X km · Y h Z min vožnje«) z izrecno opombo »za N dni ni izmerjenih podatkov — prikazana je ocena« (Roadtrippersova past napačnih vsot pri izklopljenih točkah dokumentirana v raziskavi — zmešani viri so vedno označeni, nikoli tiho zliti v eno številko; če ni nobenega izmerjenega dneva, skupne vrstice NI); PlanMap poroča prek neobveznega onMeasured (privzeto undefined — skupni pogled /potovanje in /pot/[shareId] nedotaknjena); urnik motorja (09:00–19:00), LegRow in travelMinutes NEPREMJENJENI (OSRM je poročevalna plast, ne vir urnika — kanon izdaje 2.30.0); zaokrožitvi km na 1 decimalko in min na 5 (kanon round5); L10N ×6 (sl privzet + en/it/de/fr/es — EN pika namesto vejice); print-vidno (NI print:hidden) + sr-only predpona za bralce zaslonov; živa verifikacija: vrednosti proxyja se ujemajo z direktnimi klici OSRM (4657 m/663 s in 63343 m/4322 s — 0 novih poizvedb dokazano v omrežnem panelu) — 0 AI žetonov, 0 novih npm odvisnosti, 1.808/1.808 testov. Prej 2.31.0 — UVOZ KML/GPX (2026-10-12): uvoz seznamov krajev na /nacrtuj — gumb „Uvozi KML/GPX" ob vhodu Start Anywhere (skriti file input .kml/.gpx/.xml, FileReader, OBDELAVA 100 % V BRSKALNIKU — datoteka ne zapusti naprave, 0 omrežnih zahtevkov); ročni deterministični kurzorski tokenizer XML podnaborja (komentarji, CDATA, entitete vključno s &#NN;/&#xNN;, atributi, samo-zapiranje, vgnezdenje; bun nima DOMParserja, precedens reservation-import) + parseImportFile (avtodetekcija formata po korenskem elementu; KML Placemark→ime+Point/coordinates lon,lat[,alt] po uradni referenci; GPX wpt lat/lon+ime; LineString/Polygon/rte/trk iskreno preštete kot izpuščene poti; meji 2 MiB in 200 točk z iskreno opombo o odrezu) + matchImportPlacemarks (ime NAJPREJ po kanonu DEST_NEEDLES — koreni za slovenske sklone + exact oblike; brez zadetka koordinate → najbližja destinacija ≤ 2 km roadKm z iskrenim dokazom „≈ X km od Y"; dedup po slug s števcem ponovitev; neznane točke prikazane Z IMENI, nikoli tiho izpuščene) — ZRCALO tabele DEST_NEEDLES v plan-import.ts zaklenjeno 1:1 s testi (kanon match.ts vleče node:fs — klientanski uvoz bi padel); rezultat vstopi v ISTI tok kot Start Anywhere („Uporabi kot izhodišče" → deriveSuggestion → deterministični motor — uvoz je izhodišče, ne prisilna pot, kar UI iskerno pove); iskern prikaz: vrstica vira (format + št. točk), neznana imena, izpuščene poti, ponovitve, opomba o zasebnosti — 0 AI žetonov, 0 novih npm odvisnosti, 1.776/1.776 testov. Prej 2.30.0 — VOZLJIVA POT + ZEMLJEVID V SKUPNEM POGLEDU (2026-10-12): OSRM vozljiva pot na zemljevidu načrta — nov strežniški proxy /api/plan/directions po kanonu vremenskega proxyja (fail-closed PO DNEVIH: padec enega dneva ne podre ostalih; predpomnilnik v pomnilniku 24 h po zaokroženih koordinatah iz registra, max 500 vnosov; 8 s timeout; 60/min/IP; vhod IZKLJUČNO koordinate registra — nikoli uporabniške, OSRM bi sicer tiho pripenjal na najbližjo cesto; pretvorba [lon,lat]→[lat,lon]); ob uspehu POLNA črta (weight 4, opacity 0.9, barva dneva) iz dejanske OSRM geometry, nalaganje ne blokira (črtkana takoj, polna zamenja ob prihodu — brez utripanja), mešano stanje pokaže obe iskreni opombi (polna + črtkana premočrtna), nova opomba »Vozljiva pot (OSRM/OpenStreetMap); urnik načrta ostaja ocena« ×6 jezikov; urnik in časi motorja NESPREMENJENI (zemljevid je vizualna plast, ne vir urnika); odpravljeni pasti: dirka happy-eyeballs na IPv6 (ETIMEDOUT ~250 ms → procesne nastavitve dns/net v proxyju), zastareli stroke-dasharray pri setStyle (react-leaflet); zemljevid poti na /potovanje in /pot/[shareId] (pariteta skupnega pogleda — odjemalec deljene povezave vidi isti zemljevid: destSlug iskanje v registru DESTINATIONS, lokacije brez ujemanja iskreno prešteje opomba »N postankov brez znanih koordinat ni prikazan«, print:hidden — natis pokaže dneve, prazno stanje brez zemljevida) — 0 AI žetonov, 0 novih npm odvisnosti, 1.734/1.734 testov. Prej 2.29.0 — VLECI-SPUSTI + ZEMLJEVID NAČRTA (2026-10-12): povleci-in-spusti urejanje postankov na /nacrtuj (dnd-kit — preureditev znotraj dneva in MED dnevi, ročica ob vsakem postanku po vzorcu Wanderlog, tipkovnično urejanje (preslednica dvigne, puščice premikajo, preslednica spusti), preračun časov po istem kanonu motorja (začetek 09:00 + trajanja + ocenjene vožnje; brez znanih koordinat → iskreno »ura ni znana«), iskrena značka »Ročno preurejeno« + gumb »Povrni vrstni red motorja«, prazni dnevi ostanejo s črtkano cono za spust, aria-live naznanila premikov in tipkovnična navodila ×6 jezikov; sprememba se takoj shrani v dai:last-plan → PDF, Go Mode in oblak vidijo isti vrstni red), zemljevid načrta ob povzetku (Leaflet/OSM — dnevno obarvani številčni markerji brez modre/indigo palete, črtkane PREMOCRTNE povezave z izrecno iskreno opombo »ne vozljiva pot«, sinhronizacija seznam ↔ zemljevid: klik markerja zadrsi do vrstice z obrobo, hover/fokus vrstice poudari in poveča marker, OSM atribucija, iskren števec postankov brez znanih koordinat; klientanski dinamični uvoz ssr:false, v natisu izpuščeno — kartice dneva so vir resnice), 0 AI žetonov, 0 novih npm odvisnosti, 1.696/1.696 testov. Prej 2.28.0 — POLIR PO SPLETNI RAZISKAVI (2026-10-11): time-to-value na /nacrtuj (3 one-click primeri prostega opisa ×6 jezikov, vsak NLU-preverjen, klik zgolj zapolni vnos + vitak 3-korakov trak »Opiši → Prilagodi → Zaženi na poti«), primerjalnik proračunov Varčno (€) / Zmerno (€€) / Brez omejitve (€€€) pod načrtom (št. postankov + ocena €/osebo + regije iz istega determinističnega motora, klik regenerira, iskreni opombi o sprostitvi filtra in izpuščenih dražjih postankih; navdih MonkeyTravel »3 budget tiers«), čip »Podprta povezava« ob vsakem affiliate CTA (partnerji na domov, 4 ponudniki v pojmu destinacije na zemljevidu, booking vrstice na straneh destinacij — FTC skladnost, povezava na /zaupanje-in-varnost), one-click vzorčni načrti v praznem stanju Moja potovanja (fikusni vnosi v isti deterministični motor — brez AI, brez ugibanj), SEO JSON-LD (SoftwareApplication + featureList ×6 na domov — cena iskreno 0 EUR; TouristDestination z geo koordinatami na destinacijah; CSP-nonce usklajeno + \u003c escape — brez XSS vektorja), print pariteta /potovanje (kontrole print:hidden, čist iskren natisnjen podpis z virom) — 0 AI žetonov, 1.643/1.643 testov. Prej 2.27.1 — QA U1–U14 (2026-10-11, PR #21): geografska koherenca načrtovalnika (IDF uteži interesov + tipska afiniteta ×2 + veriženje sidrov ≤ 120 km + novo pravilo day_hop z opozorili med dnevi ×6 jezikov), skriptni svetovalec odgovarja iz zbirke Lokali (U3, iskrena atribucija), dnevna napoved Open-Meteo za »jutri«/datume poti (U5), sestavljena vprašanja razbita z izrecnimi neodgovorjenimi deli (U9), NLU pridevniki (kolesarski→kolo … U13), viden 429 v klepetu (U14), potrditev shranjenih datumov z lokaliziranim obsegom (U2), čipi interesov prevedeni ×6 (U4, 133 žetonov), opozorilo ob kopiranju zasebne povezave z 1-klik vklopom javnosti (U6), aktualna 404/zasebnostna besedila (U7), čipi brez podvojitev po normText (U8, 129→124), tap tarče ≥ 24 px WCAG 2.5.8 (U11), Go Mode živi kazatelj povezave + iskrena offline opomba vremena z oznako shranjenega (U12), pariteta izvozov na vseh treh pogledih (U10: Izvozi PDF / Koledar (.ics) / Natisni / QR koda) — 0 AI žetonov, 1.584/1.584 testov. Prej 2.27.0 — P5 PDF IZVOZ: gumb »Izvozi PDF« na /potovanje in /pot/[shareId] (baza + lokalna kopija) — jsPDF + podnaboran Liberation Sans (Regular + Bold, ~22 KB/obličje; polna podpora č/š/ž za vseh 6 jezikov — privzeti PDF fonti so WinAnsi in ne morejo), leni dinamični uvoz (jsPDF + fonta se naložita šele ob kliku), BITNI DETERMINIZEM: isti načrt + isti issuedAt → identičen PDF po bytih (setCreationDate fiksiran + naključni /ID jsPDF prepisán z determinističnim FNV hashem), iskrenost (neznane ure izpuščene, 25:99 zavrnjena, neznan strošek izpuščen, vir + datum izdaje v nogi vsake strani), ime datoteke = ASCII slug imena pote (ž→z) z jezikovnim nadomestilom. Prej 2.26.0 — P3 E-POŠTA + OBLAK IZ UIJA: „Shrani kot skupinsko pot" na /potovanje (lokacija + sinhronizacija v oblak → sodelovanje, vabila po e-pošti, ankete, rezervacije in klepet z @AI so zdaj dosegljivi iz UIja — prej mrtev konec), e-poštna plast nad Resend REST (src/lib/email.ts — 0 odvisnosti, fail-closed brez RESEND_API_KEY, iskrena poročila; 4 stične točke: vabila, opomniki osnutkov, odgovori konzultacij, pozdrav novicam; rate limit 10/min), NLU žetoni s pravimi diakritiki (družina/pohodništvo/smučanje — motor normalizira), vidna iskrena opozorilna ploščica kadar zahtevanih dni ni mogoče zapolniti, popravek horizontalnega overflowa mobilne glave (min-w-0 + <sm skrite iskanje). Prej 2.25.0 — SKRIPTNI START ANYWHERE: povezava ali besedilo → prepoznani kraji iz registra (dokaz z zadetkom), NLU namen in predlog izhodišča → isti deterministični načrtovalnik; SSRF varovalke (javni naslovi, ≤ 256 KiB, ≤ 8 s, ≤ 3 preusmeritve). Prej 2.24.0 — SKRIPTE NAMESTO AI MODELA: skriptni @AI svetovalec (živo vreme Open-Meteo + citati STO nad jedrom trip-chat-engine, fail-quiet) + skriptni NLU prostega opisa (src/lib/advisor/nlu.ts → /api/plan-intent → /api/itinerary). Prej 2.23.0 — CSP NONCE: Content-Security-Policy z nonce + strict-dynamic (middleware → Next skripte + next-themes), inventura zunanjih virov dokazana (edini zunanji vir: OSM ploščice), strani dinamično izrisane (zahteva nonce).**
Izdaje rekonstrukcije: 2.1.0 skupnostne funkcije → 2.2.0 aplikacijska lupina →
2.3.0 issue #1 (živi GPS, booking, pomočnik) → 2.3.1 infra CI → 2.4.0 PWA
offline → 2.5.0 rezervacijski sloj → 2.6.0 partner kanal booking verige →
2.7.0 supply plast (register 19 ponudnikov + matrika aktivacij) + CI vrata
(typecheck/build/prisma) + segmentacija dneva Jutro/Popoldan/Večer →
2.8.0 podatkovni sloj P0-C (STO llms.txt ingest iz ŽIVEGA vira — 752 vnosov
v 7 jezikih; FSQ loader/ingest; KiwiTaxi shema/ingest; OSM Overpass POI po
viewportu; cron reingest; vercel.json) → 2.9.0 P0-E Journey/My Trip
(deterministični uvoz rezervacij: parse → pregled → potrditev z izvorom
IMPORTED; realni datumi poti DST-varno + dnevno vreme po dnevih (Open-Meteo
16 dni, iskren horizont); natisljivo potrdilo poti z rezervacijami in
atestacijami; izplačila lastne tržnice not_due → due → processing → paid z
AuditLog + zahtevki kupca po preklicu) → 2.10.0 P0-F affiliate RECONCILE
(register povezan s supply registrom po dostopu »affiliate-deeplink«: 7 novih
partnerjev — Viator/Tiqets/Skyscanner/Airalo/DiscoverCars/WorldNomads/
SafetyWing; državne predloge {country} SI/HR/ME/AL; iskrena veriga: brez
javno dokumentiranega vzorca žetona ID sam NE zgradi provizijske povezave,
lastnikov TMPL nadomestilo jo lahko; provizija null = neznana do pogodbe,
nikoli izmišljena; žive vodene povezave na /go hubu in podstraneh;
vstopnice v partnerskem iskanju postanka; matrika 7 partnerjev → LIVE) →
2.11.0 P0-G Go Mode/PWA/sodelovanje (geo: URI sistemski izbirnik zemljevidov
zraven OSM; geofence prihoda ~250 m s stanjem PRISPEL in poudarjenim gumbom
Opravljeno — namig, ne dokaz; /na-poti v APP_SHELL lupini (brez signala že ob
prvem obisku) + bližnica PWA; PRAVI QR izris deljene pote (qrcode, prej
placeholder); ICS izvoz v koledar (RFC 5545, celodnevni DST-varni dogodki,
DTEND ekskluziven, beg besedila, prelom 75 oktetov — živ samo ob realnih
datumih); 41 novih testov (+16 varnostnih source-contract IDOR/BOLA/vloge/
vabila/CAS)) → 2.12.0 P0-H B2B tržnica (statusni stroj moderacije
listing-moderation.ts: draft → pending → published (+rejected), partner
NIKOLI ne objavi sam, sprememba vsebine sproži ponovno moderacijo;
portal partnerja /partner z lastnimi vnosi, statistiko prodaje/preklicev
in urejevalnikom z geo pinom (bbox validacija SI·HR·ME·AL); skrbniški
portal /admin — prijave partnerjev (Lead approve → vloga partner,
iskrena 409 brez računa), moderacijska vrsta (objava/zavrnitev z obveznim
razlogom, viden partnerju), konzultacije z ročnimi dopolnitvami
(answerSource manual — iskreno razkrit); javni obrazec /konzultacija
»Vprašaj lokalca« (deterministični odgovor iz registra destinacij +
vodene povezave partnerjev, 0 AI §29; zasebna stran /konzultacija/{token},
3/dan na e-pošto, e-pošte ne pošiljamo; 55 novih testov: 16 varnostnih
source-contract + listing-moderation + consultation-fallback)) →
2.13.0 P0-I cron/ops/dim (recalculate-status: dnevna materializacija
izplačil not_due → due z AuditLog v eni transakciji, idempotentno;
draft-reminders: dnevni opomnik za osnutke ≥ 7 dni BREZ lažne e-pošte —
AuditLog dedup 7 dni + amber opomba v /partner; skupni requireCronSecret
fail-closed 401 za vse 4 cron poti; SYSTEM_DATA_GUARD §23: sanitizacija
nadzornih/zero-width/bidi znakov + dolžinske meje na vseh mejah zunanjih
in uporabniških podatkov (OSM/FSQ/KiwiTaxi feedi, sporočila klepeta,
konzultacije, imena postankov) + zaznavanje poskusov navodil za AI
(SL/EN) z odkritim varnostnim odgovorom @AI svetovalca in opombo
konzultacije; produkciji dim `bun run smoke` (samo-bralni GET preveri:
strani, health verzija ≡ package.json, /api/destinations register, /go
302/400 gedelji, 4× cron 401 brez žetona); health 9/9 z ops:cron;
runbook docs/OPERATIONS.md; vercel.json 4 urniki) →
2.14.0 P0-J CI vrata (6. vrata smoke: MIGRATION SAFETY — db:materialize
sveža SQLite iz praznega stanja brez --accept-data-loss, destruktivna
sprememba pošteno pade; produkcijski dim V CI: zagon standalone
strežnika + 19 samo-bralnih preverb vključno z varnostnim negativnim
dimom cron 401 brez žetona; ARTEFAKTI/REPORTI: junit.xml v zavihku Testi +
smoke-report.json + smoke.txt + server.log when: always — tudi padec je
dokaz; iskreno popravljen pokvarjen sprožilec GitHub CI („branches: ain]"
osi miroval od 2.7.0, sinhronizacija je delala); readiness skript brez
curl odvisnosti).
→ 2.15.0 P1-A osebni potovalni profil (issue #3 §1/§2/§11 MindTrip
parity): NOVI Prisma modeli UserPreference (fiksni nabor 9 ključev,
izvor USER_STATED, kanonske vrednosti iz slovenia-data — brez vzporednih
modelov) in MemoryItem (5 vrst, 4 izvori, confidence iz pravil, mehko
brisanje + 90-dnevna zadrževalna doba z lenkim čiščenjem); NOVE rute
/api/preferences (GET/PUT/DELETE — strežniška validacija proti fiksni
množici) + /api/memory (GET bounded 100 + POST blokiran pri izklopu +
DELETE ?confirm=forget-all) + /api/memory/[id] (PATCH/DELETE z IDOR-varno
sestavljeno poizvedbo {id, userId} — 404 za tuje); fail-closed
personalizacijska zapora (izklop = spomin se sploh ne bere, novi zapisi
se ne zbirajo; agentska pot getPersonalContext vrača PRAZEN kontekst);
SYSTEM_DATA_GUARD na vseh vhodih (sanitizacija + odkrita zavrnitev
injekcijskih vzorcev); revizijska sled AuditLog (7 dejanj preference.*/
memory.*); NOVA stran /moj-profil (preference z izvorom, „Kaj si zapomnim
o tebi" z urejanjem/brisanjem/pozabi vseh, preklop personalizacije,
zasebnostna izjava) + navigacijski vnos Račun → Moj profil; 63 novih
testov (41 čistih + 22 source-contract IDOR/zapora/guard/revizija) =
1042 testov; 0-AI kanon ohranjen (0 žetonov, 0 LLM).
Izvorni repozitorij (626 commitov, v1.190.0) je bil dvakrat izgubljen v posledici
vdorov v GitHub račun (2026-10-06). Ta aplikacija je temeljita rekonstrukcija iz
obnovitvenih virov (delovni dnevnik + izpisi izvorne kode + produkcijski posnetek +
živi API) — glej `docs/recovery/RECOVERY-REPORT.md` za celotno zgodbo.

**Faza 2 (2.1.0):** skupnostne funkcije potovanja 1:1 iz izvorne kode (prijava,
sodelovanje z vlogami/vabili/CAS, rezervacije, ankete, skupinski klepet z
determinističnim @AI svetovalcem — 0 žetonov), **6 jezikov** (sl + en/it/de/fr/es),
lastna tržnica z B2C checkoutom (demo fail-closed; prava plačila ob Stripe ključih)
ter testna vrata (86 testov) + GitLab CI.

## Kaj je rekonstruirano ✅

- **30+ strani** — domov (1:1 struktura s produkcijo), destinacije (38 realnih zapisov
  SI/HR/ME/AL), destinacija/[slug] (+ vodniki, things-to-do), zemljevid, lokali,
  načrtuj, potovanje, na-poti (Go Mode), moja-potovanja (hub), tržnica, /go hub
  (10 partnerjev), vodiki/[slug], dogodki, doživetja, primerjava, slovenia-pass,
  kontakt, prijava, owner, za-ponudnike, vir-podatkov, pravne strani, pot/[shareId]
- **Deterministični načrtovalec** — `/api/itinerary` (interests/days/regija/sezona/
  budget → urnik 09:00–19:00, cene, geo-validacija sosednjih postankov)
- **Leaflet zemljevid** — 38 markerjev, filtri, dodajanje v Mojo pot
- **Go Mode „Na poti"** — NOW/NEXT kartice, napredek, persistenca (dai:go-trip)
- **i18n** — 6 jezikov: SL (privzet, brez predpone) + EN/IT/DE/FR/ES (`/{jez}/*`)
  z delnimi slovarji in slovensko rezervo
- **PWA** — manifest, ikone, 84 realnih fotografij destinacij (`public/content/`)
- **API** — `/api/health`, `/api/destinations`, `/api/itinerary`, `/api/contact`,
  `/api/newsletter/subscribe`, `/rss.xml`
- **PWA offline (2.4.0)** — `public/sw.js` s strategijami po vrstah zahtev:
  nespremenljiva vsebina (`/content/*`, ikone, manifest) cache-first,
  `/_next/*` gradniki network-first z zasilnim predpomnilnikom (varno za
  razvoj in produkcijo), OSM ploščice cache-first z omejitvijo 240 (opaque
  dovoljen samo za ploščice), strani network-first z zasilnim predpomnilnikom +
  `offline.html` konec, javni API (`/api/destinations`, `/api/weather`)
  network-first z zasilnim, zasebni API (auth/trips/invites/journey/checkout/
  stripe/contact/newsletter) izključno mreža — uporabniški podatki se nikoli ne
  predpomnijo; registracija v produkciji samodejno ali prek `?sw=1`; preverba
  `pwa:offline` v `/api/health`
- **Rezervacijski sloj s provizijo (2.5.0 → razširitev P0-F 2.10.0)** — 12
  provizijskih partnerjev (Booking.com, GetYourGuide, Kiwi.com, Rentalcars.com,
  Omio + P0-F: Viator, Tiqets, Skyscanner, Airalo, DiscoverCars, WorldNomads,
  SafetyWing): povezave prek
  `/api/affiliate/go` (302 + best-effort zapis klika, `rel="sponsored"`) v
  booking hubu na domači strani, kartici na strani destinacije, popupu
  zemljevida in na /go straneh partnerjev (vodene povezave z razkritvem);
  državne predloge `{country}` (SI/HR/ME/AL — npr. DiscoverCars `/croatia/Zagreb`,
  Airalo `/slovenia-eSIM`); iskrena veriga: partnerji brez javno dokumentiranega
  vzorca žetona (`affiliateTmpl ""`) ob ID-ju ostanejo na javni povezavi —
  lastnikov `AFFILIATE_*_TMPL` s pravim vzorcem iz programa aktivira provizijo;
  provizija `null` = neznana do pogodbe (nikoli izmišljena ocena — vnos iz
  poročila takrat zahteva ročno provizijo); bencinske črpalke (66, kurirani
  odprti podatki po osnovi OSM
  (ODbL), plast na zemljevidu — gorivo izrecno brez provizije); provizijski
  dnevnik in klikanja za skrbnike (`/owner/provizije`, dostop
  `DSA_ADMIN_EMAILS`); izplačilni koledar T+3 meseci, 28. v mesecu
  (vzorec MindTrip)
- **Podatkovni sloj (2.8.0 — issue #1 P0-C)** — **STO uradna vsebina ŽIVA**:
  ingest iz živega vira slovenia.info (llms.txt — 752 vnosov v 7 jezikih,
  `data/sto-content.json`) z determinističnim parserjem (fail-closed: nedovoljeni
  URL ne vstopi), iskanjem po uradni vsebini z ujemanjem slovenskih sklonov
  („blede" najde „Bled"; `/api/sto/search`) in tedenskim cronom
  (`/api/cron/sto-reingest`, `vercel.json`); **OSM Overpass POI sloj** po
  viewportu (`/api/pois` — 3 zrcala, rate limit 5 s, max 0,25°², atribucija
  ODbL v vsakem odzivu; nedosegljivost je iskrena napaka, nikoli izmišljeni
  POI); **FSQ** (Foursquare Open Places, Apache-2.0): loader + stroga
  validacija (geo bbox države, 12 kategorij, dedupe) + `bun run fsq:ingest` —
  množica 125.446 POI čaka vir (mrtvi GitHub; matrika gate „data"); **KiwiTaxi**:
  shema FROM_PRICE + validacija relacij + `bun run kiwitaxi:ingest --csv` —
  feed čaka partner CSV; licenčni pregled vseh virov v
  `docs/DATA-PROVENANCE.md`.
- **Supply plast (2.7.0 — issue #1 P0-B RECOVER+RECONCILE)** — register
  zmožnosti 19 ponudnikov (16 izvirnikovih + Kiwi.com/Rentalcars po MindTrip
  vzorcu + osm-fuel odprti podatki), strojno berljiva matrika življenjskega
  cikla (`src/lib/supply/production-matrix.ts`) in mehanska izpeljeka štirih
  stanj (🟢 dejansko živo / 🔵 konfigurirano / ⚪ ni konfigurirano / 🔴 zunanja
  ovira) z `bun run activation:check` — env preverba SAMO po Boolean
  prisotnosti (kanarček: vrednosti se nikoli ne izpišejo); kanonska stanja cen
  (LIVE_PRICE / FROM_PRICE / UNKNOWN / NOT_SUPPORTED) usklajena čez vse tri
  registre (supply ← /go hub ← affiliate).
- **CI vrata (2.7.0 — issue #1 P0-J)** — typecheck (bun-types, 0 napak tudi v
  testih), prisma validate in build dodana k lint+test vratom na obeh
  platformah (GitLab CI + GitHub Actions); popravljena pokvarjena veja
  `branches:` v ci.yml.
- **Segmentacija dneva + determinizem kot identiteta (2.7.0 — issue #1 P0-D)** —
  časovnica dneva na /nacrtuj in /potovanje nosi glave segmentov
  Jutro/Popoldan/Večer (začetna ura postanka odloča; brez ure → podeduje
  tekoči segment) s poštenimi etapami ~km/~min tudi čez meje segmentov;
  `/api/itinerary` izdaja `engine: "deterministic"` + prstni odtis načrta
  (isti vhod → isti odtis — testno dokazano); stikalo „Z AI / Brez AI" iz
  izvirnika NAMENOMA ni obnovljeno (v 2.x ne obstaja AI pot — izbira bi bila
  lažna).
- **Partner kanal v booking verigi (2.6.0 — issue #1 dokončanje po plasti
  2.5.0)** — modal „Išči ponudbo“ na poti ima ZDAJ dva izrecno ločena kanala:
  **PRI PARTNERJU** (realno; kartice 5 partnerjev z vodeno povezavo
  `/api/affiliate/go`, provizijskim razkritjem in letališčem regije za leti;
  obrazec „Sem rezerviral — dodaj na pot“ → rezervacija v Moja potovanja s
  statusom **PENDING** — potrditev izstavi partner na svoji strani, uporabnik
  jo atestira s številko in ceno iz potrdila (PENDING → CONFIRMED, kanonska
  atestacija); „Upravljaj pri partnerju“ za spremembo/preklic — DEJANSKA
  sprememba teče pri partnerju, tu iskreno stanje) in **DEMO SIMULATOR**
  (izrecno oranžen, nespremenjen). Kanal zapisa razrešuje STREŽNIK iz zapisa
  `note` (nikoli iz telesa zahteve); POST telo ne sme nositi številke/cene —
  ti sta atestacija ob PATCH `confirm`. Hub `/moja-potovanja` prikazuje števce
  po kanalih (partner smaragdno, demo oranžno) in števec „čaka potrditev“.
  Direktni ponudniški API ostaja fail-closed (503) — realne rezervacije
  potečejo pri partnerjih, nikoli ne lažemo

## Tehnični sklad

Next.js 16 (App Router) · TypeScript 5 (strict) · Tailwind CSS 4 + shadcn/ui ·
Prisma ORM (SQLite za razvoj/peskovnik/CI; **PostgreSQL za produkcijo** —
`prisma/postgres/schema.prisma` + versioned migracije, glej `docs/PRODUCTION-CUTOVER.md`;
izvirna Neon Postgres shema z 39 modeli je klasificirana v
`docs/RECOVERY-MODEL-MATRIX.md`) · next-intl · Leaflet/OSM · lucide-react

## Razvoj

```bash
bun install
cp .env.example .env      # DATABASE_URL (SQLite)
bun run db:push           # ustvari tabele
bun run dev               # http://localhost:3000
bun run lint
```

**Produkcija (PostgreSQL)** — priprava in prevezava:

```bash
bun run db:pg:sync        # regeneriraj postgres shemo iz glavne (po vsaki spremembi)
bun run db:pg:check       # vrata: shema ≡ glavna + baseline ≡ from-empty dif
bun run db:pg:deploy      # prisma migrate deploy (SAMO ta mehanizem v produkciji)
bun run build:postgres    # produkcjski build (prisma generate iz postgres sheme)
bun run db:integrity      # štetja tabel (before/after cutover primerjava)
bun run migrate:legacy    # prenos podatkov 1.163.4 → 2.x (dry-run privzeto)
```

Celoten postopek: **`docs/PRODUCTION-CUTOVER.md`** (backup → preflight →
dry-run → integrity vrata → migracija → deployment → health → E2E →
rollback). Klasifikacija vseh 39 modelov izvirnika:
`docs/RECOVERY-MODEL-MATRIX.md`.

PWA offline: service worker se v razvoju registrira na `http://localhost:3000/?sw=1`
(preizkusna pot), v produkciji samodejno.

Rezervacijski sloj (neobvezni env): `AFFILIATE_BOOKING_ID` / `AFFILIATE_GYG_ID` /
`AFFILIATE_KIWI_ID` / `AFFILIATE_RENTALCARS_ID` / `AFFILIATE_OMIO_ID` in P0-F
`AFFILIATE_VIATOR_ID` / `AFFILIATE_TIQETS_ID` / `AFFILIATE_SKYSCANNER_ID` /
`AFFILIATE_AIRALO_ID` / `AFFILIATE_DISCOVERCARS_ID` / `AFFILIATE_WORLDNOMADS_ID` /
`AFFILIATE_SAFETYWING_ID` (ID partnerja
v partnerskem programu) aktivirajo provizijske povezave, `AFFILIATE_*_TMPL`
(neobvezna predloga) jih po potrebi prilagodi — brez žetona povezave delujejo
javno, klikanja se štejejo. Pri P0-F partnerjih brez javno dokumentiranega
vzorca žetona (Viator/Tiqets/Skyscanner/Airalo/DiscoverCars/WorldNomads/
SafetyWing) ID sam ne zgradi provizijske povezave — aktivira jo šele
`AFFILIATE_*_TMPL` s pravim vzorcem iz odobrenega partnerskega programa.
Skrbniški dostop do `/owner/provizije` omogoča
`DSA_ADMIN_EMAILS` (vejica ločen seznam e-poštnih naslovov).

## Struktura

```
src/app/[locale]/     # vse strani (sl privzet brez predpone, /en/*)
src/app/api/          # health, destinations, itinerary, contact, newsletter,
                      # affiliate (rezervacije/provizije), map/fuel (črpalke)
src/components/       # layout (navigacija, MobileTabBar, footer), map, plan, ui (shadcn)
src/components/pwa/   # registracija service workerja + offline obvestila
src/lib/              # slovenia-data (38 destinacij), itinerary-engine (deterministični),
                      # my-trip, plan-store, lokali/trznica/go/content-data, i18n,
                      # affiliate-providers + affiliate-server (provizije), fuel-stations
prisma/               # SQLite razvojna shema (en vir resnice)
prisma/postgres/      # PRODUKCIJA: postgres shema (izpeljana) + migracije 0_init
scripts/              # pg-schema-sync, db-integrity-report, migrate-legacy-data,
                      # activation-check, smoke, ingesti (sto/fsq/kiwitaxi)
public/sw.js + offline.html  # PWA offline — service worker + zasilna stran
public/content/       # 84 realnih fotografij destinacij
docs/recovery/        # OBNOVITVENI ARHIV: RECOVERY-REPORT, snapshots produkcije,
                      # source-sessions (worklog + 57 izpisov izvorne kode),
                      # production-mirror (statični posnetek strani), shema 1.163.4
docs/RECOVERY-MODEL-MATRIX.md   # 39 modelov: RECONCILE/RETIRE z razlogi + prenos
docs/PRODUCTION-CUTOVER.md      # runbook: 10 korakov cutoverja z ukazi
docs/evidence/        # dokazni posnetki rekonstrukcije
```

## Kaj ŠE MANJKA (iscron kanon — nič izmišljenega)

- dopolnjevanje delnih prevodnih slovarjev (poti in preklopnik pokrivajo vseh 6
  jezikov; del komponent ima še samo sl/en), skupnostni dnevnik potovanj (klepet,
  ankete in vabila so že rekonstruirani), Stripe checkout (demo fail-closed; pravi
  čaka na ključe lastnika), testi (rekonstrukcija: 590+; izvirnik: 5332)
- pravi affiliate žetoni (`AFFILIATE_*_ID`) — registracija v partnerskih
  programih je lastnikovo dejanje; brez žetona povezave delujejo javno
  (brez provizije), klikanja se štejejo

## Varnostna opomba

Žetoni, objavljeni v klepetih med incidentom 2026-10-06, naj bodo vsi preklicani
(GitHub ✅ že, GitLab `glpat-…` po koncu dela, Vercel `vcp_…`, Neon geslo — glej
`docs/recovery/RECOVERY-REPORT.md` §4).
→ 2.16.0 P1-B agent nad kanoničnim kontekstom (issue #3 §3/§5/§6/§7):
NOV plan-edit-engine (deterministični SL razčlenjevalnik ukazov dodaj/
odstrani/premakni/zamenjaj/skrajšaj/podaljšaj/optimiziraj s toleranco
slovenskih sklonov + nespremenljive mutacije nad KANONSKIM SharedPlan +
strukturiran diff; brezstanjska ruta /api/plan-edit — nič se ne shrani,
shranjevanje ostane na obstoječih poteh; undo sklad na klientu);
NOVA plošča v načrtovalniku „Uredi načrt z ukazi" (diff predogled +
Shrani/Razveljavi) + „Iz mojih preferenc" (prijavljeni: čipi preferenc →
en klik sestavi načrt prek obstoječega /api/itinerary); NOV
recommendation-reasons (strukturirani dokazov podprti razlogi — razdalja/
cena/proračun/sezona/interesi(s sinonimi kanonskega motorja)/ocena/
primernost; delovni čas destinacij v registru NE obstaja → iskreno
izpuščen) integriran v @AI predloge („zakaj:" vrstica) + namen „zakaj";
NOV booking-summary (samo-bralna inteligenca rezervacij §7 — povzetek
stanj/kanalov iz atestacijskih zapisov, agent NIKOLI ne mutira; @AI nov
namen „rezervacije"); messages ruta podaja kanonske rezervacije poti;
ZASEBNOST: skupinski klepet NAMENOMA brez osebnega spomina (sodelavci
ne vidijo zasebnih podatkov); 34 novih testov = 1076/1076, tsc 0, lint 0
→ 2.17.0 P1-C watch/monitoring + notifikacije (issue #3 §4/§10):
NOVA modela WatchItem (userId, kind, targetKind, targetId, condition,
state active/paused, lastObservation/lastCheckedAt/lastTriggeredAt;
@@unique([userId,kind,targetKind,targetId])) + Notification (source,
severity, data, readAt, dedupeKey; @@unique([userId,dedupeKey]) →
idempotenten cron); NOV watch-engine (0-AI čista plast: 4 vrste —
price×product, weather×journey, trip_day×journey, booking×journey;
ZAVRŽENE vrste availability/flight → iskrena zavrnitev, vir ne
potrjuje; cena pade SAMO iz dveh preverljivih cen — prvi zagon zapiše
izhodišče (baseline) BREZ opozorila; vreme z izhodom postanka +
horizontom 16 dni — pred tem PENDING, nikoli lažni mir; dedupeKey na
dogodku → eno obvestilo na dan/mejnik/prehod); NOV watch-server
(runWatchCheck: bounded ≤ 12 lokacij/zagon deterministično, Open-Meteo
fail-closed, zasebnost §11 — pote brez dostopa se NE vrednotijo;
revizijska sled watch.*/notification.*); API /api/watch (GET/POST —
ime cilja določi strežnik, meja 50/uporabnik, 409 podvojeni) +
/api/watch/[id] (PATCH pavza/nadaljuj/pragi, DELETE — IDOR {id,userId}
→ 404) + /api/notifications (GET bounded 100 + ?summary=1 za zvonček,
PATCH eno/vse prebrano, DELETE prebrana/vse) + /api/cron/watch-check
(Bearer CRON_SECRET fail-closed, urnik */2h v vercel.json); UI: zvonček
z neprebranimi v glavi (poll 60 s, samo prijavljeni) + /notifikacije
(center: inbox + spremljanja + iskrenost) + gumb »Spremljaj ceno« na
tržnici + meni »Spremljaj« na pote (vreme/dnevi/rezervacije, ≥VIEWER);
PWA push ISKRENO NI implementiran (in-app plast) →
2.18.0 P1-D personalizirana domov + parity scorecard (issue #3 §9/§14):
/api/trips razširitev dateStart/dateEnd + firstStop strežniško;
personal-home-section 7 ploščic SAMO prijavljenim (Nadaljuj pot,
Obvestila, Spremljanja, Vreme naslednje pote — iskrena stanja, Ideje
zate iz preferenc z razlogi, V bližini — 100 % klientni GPS, Odprte
naloge); docs/PARITY-SCORECARD.md 20 zmožnosti z dokazi (18 PARITY +
5 SUPERIOR + iskrene vrzeli) →
2.19.0 P2 Postgres data plane (issue #2): prisma/postgres/schema.prisma
(IZPELJANA iz glavne z db:pg:sync — provider edina razlika, vrata
db:pg:check v CI) + versioned baseline migracija 0_init (CI dokazuje
migracije ≡ shema z migrate diff from-empty) + build:postgres
(prisma generate iz postgres sheme + next build za produkcijo) +
scripts/db-integrity-report.ts (štetja po tabelah, --compare +
--expect-zero vrata na kritičnih tabelah) + scripts/migrate-legacy-data.ts
(idempotenten prenos 1.163.4 → 2.x po matriki — E2E testiran: dry-run →
apply → apply = 0 novih) + bcrypt zapisi 1.163.4 se preverijo (prijava
prenesenih uporabnikov) + /api/health db:cutover (provider/latenca/
migracijsko stanje) + build:meta (SHA iz platforme) + matrika 39 modelov
(docs/RECOVERY-MODEL-MATRIX.md: RECONCILE 14 z mehanskim prenosom,
RETIRE 25 z razlogi, RESTORE 0) + docs/PRODUCTION-CUTOVER.md runbook
(10 korakov z ukazi: backup → preflight → dry-run → integrity → okno →
migracija → deployment → health → E2E → rollback) →
2.22.0 posočje regija (issue #2 §9 ostanek 4): preverjeni popravek kobarid+reka-soca
  iz „gorenjska“ v novo regijo „posocje“ (preverba proti produkciji 1.190.0:
  API+stran+sitemap 2026-10-10; STO „Soča Valley“; eksonimi Isonzo), 21 regij,
  letališče TRS, značke/slovarji usklajeni
2.23.0 CSP nonce (issue #2 §9 priporočilo): Content-Security-Policy z
  'nonce-<random>' + 'strict-dynamic' (script-src), object-src 'none',
  frame-ancestors 'none', form-action/base-uri 'self'; edini zunanji
  brskalniški vir = OSM ploščice (img-src); connect-src 'self' (0 absolutnih
  klientnih fetch, rg dokaz); [locale] force-dynamic (nonce zahteva svež
  izris); next-themes nonce prop; korenska 404 = mila degradacija (dokumentirano)
2.21.0 4-c jedrska i18n aktivacija (issue #2 §9): PlannerLang 6 jezikov
  (itinerary-engine PLANNER_MSG, weather, statusLabel, trip-dates, go-gps
  kardinali), FR register harmonizacija (vous → tu, 26 mest), 16 datumskih
  vrat prek INTL_DATE_LOCALE, asPickLocale vrata; test i18n-core-activation
  (18); sync.yml fail-fast varovalka GitLab žetona (kvota Actions)
2.20.0 P3 i18n štirijezična razširitev (issue #2 §9): prevod ~7.400 nizov
v 71 datotekah (it/de/fr/es v L-slovarjih po kanonu 48-b; iskrenostni
kanon — sl ostaja resnica/fallback) + aktivacija ~73 klicnih mest
(ternariji → pick(), INTL_DATE_LOCALE mapa, regionLabel/typeLabel) +
hreflang alternatesFor() na vseh 36 straneh (26 klientnih razdeljenih na
page.tsx strežniški ovoj + view.tsx — Next 16 prepoveduje generateMetadata
v "use client"; 6 source-contract testov usklajenih) + zadnji ostanki
prevodov (weather WMO_LABELS, recommendation reasons, legal-page) +
pogodbenski test tests/i18n-quadrilingual.test.ts (pariteta slovarjev
z prazno izjemo, pokritost hreflang 36/36, enota alternatesFor) →
1257/1257 testov (10293 expect).
