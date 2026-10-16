"use client";

import { ArrowRight, Award, MapPin, Sparkles, Ticket, Trophy } from "lucide-react";
import { useLocale } from "next-intl";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { REGIONS, DATA_STATS } from "@/lib/slovenia-data";

/**
 * /slovenia-pass — predstavitev pasa 1:1 po produkciji (hero „zbiraj
 * značke" + „Zbiraj svoje slovenske doživetja"). Koristi so iz besedila
 * produkcije (brezplačno, točke za vsak AI načrt); regije značk so
 * kanonskih 21 regij dataseta (2.22.0: preverjeni popravek — Posočje). Igrifikacija v pripravi — iskreno označeno.
 */
export default function SloveniaPassPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Slovenia Pass", en: "Slovenia Pass", it: "Slovenia Pass", de: "Slovenia Pass", fr: "Slovenia Pass", es: "Slovenia Pass" },
    title: { sl: "Slovenia Pass — zbiraj značke", en: "Slovenia Pass — collect badges", it: "Slovenia Pass — colleziona badge", de: "Slovenia Pass — Abzeichen sammeln", fr: "Slovenia Pass — collecte des badges", es: "Slovenia Pass — colecciona insignias" },
    lead: {
      sl: "Obiščite slovenske regije, zbirajte značke in odklenite nagrade — potovanje skozi Slovenijo kot igra.",
      en: "Visit Slovenian regions, collect badges and unlock rewards — travelling through Slovenia as a game.",
      it: "Visita le regioni slovene, colleziona badge e sblocca premi — un viaggio attraverso la Slovenia come un gioco.",
      de: "Besuche die slowenischen Regionen, sammle Abzeichen und schalte Belohnungen frei — Reisen durch Slowenien als Spiel.",
      fr: "Visite les régions slovènes, collecte des badges et débloque des récompenses — voyager en Slovénie comme dans un jeu.",
      es: "Visita las regiones eslovenas, colecciona insignias y desbloquea recompensas — viajar por Eslovenia como un juego.",
    },
    metaFree: { sl: "Brezplačno", en: "Free", it: "Gratis", de: "Kostenlos", fr: "Gratuit", es: "Gratis" },
    metaPoints: { sl: "Točke za vsak AI načrt", en: "Points for every AI plan", it: "Punti per ogni piano AI", de: "Punkte für jeden KI-Plan", fr: "Points pour chaque plan IA", es: "Puntos por cada plan de IA" },
    collectTitle: {
      sl: "Zbiraj svoje slovenske doživetja",
      en: "Collect your Slovenian experiences",
      it: "Colleziona le tue esperienze slovene",
      de: "Sammle deine slowenischen Erlebnisse",
      fr: "Collectionne tes expériences slovènes",
      es: "Colecciona tus experiencias eslovenas",
    },
    collectLead: {
      sl: "Vsak AI načrt prinese točke in značke. Koliko regij lahko obiščeš?",
      en: "Every AI plan brings points and badges. How many regions can you visit?",
      it: "Ogni piano AI porta punti e badge. Quante regioni riesci a visitare?",
      de: "Jeder KI-Plan bringt Punkte und Abzeichen. Wie viele Regionen kannst du besuchen?",
      fr: "Chaque plan IA rapporte des points et des badges. Combien de régions peux-tu visiter ?",
      es: "Cada plan de IA da puntos e insignias. ¿Cuántas regiones puedes visitar?",
    },
    howTitle: { sl: "Kako deluje", en: "How it works", it: "Come funziona", de: "So funktioniert es", fr: "Comment ça marche", es: "Cómo funciona" },
    how: {
      sl: [
        { h: "Načrtuj", b: "Sestavi AI načrt potovanja po Sloveniji — vsak načrt prinese točke." },
        { h: "Obišči", b: "Potuj po regijah iz našega kanonskega nabora 74 destinacij in zbiraj značke po regijah." },
        { h: "Odkleni", b: "Z več regijami in točkami odklenjuješ stopnje pasa — potovanje kot igra." },
      ],
      en: [
        { h: "Plan", b: "Build an AI travel plan around Slovenia — every plan brings points." },
        { h: "Visit", b: "Travel through regions from our canonical set of 74 destinations and collect badges by region." },
        { h: "Unlock", b: "More regions and points unlock pass levels — travel as a game." },
      ],
      it: [
        { h: "Pianifica", b: "Crea un piano di viaggio AI per la Slovenia — ogni piano porta punti." },
        { h: "Visita", b: "Viaggia tra le regioni del nostro set canonico di 74 destinazioni e colleziona badge per regione." },
        { h: "Sblocca", b: "Più regioni e punti sbloccano i livelli del pass — viaggiare come un gioco." },
      ],
      de: [
        { h: "Planen", b: "Erstelle einen KI-Reiseplan durch Slowenien — jeder Plan bringt Punkte." },
        { h: "Besuchen", b: "Reise durch die Regionen unseres kanonischen Sets aus 74 Destinationen und sammle Abzeichen je Region." },
        { h: "Freischalten", b: "Mehr Regionen und Punkte schalten Pass-Stufen frei — Reisen als Spiel." },
      ],
      fr: [
        { h: "Planifier", b: "Crée un plan de voyage IA en Slovénie — chaque plan rapporte des points." },
        { h: "Visiter", b: "Voyage à travers les régions de notre ensemble canonique de 74 destinations et collecte des badges par région." },
        { h: "Débloquer", b: "Plus de régions et de points débloquent des niveaux du pass — voyager comme un jeu." },
      ],
      es: [
        { h: "Planifica", b: "Crea un plan de viaje con IA por Eslovenia — cada plan da puntos." },
        { h: "Visita", b: "Viaja por las regiones de nuestro conjunto canónico de 74 destinos y colecciona insignias por región." },
        { h: "Desbloquea", b: "Más regiones y puntos desbloquean niveles del pase — viajar como un juego." },
      ],
    },
    benefitsTitle: { sl: "Koristi pasa", en: "Pass benefits", it: "Vantaggi del pass", de: "Pass-Vorteile", fr: "Avantages du pass", es: "Ventajas del pase" },
    benefits: {
      sl: [
        { h: "Brezplačno", b: "Pass je brezplačen — brez naročnine, brez skritih stroškov." },
        { h: "Točke za načrte", b: "Točke zbereš z vsakim AI načrtom — ne z nakupi." },
        { h: "Značke po regijah", b: "Vsaka slovenska regija ima svojo značko — zbiraš jih z obiski." },
        { h: "Nagrade", b: "Z oddaljenimi stopnjami odkleneš nagrade (v pripravi)." },
      ],
      en: [
        { h: "Free", b: "The pass is free — no subscription, no hidden costs." },
        { h: "Points for plans", b: "You earn points with every AI plan — not with purchases." },
        { h: "Badges by region", b: "Each Slovenian region has its own badge — you collect them by visiting." },
        { h: "Rewards", b: "Reaching levels unlocks rewards (in preparation)." },
      ],
      it: [
        { h: "Gratis", b: "Il pass è gratuito — senza abbonamento, senza costi nascosti." },
        { h: "Punti per i piani", b: "Con ogni piano AI accumuli punti — non con gli acquisti." },
        { h: "Badge per regione", b: "Ogni regione slovena ha il suo badge — li collezioni visitando." },
        { h: "Premi", b: "Raggiungere i livelli sblocca premi (in preparazione)." },
      ],
      de: [
        { h: "Kostenlos", b: "Der Pass ist kostenlos — ohne Abo, ohne versteckte Kosten." },
        { h: "Punkte für Pläne", b: "Mit jedem KI-Plan sammelst du Punkte — nicht mit Käufen." },
        { h: "Abzeichen je Region", b: "Jede slowenische Region hat ihr eigenes Abzeichen — du sammelst sie durch Besuche." },
        { h: "Belohnungen", b: "Erreichte Stufen schalten Belohnungen frei (in Vorbereitung)." },
      ],
      fr: [
        { h: "Gratuit", b: "Le pass est gratuit — sans abonnement, sans frais cachés." },
        { h: "Points pour les plans", b: "Tu gagnes des points avec chaque plan IA — pas avec des achats." },
        { h: "Badges par région", b: "Chaque région slovène a son propre badge — tu les collectes en visitant." },
        { h: "Récompenses", b: "Atteindre des niveaux débloque des récompenses (en préparation)." },
      ],
      es: [
        { h: "Gratis", b: "El pase es gratis — sin suscripción, sin costes ocultos." },
        { h: "Puntos por planes", b: "Ganas puntos con cada plan de IA — no con compras." },
        { h: "Insignias por región", b: "Cada región eslovena tiene su propia insignia — las coleccionas visitando." },
        { h: "Recompensas", b: "Alcanzar niveles desbloquea recompensas (en preparación)." },
      ],
    },
    regionsTitle: { sl: "Regije značk", en: "Badge regions", it: "Regioni dei badge", de: "Abzeichen-Regionen", fr: "Régions des badges", es: "Regiones de insignias" },
    regionsLead: {
      sl: "Značke pokrivajo vseh 21 regij nabora (Slovenija in sosednje jadranske dežele).",
      en: "Badges cover all 21 regions of the dataset (Slovenia and the neighbouring Adriatic countries).",
      it: "I badge coprono tutte le 21 regioni del dataset (la Slovenia e i paesi adriatici limitrofi).",
      de: "Abzeichen decken alle 21 Regionen des Datensatzes ab (Slowenien und die angrenzenden Adriastaaten).",
      fr: "Les badges couvrent les 21 régions du jeu de données (la Slovénie et les pays adriatiques voisins).",
      es: "Las insignias cubren las 21 regiones del conjunto de datos (Eslovenia y los países adriáticos vecinos).",
    },
    statusTitle: { sl: "Stanje v tej rekonstrukciji", en: "Status in this reconstruction", it: "Stato in questa ricostruzione", de: "Status in dieser Rekonstruktion", fr: "Statut dans cette reconstruction", es: "Estado en esta reconstrucción" },
    statusBody: {
      sl: "To je zvesta rekonstrukcija predstavitvene strani pasa. Štetje točk in odklepanje značk (izvirna gamifikacija) se povezuje z načrtovalnikom v kasnejši fazi — kar danes vidiš, je resnična predstavitev, brez izmišljenih stanj.",
      en: "This is a faithful reconstruction of the pass presentation page. Point counting and badge unlocking (the original gamification) connect with the planner in a later phase — what you see today is the real presentation, without invented states.",
      it: "Questa è una fedele ricostruzione della pagina di presentazione del pass. Il conteggio dei punti e lo sblocco dei badge (la gamificazione originale) si collegano al pianificatore in una fase successiva — ciò che vedi oggi è la presentazione reale, senza stati inventati.",
      de: "Dies ist eine getreue Rekonstruktion der Pass-Vorstellungsseite. Punktezählung und Abzeichen-Freischaltung (die ursprüngliche Gamification) verbinden sich in einer späteren Phase mit dem Planer — was du heute siehst, ist die echte Präsentation, ohne erfundene Zustände.",
      fr: "Ceci est une reconstitution fidèle de la page de présentation du pass. Le comptage des points et le déblocage des badges (la gamification d'origine) se raccorderont au planificateur dans une phase ultérieure — ce que tu vois aujourd'hui est la vraie présentation, sans états inventés.",
      es: "Esta es una reconstrucción fiel de la página de presentación del pase. El conteo de puntos y el desbloqueo de insignias (la gamificación original) se conectarán con el planificador en una fase posterior — lo que ves hoy es la presentación real, sin estados inventados.",
    },
    ctaPlan: { sl: "Sestavi načrt in zberi točke", en: "Build a plan and earn points", it: "Crea un piano e guadagna punti", de: "Plane erstellen und Punkte sammeln", fr: "Créer un plan et gagner des points", es: "Crea un plan y gana puntos" },
    ctaDest: { sl: "Razišči regije", en: "Explore the regions", it: "Esplora le regioni", de: "Regionen erkunden", fr: "Explorer les régions", es: "Explora las regiones" },
    addTrip: { sl: "Dodaj pot v mojo pot", en: "Add the pass to my trip", it: "Aggiungi il pass al mio viaggio", de: "Pass zu meiner Reise hinzufügen", fr: "Ajouter le pass à mon voyage", es: "Añadir el pase a mi viaje" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓", it: "Nel mio viaggio ✓", de: "In meiner Reise ✓", fr: "Dans mon voyage ✓", es: "En mi viaje ✓" },
  } as const;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero — 1:1 produkcija */}
      <div className="text-center">
        <Badge className="mx-auto">
          <Ticket className="size-3" aria-hidden="true" />
          {pick(l, L.kicker)}
        </Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          {pick(l, L.title)}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {pick(l, L.lead)}
        </p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metaFree)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Trophy className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metaPoints)}
          </span>
        </p>
      </div>

      {/* Zbiraj doživetja — 1:1 produkcija */}
      <section
        aria-labelledby="pass-collect"
        className="mt-14 rounded-2xl bg-gradient-to-b from-muted/40 to-background p-6 text-center sm:p-10"
      >
        <h2 id="pass-collect" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {pick(l, L.collectTitle)}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          {pick(l, L.collectLead)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="tap-target font-semibold">
            <Link href="/nacrtuj">
              {pick(l, L.ctaPlan)}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <AddToTripButton
            refId="slovenia-pass"
            name="Slovenia Pass"
            kind="custom"
            source="slovenia-pass"
            labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
            size="default"
            variant="outline"
          />
        </div>
      </section>

      {/* Kako deluje */}
      <section aria-labelledby="pass-how" className="mt-14">
        <h2 id="pass-how" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.howTitle)}
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {pick(l, L.how).map((step, i) => (
            <li key={step.h}>
              <Card className="h-full rounded-2xl border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <CardContent className="p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-bold sm:text-base">{step.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.b}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Koristi */}
      <section aria-labelledby="pass-benefits" className="mt-14">
        <h2 id="pass-benefits" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.benefitsTitle)}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pick(l, L.benefits).map((b) => (
            <Card key={b.h}>
              <CardContent className="flex items-start gap-3 p-5">
                <Award className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold sm:text-base">{b.h}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.b}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Regije značk */}
      <section aria-labelledby="pass-regions" className="mt-14">
        <h2 id="pass-regions" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.regionsTitle)}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.regionsLead)}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {Object.entries(REGIONS).map(([key, r]) => (
            <li key={key}>
              <Badge variant="secondary" className="px-2.5 py-1">
                <MapPin className="size-3" aria-hidden="true" />
                {pick(l, r)}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {DATA_STATS.destinations} {pick(l, { sl: "destinacij", en: "destinations", it: "destinazioni", de: "Destinationen", fr: "destinations", es: "destinos" })} ·{" "}
          {DATA_STATS.regions} {pick(l, { sl: "regij", en: "regions", it: "regioni", de: "Regionen", fr: "régions", es: "regiones" })}
        </p>
      </section>

      {/* Iskreno stanje */}
      <Card className="mt-14 border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            {pick(l, L.statusTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          {pick(l, L.statusBody)}
          <div className="mt-4">
            <Button asChild variant="outline" size="sm" className="font-semibold">
              <Link href="/destinacije">
                {pick(l, L.ctaDest)}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
