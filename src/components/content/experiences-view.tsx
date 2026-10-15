"use client";

import { ArrowRight, Compass, MapPin, ShieldCheck, Store } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { EXPERIENCE_TYPES } from "@/lib/content-data";
import { getDestination } from "@/lib/slovenia-data";

/**
 * /dozivetja — 6 tipov doživetij 1:1 iz produkcije (mirror /dozivetja)
 * + povezave na kanonske destinacije posameznega tipa. Tržnica ponudi
 * žive izkušnje lokalnih ponudnikov (faza 45-c) — iskreno označeno.
 */
export function ExperiencesView() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Doživetja", en: "Experiences", it: "Esperienze", de: "Erlebnisse", fr: "Expériences", es: "Experiencias" },
    title: { sl: "Doživetja v Sloveniji", en: "Experiences in Slovenia", it: "Esperienze in Slovenia", de: "Erlebnisse in Slowenien", fr: "Expériences en Slovénie", es: "Experiencias en Eslovenia" },
    lead: {
      sl: "Pohodništvo, vodne avanture, kultura in kulinarika — raziščite in rezervirajte doživetja neposredno pri preverjenih lokalnih ponudnikih.",
      en: "Hiking, water adventures, culture and gastronomy — explore and book experiences directly with verified local providers.",
      it: "Escursioni, avventure acquatiche, cultura e gastronomia — esplora e prenota esperienze direttamente con fornitori locali verificati.",
      de: "Wandern, Wasserabenteuer, Kultur und Gastronomie — entdecke und buche Erlebnisse direkt bei geprüften lokalen Anbietern.",
      fr: "Randonnée, aventures nautiques, culture et gastronomie — explore et réserve des expériences directement auprès de prestataires locaux vérifiés.",
      es: "Senderismo, aventuras acuáticas, cultura y gastronomía — explora y reserva experiencias directamente con proveedores locales verificados.",
    },
    metaNote: {
      sl: "Preverjeni lokalni ponudniki · Rezervacija brez posrednika",
      en: "Verified local providers · Booking without a middleman",
      it: "Fornitori locali verificati · Prenotazione senza intermediari",
      de: "Geprüfte lokale Anbieter · Buchung ohne Zwischenhändler",
      fr: "Prestataires locaux vérifiés · Réservation sans intermédiaire",
      es: "Proveedores locales verificados · Reserva sin intermediarios",
    },
    typesTitle: {
      sl: "Neskončne možnosti doživetij",
      en: "Endless possibilities of experiences",
      it: "Infinite possibilità di esperienze",
      de: "Unendliche Möglichkeiten für Erlebnisse",
      fr: "Infinies possibilités d’expériences",
      es: "Infinitas posibilidades de experiencias",
    },
    typesLead: {
      sl: "Slovenija ponuja vse od alpskih vrhov do jadranske obale — na površini manjši od Walesa.",
      en: "Slovenia offers everything from alpine peaks to the Adriatic coast — on an area smaller than Wales.",
      it: "La Slovenia offre di tutto, dalle vette alpine alla costa adriatica — su una superficie più piccola del Galles.",
      de: "Slowenien bietet alles, von Alpengipfeln bis zur Adriaküste — auf einer Fläche kleiner als Wales.",
      fr: "La Slovénie offre tout, des sommets alpins à la côte adriatique — sur une superficie plus petite que le pays de Galles.",
      es: "Eslovenia lo ofrece todo, de las cumbres alpinas a la costa del Adriático — en una superficie más pequeña que Gales.",
    },
    destsTitle: { sl: "Kje ga doživeti", en: "Where to experience it", it: "Dove viverlo", de: "Wo du es erlebst", fr: "Où le vivre", es: "Dónde vivirlo" },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓", it: "Nel mio viaggio ✓", de: "In meiner Reise ✓", fr: "Dans mon voyage ✓", es: "En mi viaje ✓" },
    marketTitle: { sl: "Tržnica Slovenije", en: "Slovenian Marketplace", it: "Mercato sloveno", de: "Slowenischer Marktplatz", fr: "Marché slovène", es: "Mercado esloveno" },
    marketLead: {
      sl: "Lokalni izdelki in izkušnje — direktno od kmetov, vinogradnikov in vodnikov",
      en: "Local products and experiences — directly from farmers, winemakers and guides",
      it: "Prodotti ed esperienze locali — direttamente da agricoltori, viticoltori e guide",
      de: "Lokale Produkte und Erlebnisse — direkt von Bauern, Winzern und Guides",
      fr: "Produits et expériences locaux — directement d’agriculteurs, de vignerons et de guides",
      es: "Productos y experiencias locales — directamente de agricultores, viticultores y guías",
    },
    marketBody: {
      sl: "Žive ponudbe izkušenj tržnice (rezervacije pri lokalnih ponudnikih) se povezujejo v fazi rekonstrukcije tržnice — do takrat raziščite destinacije in dogodke.",
      en: "Live marketplace experience offers (bookings with local providers) connect in the marketplace reconstruction phase — until then, explore destinations and events.",
      it: "Le offerte di esperienze dal vivo del mercato (prenotazioni con fornitori locali) si collegheranno nella fase di ricostruzione del mercato — nel frattempo esplora destinazioni ed eventi.",
      de: "Live-Erlebnisangebote des Marktplatzes (Buchungen bei lokalen Anbietern) werden in der Rekonstruktionsphase des Marktplatzes angebunden — erkunde bis dahin Destinationen und Veranstaltungen.",
      fr: "Les offres d’expériences en direct du marché (réservations auprès de prestataires locaux) se connecteront lors de la phase de reconstruction du marché — en attendant, explore les destinations et les événements.",
      es: "Las ofertas de experiencias en vivo del mercado (reservas con proveedores locales) se conectarán en la fase de reconstrucción del mercado — mientras tanto, explora destinos y eventos.",
    },
    marketCta: { sl: "Odpri tržnico", en: "Open the marketplace", it: "Apri il mercato", de: "Marktplatz öffnen", fr: "Ouvrir le marché", es: "Abrir el mercado" },
    enNote: {
      sl: "",
      en: "Content note: experience descriptions are canonically Slovenian (production source); an English content overlay is not yet available.",
      it: "Nota sui contenuti: le descrizioni delle esperienze sono canonicamente in sloveno (fonte di produzione); un overlay dei contenuti in inglese non è ancora disponibile.",
      de: "Inhaltshinweis: Erlebnisbeschreibungen sind kanonisch slowenisch (Produktionsquelle); ein englischer Inhalts-Overlay ist noch nicht verfügbar.",
      fr: "Note de contenu : les descriptions des expériences sont canoniquement en slovène (source de production) ; une surcouche de contenu en anglais n’est pas encore disponible.",
      es: "Nota de contenido: las descripciones de las experiencias son canónicamente en esloveno (fuente de producción); una superposición de contenido en inglés aún no está disponible.",
    },
  } as const;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)}>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metaNote)}
          </span>
        </p>
      </PageHeader>

      {l !== "sl" && pick(l, L.enNote) && (
        <p className="mt-6 rounded-xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.06] to-card px-4 py-3 text-xs text-muted-foreground">
          {pick(l, L.enNote)}
        </p>
      )}

      <section aria-labelledby="exp-types" className="mt-10">
        <h2 id="exp-types" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.typesTitle)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {pick(l, L.typesLead)}
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPERIENCE_TYPES.map((type) => {
            const dests = type.destSlugs
              .map((slug) => getDestination(slug))
              .filter((d): d is NonNullable<typeof d> => Boolean(d));
            return (
              <li key={type.id}>
                <Card className="group h-full gap-0 overflow-hidden rounded-2xl border-border/70 py-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                  {/* Mozaik slik povezanih destinacij (prve 3) */}
                  <div className="grid h-28 grid-cols-3 gap-0.5 bg-muted">
                    {dests.slice(0, 3).map((d, i) => (
                      <div key={d.slug} className="relative overflow-hidden">
                        <Image
                          src={d.image}
                          alt=""
                          fill
                          loading="lazy"
                          sizes="120px"
                          aria-hidden={i > 0}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                    <h3 className="flex items-center gap-2 text-base font-bold leading-snug">
                      <Compass className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {pick(l, type.title)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {type.description}
                    </p>
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {pick(l, L.destsTitle)}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {dests.map((d) => (
                          <li key={d.slug}>
                            <Badge variant="secondary" asChild>
                              <Link
                                href={`/destinacija/${d.slug}`}
                                className="hover:bg-primary/10 focus-green"
                              >
                                <MapPin className="size-3" aria-hidden="true" />
                                {d.name}
                              </Link>
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-auto pt-1">
                      <AddToTripButton
                        refId={`dozivetje/${type.id}`}
                        name={pick(l, type.title)}
                        kind="experience"
                        source="dozivetja"
                        labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
                        variant="ghost"
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Tržnica — preusmeritev (produkcija: Nalagam izkušnje … iz tržnice) */}
      <section
        aria-labelledby="exp-market"
        className="mt-14 rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.08] via-card to-primary/[0.03] p-6 shadow-sm sm:p-10"
      >
        <h2 id="exp-market" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Store className="size-5 text-primary" aria-hidden="true" />
          {pick(l, L.marketTitle)}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {pick(l, L.marketLead)}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {pick(l, L.marketBody)}
        </p>
        <div className="mt-6">
          <Link
            href="/trznica"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-green"
          >
            {pick(l, L.marketCta)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
