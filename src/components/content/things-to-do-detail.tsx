"use client";

import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Plus,
  Star,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { pick, type PickDict } from "@/lib/i18n-pick";
import { GUIDE_THEMES, thingsToDoIntro } from "@/lib/content-data";
import {
  type Destination,
  type Season,
  getDestination,
  regionLabel,
} from "@/lib/slovenia-data";

const SEASONS: Record<Season, PickDict<string>> = {
  spring: { sl: "Pomlad", en: "Spring", it: "Primavera", de: "Frühling", fr: "Printemps", es: "Primavera" },
  summer: { sl: "Poletje", en: "Summer", it: "Estate", de: "Sommer", fr: "Été", es: "Verano" },
  autumn: { sl: "Jesen", en: "Autumn", it: "Autunno", de: "Herbst", fr: "Automne", es: "Otoño" },
  winter: { sl: "Zima", en: "Winter", it: "Inverno", de: "Winter", fr: "Hiver", es: "Invierno" },
};

const SEASON_EMOJI: Record<Season, string> = {
  spring: "🌸",
  summer: "☀️",
  autumn: "🍂",
  winter: "❄️",
};

/**
 * KAJ POČETI IN VIDETI — podstran /destinacija/[slug]/things-to-do.
 *
 * Produkcija (rss + teaser z glavne strani): intro opis, glavne
 * znamenitosti, aktivnosti, vodniki po tipu potovanja, najboljši čas
 * in poštena vsebina FAQ iz kanonskih podatkov (brez izmišljanja).
 */
export function ThingsToDoDetail({ d }: { d: Destination }) {
  const l = useLocale();
  const intro = thingsToDoIntro(d.slug);

  const L = {
    back: { sl: `← ${d.name}`, en: `← ${d.name}`, it: `← ${d.name}`, de: `← ${d.name}`, fr: `← ${d.name}`, es: `← ${d.name}` },
    kicker: { sl: "Vodnik po destinaciji", en: "Destination guide", it: "Guida della destinazione", de: "Destinations-Guide", fr: "Guide de la destination", es: "Guía del destino" },
    title: { sl: `Kaj početi in videti v ${d.name}`, en: `Things to do and see in ${d.name}`, it: `Cose da fare e vedere a ${d.name}`, de: `Sehen und Erleben in ${d.name}`, fr: `Que faire et voir à ${d.name}`, es: `Qué hacer y ver en ${d.name}` },
    introNote: {
      sl: `Podrobna stran z aktivnostmi, nasveti in praktičnimi informacijami — ${d.highlights.length} glavne znamenitosti na enem mestu.`,
      en: `A detailed page with activities, tips and practical information — ${d.highlights.length} key sights in one place.`,
      it: `Pagina dettagliata con attività, consigli e informazioni pratiche — ${d.highlights.length} attrazioni principali in un unico posto.`,
      de: `Detaillierte Seite mit Aktivitäten, Tipps und praktischen Infos — ${d.highlights.length} Hauptsehenswürdigkeiten an einem Ort.`,
      fr: `Page détaillée avec activités, conseils et informations pratiques — ${d.highlights.length} sites incontournables au même endroit.`,
      es: `Página detallada con actividades, consejos e información práctica — ${d.highlights.length} lugares clave en un solo sitio.`,
    },
    highlightsTitle: { sl: "Glavne znamenitosti", en: "Key sights", it: "Attrazioni principali", de: "Hauptsehenswürdigkeiten", fr: "Sites incontournables", es: "Lugares clave" },
    activitiesTitle: { sl: "Aktivnosti", en: "Activities", it: "Attività", de: "Aktivitäten", fr: "Activités", es: "Actividades" },
    bestForTitle: { sl: "Najboljše za", en: "Best for", it: "Ideale per", de: "Ideal für", fr: "Idéal pour", es: "Ideal para" },
    seasonTitle: { sl: "Najboljši čas za obisk", en: "Best time to visit", it: "Miglior periodo per visitare", de: "Beste Reisezeit", fr: "Meilleure période pour visiter", es: "Mejor época para visitar" },
    seasonIn: {
      sl: (s: Season[]) => s.map((x) => pick(l, SEASONS[x])).join(", "),
      en: (s: Season[]) => s.map((x) => pick(l, SEASONS[x])).join(", "),
      it: (s: Season[]) => s.map((x) => pick(l, SEASONS[x])).join(", "),
      de: (s: Season[]) => s.map((x) => pick(l, SEASONS[x])).join(", "),
      fr: (s: Season[]) => s.map((x) => pick(l, SEASONS[x])).join(", "),
      es: (s: Season[]) => s.map((x) => pick(l, SEASONS[x])).join(", "),
    },
    seasonOff: {
      sl: "Zunaj sezone — produkcija za te mesece priporoča preverjanje odpiralnih časov.",
      en: "Off-season — for these months production recommends checking opening hours.",
      it: "Fuori stagione — per questi mesi la produzione consiglia di controllare gli orari di apertura.",
      de: "Nebensaison — für diese Monate empfiehlt die Produktion, die Öffnungszeiten zu prüfen.",
      fr: "Hors saison — pour ces mois, la production recommande de vérifier les horaires d’ouverture.",
      es: "Fuera de temporada — para estos meses la producción recomienda comprobar los horarios de apertura.",
    },
    themesTitle: { sl: "Vodniki po tipu potovanja", en: "Guides by trip type", it: "Guide per tipo di viaggio", de: "Guides nach Reiseart", fr: "Guides par type de voyage", es: "Guías por tipo de viaje" },
    themesLead: {
      sl: "Ista destinacija, drugačen način potovanja — izberi vodnik po svoji druščini.",
      en: "Same destination, a different way to travel — pick a guide by your party.",
      it: "Stessa destinazione, un modo diverso di viaggiare — scegli una guida in base al tuo gruppo.",
      de: "Gleiche Destination, andere Art zu reisen — wähle einen Guide nach deiner Reisegruppe.",
      fr: "Même destination, une autre façon de voyager — choisis un guide selon ton groupe.",
      es: "Mismo destino, otra forma de viajar — elige una guía según tu grupo.",
    },
    faqTitle: { sl: "Pogosta vprašanja", en: "Frequently asked questions", it: "Domande frequenti", de: "Häufig gestellte Fragen", fr: "Questions fréquentes", es: "Preguntas frecuentes" },
    faqWhen: { sl: "Kdaj je najboljši čas za obisk?", en: "When is the best time to visit?", it: "Quando è il miglior periodo per visitare?", de: "Wann ist die beste Reisezeit?", fr: "Quelle est la meilleure période pour visiter ?", es: "¿Cuál es la mejor época para visitar?" },
    faqWhenA: {
      sl: (s: Season[]) => `Po kanonskem naboru: ${s.map((x) => pick(l, SEASONS[x])).join(", ")}.`,
      en: (s: Season[]) => `Per the canonical dataset: ${s.map((x) => pick(l, SEASONS[x])).join(", ")}.`,
      it: (s: Season[]) => `Secondo il dataset canonico: ${s.map((x) => pick(l, SEASONS[x])).join(", ")}.`,
      de: (s: Season[]) => `Laut kanonischem Datensatz: ${s.map((x) => pick(l, SEASONS[x])).join(", ")}.`,
      fr: (s: Season[]) => `Selon l’ensemble de données canonique : ${s.map((x) => pick(l, SEASONS[x])).join(", ")}.`,
      es: (s: Season[]) => `Según el conjunto de datos canónico: ${s.map((x) => pick(l, SEASONS[x])).join(", ")}.`,
    },
    faqCost: { sl: "Koliko stane obisk?", en: "How much does a visit cost?", it: "Quanto costa la visita?", de: "Wie viel kostet der Besuch?", fr: "Combien coûte la visite ?", es: "¿Cuánto cuesta la visita?" },
    faqCostA: {
      sl: (c: number, b: string) => `Ocena stroška na osebo ≈ ${c} € (cenovni razred ${b}). Cene vstopnic imajo vire — kjer podatka ni, piše „preveri pred obiskom".`,
      en: (c: number, b: string) => `Estimated cost per person ≈ €${c} (price band ${b}). Ticket prices carry sources — where data is missing it says “check before visiting”.`,
      it: (c: number, b: string) => `Costo stimato per persona ≈ ${c} € (fascia di prezzo ${b}). I prezzi dei biglietti hanno fonti — dove manca il dato c’è scritto “verifica prima di visitare”.`,
      de: (c: number, b: string) => `Geschätzte Kosten pro Person ≈ ${c} € (Preisrahmen ${b}). Ticketpreise haben Quellen — wo Daten fehlen, steht „vor dem Besuch prüfen“.`,
      fr: (c: number, b: string) => `Coût estimé par personne ≈ ${c} € (tranche de prix ${b}). Les prix des billets ont des sources — quand la donnée manque, il est écrit « vérifier avant de visiter ».`,
      es: (c: number, b: string) => `Coste estimado por persona ≈ ${c} € (banda de precio ${b}). Los precios de las entradas tienen fuentes — donde falta el dato, dice “comprueba antes de visitar”.`,
    },
    faqTime: { sl: "Koliko časa potrebujem?", en: "How much time do I need?", it: "Quanto tempo mi serve?", de: "Wie viel Zeit brauche ich?", fr: "Combien de temps me faut-il ?", es: "¿Cuánto tiempo necesito?" },
    faqTimeA: {
      sl: (t: string) => `Priporočen čas obiska: ${t}.`,
      en: (t: string) => `Recommended visit time: ${t}.`,
      it: (t: string) => `Tempo di visita consigliato: ${t}.`,
      de: (t: string) => `Empfohlene Besuchszeit: ${t}.`,
      fr: (t: string) => `Durée de visite conseillée : ${t}.`,
      es: (t: string) => `Tiempo de visita recomendado: ${t}.`,
    },
    faqMust: { sl: "Česa ne smem zamuditi?", en: "What must I not miss?", it: "Cosa non devo perdere?", de: "Was darf ich nicht verpassen?", fr: "Qu’est-ce que je ne dois pas manquer ?", es: "¿Qué no debo perderme?" },
    faqMustA: {
      sl: (h: string[]) => `Glavne znamenitosti: ${h.join(", ")}.`,
      en: (h: string[]) => `Key sights: ${h.join(", ")}.`,
      it: (h: string[]) => `Attrazioni principali: ${h.join(", ")}.`,
      de: (h: string[]) => `Hauptsehenswürdigkeiten: ${h.join(", ")}.`,
      fr: (h: string[]) => `Sites incontournables : ${h.join(", ")}.`,
      es: (h: string[]) => `Lugares clave: ${h.join(", ")}.`,
    },
    rating: { sl: "Ocena", en: "Rating", it: "Valutazione", de: "Bewertung", fr: "Note", es: "Valoración" },
    ratingNote: { sl: "Uredniška ocena, nikoli uporabniška recenzija.", en: "Editorial rating, never a user review.", it: "Valutazione editoriale, mai una recensione utente.", de: "Redaktionelle Bewertung, niemals eine Nutzerbewertung.", fr: "Note éditoriale, jamais un avis d’utilisateur.", es: "Valoración editorial, nunca una reseña de usuario." },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓", it: "Nel mio viaggio ✓", de: "In meiner Reise ✓", fr: "Dans mon voyage ✓", es: "En mi viaje ✓" },
    planCta: { sl: "Načrtuj obisk", en: "Plan the visit", it: "Pianifica la visita", de: "Besuch planen", fr: "Planifier la visite", es: "Planifica la visita" },
    eventsCta: { sl: "Dogodki v okolici", en: "Events nearby", it: "Eventi nelle vicinanze", de: "Veranstaltungen in der Nähe", fr: "Événements à proximité", es: "Eventos cercanos" },
    metaRegion: { sl: "Regija", en: "Region", it: "Regione", de: "Region", fr: "Région", es: "Región" },
    enNote: {
      sl: "",
      en: "Content note: the destination dataset is canonically Slovenian; an English content overlay is not yet available.",
      it: "Nota sui contenuti: il dataset delle destinazioni è canonicamente in sloveno; un overlay dei contenuti in inglese non è ancora disponibile.",
      de: "Inhaltshinweis: der Destinations-Datensatz ist kanonisch slowenisch; ein englischer Inhalts-Overlay ist noch nicht verfügbar.",
      fr: "Note de contenu : l’ensemble de données des destinations est canoniquement en slovène ; une surcouche de contenu en anglais n’est pas encore disponible.",
      es: "Nota de contenido: el conjunto de datos de destinos es canónicamente en esloveno; una superposición de contenido en inglés aún no está disponible.",
    },
  } as const;

  const faq = [
    { q: pick(l, L.faqWhen), a: pick(l, L.faqWhenA)(d.bestSeason) },
    { q: pick(l, L.faqCost), a: pick(l, L.faqCostA)(d.costPerPerson, d.budget) },
    { q: pick(l, L.faqTime), a: pick(l, L.faqTimeA)(d.duration) },
    { q: pick(l, L.faqMust), a: pick(l, L.faqMustA)(d.highlights) },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Link
        href={`/destinacija/${d.slug}`}
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {pick(l, L.back)}
      </Link>

      <header className="mt-5">
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
          {pick(l, L.kicker)}
        </p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {pick(l, L.title)}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {intro ?? `${d.tagline}. ${d.highlights.join(", ")}.`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{pick(l, L.introNote)}</p>
      </header>

      {l !== "sl" && pick(l, L.enNote) && (
        <p className="mt-6 rounded-xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.06] to-card px-4 py-3 text-xs text-muted-foreground">
          {pick(l, L.enNote)}
        </p>
      )}

      {/* Praktična kartica */}
      <Card className="mt-8 overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardContent className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2.5">
            <Star className="size-5 shrink-0 fill-primary text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{pick(l, L.rating)}</p>
              <p className="text-sm font-bold">{d.rating.toFixed(1)} / 5</p>
              <p className="text-[11px] text-muted-foreground">{pick(l, L.ratingNote)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{pick(l, L.metaRegion)}</p>
              <p className="text-sm font-bold">{regionLabel(d.region, l)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Wallet className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{pick(l, L.faqCost)}</p>
              <p className="text-sm font-bold">
                ≈ {d.costPerPerson} € / {pick(l, { sl: "osebo", en: "person", it: "persona", de: "Person", fr: "personne", es: "persona" })} · {d.budget}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock3 className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{pick(l, L.faqTime)}</p>
              <p className="text-sm font-bold">{d.duration}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <AddToTripButton
          refId={d.slug}
          name={d.name}
          kind="destination"
          source="destinacija"
          labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
          size="default"
          variant="default"
        />
        <Button asChild variant="outline" className="font-semibold">
          <Link href={`/nacrtuj?dest=${d.slug}`}>
            {pick(l, L.planCta)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="font-semibold">
          <Link href="/dogodki">{pick(l, L.eventsCta)}</Link>
        </Button>
      </div>

      {/* Glavne znamenitosti */}
      <section aria-labelledby="ttd-highlights" className="mt-12">
        <h2 id="ttd-highlights" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.highlightsTitle)}
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {d.highlights.map((h, i) => (
            <li key={h}>
              <Card className="group overflow-hidden rounded-2xl border-border/70 py-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                  <Image
                    src={d.image}
                    alt={h}
                    fill
                    loading="lazy"
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {i === 0 && (
                    <Badge className="absolute top-2 left-2">
                      {pick(l, { sl: "Najbolj znano", en: "Most iconic", it: "Il più iconico", de: "Am bekanntesten", fr: "Le plus emblématique", es: "El más icónico" })}
                    </Badge>
                  )}
                </div>
                <CardContent className="flex items-center gap-2.5 p-4">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold">{h}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Aktivnosti + najboljše za + sezona */}
      <section aria-labelledby="ttd-activities" className="mt-12">
        <h2 id="ttd-activities" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.activitiesTitle)}
        </h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {pick(l, L.activitiesTitle)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {d.activities.map((a) => (
                <Badge key={a} variant="secondary" className="px-2.5 py-1 text-xs font-medium">
                  {a}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {pick(l, L.bestForTitle)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {d.bestFor.map((b) => (
                <Badge key={b} variant="secondary" className="px-2.5 py-1 text-xs font-medium">
                  {b}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              {pick(l, L.seasonTitle)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {(Object.keys(SEASONS) as Season[]).map((s) => {
                const on = d.bestSeason.includes(s);
                return (
                  <li key={s}>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        on
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      <span aria-hidden="true">{SEASON_EMOJI[s]}</span>
                      {pick(l, SEASONS[s])}
                    </span>
                  </li>
                );
              })}
            </ul>
            {d.bestSeason.length < 4 && (
              <p className="mt-3 text-xs text-muted-foreground">{pick(l, L.seasonOff)}</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator className="my-10" />

      {/* Vodniki po tipu potovanja */}
      <section aria-labelledby="ttd-themes" className="mt-2">
        <h2 id="ttd-themes" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.themesTitle)}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.themesLead)}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {GUIDE_THEMES.map((theme) => (
            <Link
              key={theme.id}
              // P0 AUDIT (BROKEN → popravljen): prej `/destinacija/${d.slug}/guide/${theme.id}`
              // — ta rute NE obstaja (stran nikoli zgrajena) → vsak klik 404.
              // Iskrena preusmeritev na hub vodnikov, ki obstaja.
              href={`/vodici`}
              className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-green"
            >
              <p className="flex items-center gap-2 text-sm font-bold group-hover:text-primary">
                <span aria-hidden="true">{theme.emoji}</span>
                {pick(l, theme.label)}
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {theme.description}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {pick(l, { sl: "Odpri vodnike", en: "Open the guides", it: "Apri le guide", de: "Guides öffnen", fr: "Ouvrir les guides", es: "Abrir las guías" })}
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ (odgovori iz kanonskih podatkov) */}
      <section aria-labelledby="ttd-faq" className="mt-12">
        <h2 id="ttd-faq" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.faqTitle)}
        </h2>
        <div className="mt-5 space-y-3">
          {faq.map((item) => (
            <Card key={item.q} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold sm:text-base">{item.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {pick(l, {
            sl: "Odgovori so izpeljani iz kanonskega nabora podatkov (niki izmišljeni); viri so zapisani pri vsaki destinaciji.",
            en: "Answers are derived from the canonical dataset (nothing invented); sources are recorded on each destination.",
            it: "Le risposte derivano dal dataset canonico (niente di inventato); le fonti sono registrate per ogni destinazione.",
            de: "Die Antworten leiten sich aus dem kanonischen Datensatz ab (nichts erfunden); Quellen sind bei jeder Destination hinterlegt.",
            fr: "Les réponses dérivent de l’ensemble de données canonique (rien d’inventé) ; les sources sont enregistrées pour chaque destination.",
            es: "Las respuestas se derivan del conjunto de datos canónico (nada inventado); las fuentes están registradas en cada destino.",
          })}
        </p>
      </section>

      {/* Skupna akcija */}
      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild className="tap-target font-semibold">
          <Link href={`/nacrtuj?dest=${d.slug}`}>
            <Plus className="size-4" aria-hidden="true" />
            {pick(l, L.planCta)}
          </Link>
        </Button>
        <Button asChild variant="outline" className="tap-target font-semibold">
          <Link href="/destinacije">{pick(l, { sl: "Vse destinacije", en: "All destinations", it: "Tutte le destinazioni", de: "Alle Destinationen", fr: "Toutes les destinations", es: "Todos los destinos" })}</Link>
        </Button>
      </div>
    </div>
  );
}

/** Uporabljeno v guide/[tema] strani (isti import modula). */
export { getDestination };
