"use client";

import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Compass,
  Map as MapIcon,
  SearchCheck,
} from "lucide-react";
import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /primerjava — iskrena primerjava AI načrtovalcev za Slovenijo
 * (1:1 vsebina produkcije: Mindtrip/Layla/Google preverbe, močne strani
 * generalistov, pasti, tabela, praksa, FAQ). Ni marketinška brošura —
 * priznamo, kje so generalisti boljši (kanon iskrenosti).
 */
export default function PrimerjavaPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Iskrena primerjava · brez prijave", en: "An honest comparison · no sign-up" },
    title: {
      sl: "Kateri AI načrtovalec potovanj je pravi za Slovenijo?",
      en: "Which AI travel planner is right for Slovenia?",
    },
    lead: {
      sl: "Ta primerjava ni marketinška brošura. Naše uredniško načelo je iskrenost — zato priznamo, kje so splošni načrtovalci boljši od nas, in pokažemo, kje specialist za Slovenijo vrne več. Odločitev prepustimo tebi.",
      en: "This comparison is not a marketing brochure. Our editorial principle is honesty — so we admit where general planners beat us, and show where a Slovenia specialist returns more. The decision is yours.",
    },
    updated: {
      sl: "Posodobljeno: 28. september 2026. Primerjave staréjo — preveri datum pred odločitvijo.",
      en: "Updated: 28 September 2026. Comparisons age — check the date before deciding.",
    },
    terenKicker: { sl: "Teren · preverjeno 28. 9. 2026", en: "Field · verified 28 Sep 2026" },
    terenTitle: {
      sl: "Teren se je premaknil — kaj smo živo preverili 28. septembra 2026",
      en: "The field has moved — what we verified live on 28 September 2026",
    },
    terenLead: {
      sl: "Iskrena primerjava zahteva datirane preverbe, ne večne trditve. To so točkovne ugotovitve naših preverb (javni dostop do strani, uradni viri) — ko se teren spremeni, posodobimo to sekcijo.",
      en: "An honest comparison requires dated checks, not eternal claims. These are the point findings of our verifications (public page access, official sources) — when the field changes, we update this section.",
    },
    teren: {
      sl: [
        {
          h: "Mindtrip: celoten spletni orodnik nedosegljiv",
          b: "Ob preverbi 28. 9. 2026 so mindtrip.ai, prijava in API prikazovali stran „Under Construction“ (preusmeritev vodi na njihov CDN za slike). O izpadu nismo zasledili medijske pokritosti, recenzije iz 22.–23. 9. pa Mindtrip še navajajo med najboljšimi orodji — recenzijski cikel zaostaja za realnostjo. O vzroku ne ugibamo; trenutno stanje preveri pri njih.",
        },
        {
          h: "Layla: za marsikaterega obiskovalca za zidom",
          b: "layla.ai je ob naših preverbah vračal napako 429 in varnostno preverjanje brskalnika; nekdanja tržna domena itslayla.com je danes nepovezana modna trgovina. Laylo je 31. 7. 2026 prevzela skupina Expedia — klepet-prvi lijaki v tej kategoriji zdaj stojijo na OTA denarju, kar še ne pomeni boljše izkušnje za vsakega obiskovalca.",
        },
        {
          h: "Google: generični AI itinerarji so zdaj brezplačni",
          b: "Po uradni časovnici blogov Google (november 2025 → avgust 2026) znata AI Mode in Gemini sestaviti itinerer brezplačno. „AI ti napiše načrt“ torej ni več razlika med orodji — globina podatkov, preverljivost virov in uporaba brez povezave so.",
        },
      ],
      en: [
        {
          h: "Mindtrip: the entire web toolkit unreachable",
          b: "At our check on 28 Sep 2026, mindtrip.ai, its sign-in and API showed an “Under Construction” page (the redirect leads to their image CDN). We found no media coverage of the outage, while reviews from 22–23 Sep still list Mindtrip among the best tools — the review cycle lags reality. We do not guess about the cause; check the current state with them.",
        },
        {
          h: "Layla: behind a wall for many visitors",
          b: "layla.ai returned error 429 and a browser security check during our verifications; the former marketing domain itslayla.com is today an unrelated fashion shop. Expedia Group acquired Layla on 31 Jul 2026 — chat-first tools in this category now run on OTA money, which does not automatically mean a better experience for every visitor.",
        },
        {
          h: "Google: generic AI itineraries are now free",
          b: "Per Google's official blog timeline (November 2025 → August 2026), AI Mode and Gemini can build an itinerary for free. “AI writes your plan” is therefore no longer a differentiator — data depth, source verifiability and offline use are.",
        },
      ],
    },
    terenFoot: {
      sl: "To so točkovne preverbe z datumom — ne stalne trditve. Če se Mindtrip vrne (in upamo, da se), to sekcijo posodobimo; primerjava ostaja poštena v obeh smerih.",
      en: "These are dated point checks — not permanent claims. If Mindtrip returns (and we hope it does), we update this section; the comparison stays fair in both directions.",
    },
    goodTitle: {
      sl: "Kaj splošni AI načrtovalci delajo odlično",
      en: "What general AI planners do excellently",
    },
    goodLead: {
      sl: "Mindtrip, Layla, Wanderlog, ChatGPT in sorodniki so dobri izdelki (za trenutno dosegljivost glej terensko sekcijo zgoraj). Za naslednje primere je generalist pravilna izbira:",
      en: "Mindtrip, Layla, Wanderlog, ChatGPT and relatives are good products (for current availability see the field section above). For the following cases a generalist is the right choice:",
    },
    good: {
      sl: [
        { h: "Globalna pokritost", b: "Načrt za Tokio, Lizbono in Patagonijo v istem klepetu. Mi pokrivamo samo Slovenijo." },
        { h: "Letalske karte in hoteli", b: "Integracije z velikimi rezervacijskimi sistemi po celem svetu. Pri nas rezervirate lokalna doživetja in izdelke, ne lete." },
        { h: "Skupinsko načrtovanje", b: "Sodelovanje v realnem času z družino ali prijatelji. Mi ponujamo deljenje načrta z anketo, ne skupinsko urejanje." },
        { h: "Zrelost in obseg", b: "Milijoni uporabnikov in velike baze recenzij. Mi smo mlada platforma z ozkim, a globokim fokusom." },
      ],
      en: [
        { h: "Global coverage", b: "A plan for Tokyo, Lisbon and Patagonia in the same chat. We cover only Slovenia." },
        { h: "Flights and hotels", b: "Integrations with the big global booking systems. With us you book local experiences and products, not flights." },
        { h: "Group planning", b: "Real-time collaboration with family or friends. We offer sharing a plan with a poll, not group editing." },
        { h: "Maturity and scale", b: "Millions of users and large review bases. We are a young platform with a narrow but deep focus." },
      ],
    },
    badTitle: {
      sl: "Kje generalisti pri slovenskih potovanjih razočarajo",
      en: "Where generalists disappoint on Slovenian trips",
    },
    badLead: {
      sl: "To niso izmišljene pasti — dokumentirane so v recenzijah AI načrtovalcev (2025–2026) in v naših lastnih testiranjih:",
      en: "These are not invented traps — they are documented in AI planner reviews (2025–2026) and in our own testing:",
    },
    bad: {
      sl: [
        { h: "Cene oddaljene od realnosti", b: "Recenzenti Mindtripa poročajo o cenovnih odstopanjih do 20–30 %. Za mestni oddih je to nadležnost; za vikend s proračunom 300 € je to razlika med dvema dnevoma." },
        { h: "Zaprti objekti v načrtu", b: "Klasična past: AI vključi atrakcijo v dan, ko je ta zaprta (znan primer: „Louvre je zaprt ob torkih“). Brez preverjanja odpiralnih časov tega ne more vedeti." },
        { h: "Generični seznami znamenitosti", b: "Isti seznam top-10 za vsakogar. Slovenija je majhna, a lokalna globina — kdaj na Vintgar brez vrste, kje je kremšnita res tista — zahteva specializirane, urejene podatke." },
      ],
      en: [
        { h: "Prices far from reality", b: "Mindtrip reviewers report price deviations of up to 20–30%. For a city break that is a nuisance; for a €300-budget weekend it is the difference between two days." },
        { h: "Closed venues in the plan", b: "A classic trap: the AI includes an attraction on a day it is closed (famous example: “the Louvre is closed on Tuesdays”). Without checking opening hours it cannot know." },
        { h: "Generic sight lists", b: "The same top-10 list for everyone. Slovenia is small, but local depth — when to visit Vintgar without a queue, where the cream cake is really the one — requires specialised, curated data." },
      ],
    },
    tableTitle: {
      sl: "Primerjava na dlani",
      en: "Comparison at a glance",
    },
    tableCaption: {
      sl: "Primerjava splošnih AI načrtovalcev potovanj s platformo Discover Slovenia AI",
      en: "Comparison of general AI travel planners with the Discover Slovenia AI platform",
    },
    tableWhat: { sl: "Kaj primerjamo", en: "What we compare" },
    tableGeneralists: { sl: "Splošni načrtovalci", en: "General planners" },
    tableUs: { sl: "Discover Slovenia AI", en: "Discover Slovenia AI" },
    table: {
      sl: [
        ["Fokus", "Cel svet", "Samo Slovenija — globoko in preverjeno"],
        ["Račun za shranjevanje načrta", "Pogosto zahtevan (Google/Apple)", "Ni potreben — anonimno shranjevanje in deljenje"],
        ["Preverjanje časov in cen", "Ni sistematično", "Viri + opozorila „preveri pred obiskom“ + geo-validacija"],
        ["Izvedljivost dneva (razdalje, časi)", "Redko preverjena", "Pravi km in minute iz cestnega usmerjanja, opozorilo ob pretesnem dnevu"],
        ["Slovenščina", "Angleščina ali strojni prevod", "4 jeziki kot jedro izdelka (SL/EN/IT/DE)"],
        ["Rezervacije", "Globalni leti in hoteli", "Lokalna doživetja in tržnica s slovenskimi ponudniki"],
        ["Načrt brez povezave", "Pogosto le v aplikacijah", "Da — namesti kot aplikacijo (PWA)"],
        ["Potovanja izven Slovenije", "Da — cel svet", "Ne — odkrito priporočimo generalista"],
      ],
      en: [
        ["Focus", "The whole world", "Only Slovenia — deep and verified"],
        ["Account to save a plan", "Often required (Google/Apple)", "Not needed — anonymous saving and sharing"],
        ["Checking times and prices", "Not systematic", "Sources + “check before visiting” warnings + geo-validation"],
        ["Day feasibility (distances, times)", "Rarely checked", "Real km and minutes from road routing, warning on over-tight days"],
        ["Slovenian language", "English or machine translation", "4 languages as a core product feature (SL/EN/IT/DE)"],
        ["Bookings", "Global flights and hotels", "Local experiences and a marketplace with Slovenian providers"],
        ["Offline plan", "Often apps only", "Yes — install as an app (PWA)"],
        ["Trips outside Slovenia", "Yes — the whole world", "No — we honestly recommend a generalist"],
      ],
    },
    tableFoot: {
      sl: "Tabela je poštena do obeh strani: zadnja vrstica je priznanje, ne pomanjkljivost, ki bi jo skrivali.",
      en: "The table is fair to both sides: the last row is an admission, not a flaw we would hide.",
    },
    practiceTitle: { sl: "Kaj to pomeni v praksi", en: "What this means in practice" },
    practice: {
      sl: [
        {
          n: 1,
          h: "December, 15:40, Vintgarska soteska",
          b: "Generalist lahko sotesko mirno vključi v pozno popoldanski načrt. Naš načrtovalec ve, da pozimi ob 16:00 zapira, in te opozori, naj jo prestaviš dopoldan — z virom podatka.",
        },
        {
          n: 2,
          h: "Bled → Bohinj „približno 30 minut“?",
          b: "Ocene časa „iz spomina modela“ znajo odstopati. Povezovalniki med postanki pri nas nosijo dejanske kilometre in minute iz usmerjanja po pravih cestah — vključno z zimskimi odseki.",
        },
        {
          n: 3,
          h: "Koliko te bo dan res stal?",
          b: "Cene vstopnic in lokalnih specialitet črpamo iz urejenega dataseta z viri — vsota na dnevni kartici nekaj pomeni. Kadar podatka ni, to povemo in dodamo opozorilo.",
        },
      ],
      en: [
        {
          n: 1,
          h: "December, 15:40, Vintar Gorge",
          b: "A generalist may calmly slot the gorge into a late-afternoon plan. Our planner knows it closes at 16:00 in winter and warns you to move it to the morning — with the data source.",
        },
        {
          n: 2,
          h: "Bled → Bohinj “about 30 minutes”?",
          b: "Time estimates “from model memory” can drift. Our connectors between stops carry actual kilometres and minutes from routing on real roads — including winter sections.",
        },
        {
          n: 3,
          h: "What will the day really cost you?",
          b: "Ticket and local-speciality prices are drawn from a curated dataset with sources — the sum on the day card means something. When data is missing, we say so and add a warning.",
        },
      ],
    },
    notTitle: {
      sl: "Kdaj Discover Slovenia AI NI pravi zate",
      en: "When Discover Slovenia AI is NOT right for you",
    },
    notBody: {
      sl: "Če načrtuješ potovanje čez mejo, potrebuješ letalske karte ali hotel v tujini — izberi generalista (Layla, Wanderlog ali klepet s ChatGPT/Gemini). To je v redu; tudi mi njih uporabljamo za tuja potovanja. Radi pa te vidimo na slovenskem delu poti.",
      en: "If you are planning a cross-border trip, need flights or a hotel abroad — pick a generalist (Layla, Wanderlog or a chat with ChatGPT/Gemini). That is fine; we use them for foreign trips too. But we would love to see you on the Slovenian leg of your journey.",
    },
    tryTitle: { sl: "Poskusi brez prijave", en: "Try it without signing up" },
    tryBody: {
      sl: "Od vprašanja do načrta: 30 sekund. Zahtevan račun: nič. Jezik: slovenščina, angleščina, italijanščina ali nemščina.",
      en: "From question to plan: 30 seconds. Account required: none. Language: Slovenian, English, Italian or German.",
    },
    ctaPlan: { sl: "Sestavi moj načrt", en: "Build my plan" },
    ctaDest: { sl: "Razišči destinacije", en: "Explore destinations" },
    ctaMap: { sl: "Odpri zemljevid", en: "Open the map" },
    faqTitle: { sl: "Pogosta vprašanja", en: "Frequently asked questions" },
    faq: {
      sl: [
        {
          h: "Ali potrebujem račun, da načrtujem potovanje?",
          b: "Ne. Načrt ustvariš, shraniš in deliš povsem brez prijave — deluje anonimno. Prosti račun je neobvezen in doda le zgodovino potovanj na strani Moja potovanja.",
        },
        {
          h: "Koliko stane uporaba?",
          b: "Načrtovalec, itinererji, vodiči in deljenje so brezplačni. Platforma zasluži z rezervacijami lokalnih doživetij in prodajo na tržnici — ne s tvojimi podatki.",
        },
        {
          h: "Kaj če potujem izven Slovenije?",
          b: "Iskreno: za čezmejna potovanja uporabi generalista (na primer Layla, Wanderlog, Mindtrip) ali klepet z AI. Mi pokrivamo samo Slovenijo — a jo pokrivamo globoko, s preverjenimi lokalnimi podatki.",
        },
        {
          h: "Kako zanesljivi so tvoji podatki?",
          b: "Podatke za destinacije urejamo uredniško, cene in odpiralni časi imajo vire, vsak načrt pa gre skozi geo-validacijo z opozorili. Kadar nismo prepričani, piše „preveri pred obiskom“. Metodologija je javna na strani Vir podatkov.",
        },
        {
          h: "Do zdaj sem uporabljal(a) Mindtrip — zakaj preklopiti?",
          b: "Mindtrip je bil dober generalist; ob preverbi 28. 9. 2026 je bilo celo njihovo spletno okolje (stran, prijava, API) nedosegljivo, o vzroku pa ne moremo soditi. Za slovenska potovanja pri nas dobiš: načrtovanje brez prijave, štiri jezike, preverjene lokalne podatke in rezervacije pri lokalnih ponudnikih. Presodi sam — poskus brez prijave traja 30 sekund.",
        },
        {
          h: "Kaj se je zgodilo z Mindtripom?",
          b: "Iskreno: vemo le, kar smo preverili. 28. septembra 2026 je celoten njihov spletni orodnik (mindtrip.ai, prijava, API) prikazoval stran „Under Construction“; o izpadu nismo našli medijske pokritosti, recenzije iz 22.–23. septembra pa jih medtem še uvrščajo med najboljša brezplačna AI orodja za načrtovanje. Ne ugibamo o vzrokih ali prihodnosti — trenutno stanje preveri neposredno pri njih.",
        },
      ],
      en: [
        {
          h: "Do I need an account to plan a trip?",
          b: "No. You create, save and share a plan entirely without signing in — it works anonymously. A free account is optional and only adds trip history on the My trips page.",
        },
        {
          h: "How much does it cost?",
          b: "The planner, itineraries, guides and sharing are free. The platform earns from local experience bookings and marketplace sales — not from your data.",
        },
        {
          h: "What if I travel outside Slovenia?",
          b: "Honestly: for cross-border trips use a generalist (e.g. Layla, Wanderlog, Mindtrip) or an AI chat. We cover only Slovenia — but we cover it deeply, with verified local data.",
        },
        {
          h: "How reliable is your data?",
          b: "Destination data is editorially curated, prices and opening hours carry sources, and every plan goes through geo-validation with warnings. When we are not sure, it says “check before visiting”. The methodology is public on the Data sources page.",
        },
        {
          h: "I have been using Mindtrip — why switch?",
          b: "Mindtrip was a good generalist; at our 28 Sep 2026 check their entire web environment (site, sign-in, API) was unreachable, and we cannot judge the cause. For Slovenian trips you get here: no-sign-up planning, four languages, verified local data and bookings with local providers. Judge for yourself — a no-sign-up trial takes 30 seconds.",
        },
        {
          h: "What happened to Mindtrip?",
          b: "Honestly: we only know what we verified. On 28 September 2026 their entire web toolkit (mindtrip.ai, sign-in, API) showed an “Under Construction” page; we found no media coverage of the outage, while reviews from 22–23 September still rank them among the best free AI planning tools. We do not guess about causes or the future — check the current state directly with them.",
        },
      ],
    },
    footNote: {
      sl: "Primerjava temelji na javno dostopnih recenzijah (2025–2026) in uredniški analizi platforme (september 2026).",
      en: "The comparison draws on publicly available reviews (2025–2026) and editorial analysis of the platform (September 2026).",
    },
    footLinks: { sl: "Vir podatkov · zaupanje in varnost", en: "Data sources · trust and safety" },
  } as const;

  const rows = pick(l, L.table);
  const t = (k: keyof typeof L) => pick(l, L[k]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />
      <p className="mt-3 text-sm text-muted-foreground">{t("updated")}</p>

      {/* Teren — datirane preverbe */}
      <section aria-labelledby="teren-h" className="mt-12 scroll-mt-24">
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
          {t("terenKicker")}
        </p>
        <h2 id="teren-h" className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
          {t("terenTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("terenLead")}
        </p>
        <div className="mt-5 space-y-3">
          {pick(l, L.teren).map((item) => (
            <Card key={item.h}>
              <CardContent className="flex items-start gap-3 p-5">
                <SearchCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold sm:text-base">{item.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.b}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
          {t("terenFoot")}
        </p>
      </section>

      {/* Kaj generalisti delajo odlično */}
      <section aria-labelledby="good-h" className="mt-12 scroll-mt-24">
        <h2 id="good-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("goodTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("goodLead")}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pick(l, L.good).map((item) => (
            <Card key={item.h}>
              <CardContent className="p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {item.h}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.b}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Kje generalisti razočarajo */}
      <section aria-labelledby="bad-h" className="mt-12 scroll-mt-24">
        <h2 id="bad-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("badTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("badLead")}
        </p>
        <div className="mt-5 space-y-3">
          {pick(l, L.bad).map((item) => (
            <Card key={item.h}>
              <CardContent className="flex items-start gap-3 p-5">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold sm:text-base">{item.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.b}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tabela primerjave */}
      <section aria-labelledby="table-h" className="mt-12 scroll-mt-24">
        <h2 id="table-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("tableTitle")}
        </h2>
        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("tableCaption")}</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3 font-semibold sm:p-4">
                  {t("tableWhat")}
                </th>
                <th scope="col" className="p-3 font-semibold sm:p-4">
                  {t("tableGeneralists")}
                </th>
                <th scope="col" className="p-3 font-semibold text-primary sm:p-4">
                  {t("tableUs")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([what, them, us]) => (
                <tr key={what} className="border-t">
                  <th scope="row" className="p-3 text-left font-medium sm:p-4">
                    {what}
                  </th>
                  <td className="p-3 text-muted-foreground sm:p-4">{them}</td>
                  <td className="p-3 font-medium sm:p-4">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("tableFoot")}</p>
      </section>

      {/* Praksa */}
      <section aria-labelledby="practice-h" className="mt-12 scroll-mt-24">
        <h2 id="practice-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("practiceTitle")}
        </h2>
        <ol className="mt-5 space-y-3">
          {pick(l, L.practice).map((item) => (
            <li key={item.n}>
              <Card>
                <CardContent className="flex items-start gap-4 p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  >
                    {item.n}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold sm:text-base">{item.h}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.b}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Kdaj NI pravi zate + CTA */}
      <section
        aria-labelledby="not-h"
        className="mt-12 scroll-mt-24 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 sm:p-10"
      >
        <h2 id="not-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("notTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("notBody")}
        </p>
        <h3 className="mt-8 text-lg font-bold">{t("tryTitle")}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("tryBody")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="tap-target font-semibold">
            <Link href="/nacrtuj">
              {t("ctaPlan")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="tap-target font-semibold">
            <Link href="/destinacije">{t("ctaDest")}</Link>
          </Button>
          <Button asChild variant="ghost" className="tap-target font-semibold">
            <Link href="/zemljevid">
              <MapIcon className="size-4" aria-hidden="true" />
              {t("ctaMap")}
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-h" className="mt-12 scroll-mt-24">
        <h2 id="faq-h" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t("faqTitle")}
        </h2>
        <div className="mt-5 space-y-3">
          {pick(l, L.faq).map((item) => (
            <Card key={item.h}>
              <CardHeader>
                <CardTitle className="text-sm font-bold text-balance sm:text-base">
                  {item.h}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.b}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        <p>{t("footNote")}</p>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <Compass className="size-4 text-primary" aria-hidden="true" />
          <Link href="/vir-podatkov" className="font-medium text-primary hover:underline">
            {t("footLinks")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
