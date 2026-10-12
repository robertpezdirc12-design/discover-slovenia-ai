---
Task ID: POLIR15-a/b/c/d (faza 1–2: raziskava + specifikacija)
Agent: Z.ai Code (glavni orkestrator)
Task: Nadaljevanje POLIR15 cikla za issue #34 (discover-slovenia-ai): sticky preklop z-index vs. Leaflet, sezonska afiniteta heroja (vrzel #3), PersonalHomeSection CLS (getServerSession waterfall), CLS skeleta zemljevida 0,023 → 0.

Work Log:
- Preverjen dostop do repozitorija robertpezdirc12-design/discover-slovenia-ai: repo privaten, `gh` ni nameščen, anonimni clone zavrnjen → direkten dostop do kode ni mogoč iz tega peskovnika.
- Izvedena spletna raziskava za vrzel #3: Switzerland Tourism sezonski kampanjni koledar (Partner Winter/Summer/Autumn, stnet.ch 2024) in Tourism Ireland "Home of Halloween" (2024/25, keltska izvornost kot oktobrski hook).
- Sestavljena raziskava + specifikacija + implementacijski sketchi za vse 4 kandidata (izolacija stacking konteksta za Leaflet, SSR sezonski resolver z mikro-dogodki, cache() + Promise.all + Suspense skeleton za sejo, enotni vir višine za map skeleton).

Stage Summary:
- Dostavljena faza 1–2 (raziskava → specifikacija) za POLIR15-a/b/c/d v klepetu; produkcija (diff-e/PR) čaka na prizadete datoteke ali GitHub dostop.
- Ključna odločitev: pri (a) ne spreminjamo Leafletovih internih z-index vrednosti, ampak izoliramo stacking kontekst wrapperja (relative z-0 isolate); pri (b) sezon rešujemo SSR z MMDD okni + SI mikro-dogodki (martinovanje, kurentovanje), ne kloniramo irskega Halloweena; pri (c) session dedup prek React cache() + paralelizacija + rezervirana višina skeleta; pri (d) enoten CSS vir višine mape (var/h class) za skeleton in dejansko mapo.

---
Task ID: POLIR15-a/b/c/d (faza 3–4: implementacija + verifikacija)
Agent: Z.ai Code (glavni orkestrator)
Task: Delujoča referenčna implementacija vseh štirih točk iz issue #34, E2E preverjena v brskalniku, + prenosni paket za uporabnikov repo.

Work Log:
- Nameščen leaflet + @types/leaflet.
- POLIR15-b: src/lib/seasonal-hero.ts (MMDD okna z ovitkom, mikro-dogodki martinovanje/kurentovanje/december, getHeroVariant SSR vhod); hero-section.tsx z fiksnim aspect-ratio (CLS 0); 4 sezonske slike generirane v public/images/ (1440x720 zavrnjeno s strani API — 720 ni deljiv s 32; uporabljeno 1344x768).
- POLIR15-a + d: src/components/home/map-section.tsx — sticky preklop (top-14 z-30) nad wrapperjem mape z `relative z-0 isolate`; enoten vir višine MAP_H (h-[420px]/md:h-[520px]); mapa, seznam in skeleton absolutni inset-0; skeleton sproščen ob tileLayer 'load' + 3 s varovalka.
- POLIR15-c: personal-home-section.tsx (async server, 900 ms delay, strukturno identičen skeleton), api/demo-session route (cookie demo), session-toggle.tsx + router.refresh().
- page.tsx sestava (min-h-screen flex flex-col + footer mt-auto), layout lang="sl" + metadata, globals.css nice-scroll.
- Lint čist; dev.log brez napak (prejšnji 404 hero-autumn.png razrešen z generacijo slike).
- Agent Browser E2E: hero jesen ✓, ?season=winter override ✓, zemljevid z markerji ✓, preklop zemljevid/seznam brez premika ✓, sticky vrstica nad mapo ✓, prijava → streaming sekcija "Dobrodošli nazaj, Ana!" brez premika zemljevida ✓, mobilni 390px ✓, noga ✓, brez konzolnih napak ✓.
- Zgrajen public/polir15.zip (16 datotek: 8 izvornih + README z integracijskimi koraki); prenos preverjen (HTTP 200).

Stage Summary:
- Vse štiri točke POLIR15 so implementirane in brskalniško preverjene; stran na / je referenčna demonstracija.
- Produkcija na uporabnikovem repozitoriju: uporabnik prenese public/polir15.zip (Preview → Odpri v novem zavihku → /polir15.zip) in sledi README; direktni push na GitHub iz tega peskovnika ni mogoč (brez poverilnic).
- Subagenti niso bili uporabljeni: vseh 8 datotek je tesno povezanih v eni strani (skupni uvozi, koordinirane višine), razdelitev bi povečala tveganje neuskljenosti.

---
Task ID: POLIR15-GH (priprava na produkcijo)
Agent: Z.ai Code (glavni orkestrator)
Task: Ponoven poskus dostopa do github.com/robertpezdirc12-design/discover-slovenia-ai in priprava GitHub paketa.

Work Log:
- Preverjena vidnost repozitorija: HTML stran vrne HTTP 404 (javna bi vrnila 200), anonimni git clone zahteva uporabniško ime → repozitorij je PRIVATEN; dostop brez poverilnic ni mogoč.
- Sestavljen GITHUB-TEXT.md: komentar statusa za issue #34, commit serija (3 commiti, Refs #34), naslov + telo PR-ja (Closes #34).
- Obnovljen public/polir15.zip (17 datotek: 8 izvornih + README + GITHUB-TEXT.md); prenos preverjen (HTTP 200).

Stage Summary:
- Dokazano: za "delo tukaj" (clone/analyze/push/PR) potreben bodisi fine-grained PAT (Contents+Pull requests: RW, samo ta repo) bodisi začasno javni repozitorij (samo branje → patch, ne push).
- Vse vsebine (koda + GitHub teksti) so pripravljene vnaprej; po prejemu dostopa je postopek en korak.
