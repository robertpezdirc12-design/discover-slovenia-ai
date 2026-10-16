"use client";

import {
  ArrowRight,
  BedDouble,
  Car,
  Check,
  Clock,
  Coins,
  Compass,
  ExternalLink,
  Flag,
  Fuel,
  MapPin,
  Plane,
  Plus,
  Star,
  Ticket,
  TrainFront,
  Wallet,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
import * as React from "react";

import { AffiliateChip } from "@/components/affiliate-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
// Rezervacijski sloj (v2.5.0) — ČISTI moduli brez env (varni za klienta):
// letališče po regiji (iskrena hevristika, vidna v UI) + črpalke (odprti
// podatki OSM, gorivo NI provizijska kategorija).
import {
  getProvider,
  nearestAirportForRegion,
} from "@/lib/affiliate-providers";
import { nearestFuelStation } from "@/lib/fuel-stations";
import { countryName } from "@/lib/countries-data";
import { pick } from "@/lib/i18n-pick";
import { myTrip } from "@/lib/my-trip";
import {
  type Destination,
  type Season,
  regionLabel,
  typeLabel,
} from "@/lib/slovenia-data";

const SEASONS: Record<Season, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
  spring: { sl: "Pomlad", en: "Spring", it: "Primavera", de: "Frühling", fr: "Printemps", es: "Primavera" },
  summer: { sl: "Poletje", en: "Summer", it: "Estate", de: "Sommer", fr: "Été", es: "Verano" },
  autumn: { sl: "Jesen", en: "Autumn", it: "Autunno", de: "Herbst", fr: "Automne", es: "Otoño" },
  winter: { sl: "Zima", en: "Winter", it: "Inverno", de: "Winter", fr: "Hiver", es: "Invierno" },
};

/**
 * PODROBNOST DESTINACIJE — hero slika, opis, žetoni (poudarki/aktivnosti/
 * najboljše za/sezona), praktični podatki, koordinate, IZVOR zapisa
 * (iskrenostni kanon) + akciji "Dodaj v mojo pot" in "Načrtuj / Pojdi".
 */
export function DestinationDetail({ d }: { d: Destination }) {
  const l = useLocale();
  const [inTrip, setInTrip] = React.useState(false);

  React.useEffect(() => {
    setInTrip(myTrip.has(d.slug));
    // Osveži, če drug zavihek spremeni zbirko.
    const refresh = () => setInTrip(myTrip.has(d.slug));
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [d.slug]);

  const L = {
    back: { sl: "Vse destinacije", en: "All destinations", it: "Tutte le destinazioni", de: "Alle Reiseziele", fr: "Toutes les destinations", es: "Todos los destinos" },
    metaCountry: { sl: "Država", en: "Country", it: "Paese", de: "Land", fr: "Pays", es: "País" },
    metaRegion: { sl: "Regija", en: "Region", it: "Regione", de: "Region", fr: "Région", es: "Región" },
    metaType: { sl: "Tip", en: "Type", it: "Tipo", de: "Typ", fr: "Type", es: "Tipo" },
    metaRating: { sl: "Ocena", en: "Rating", it: "Valutazione", de: "Bewertung", fr: "Note", es: "Valoración" },
    metaRatingAria: {
      sl: (n: number) => `Uredniška ocena ${n.toFixed(1)} od 5`,
      en: (n: number) => `Editorial rating ${n.toFixed(1)} of 5`,
      it: (n: number) => `Valutazione editoriale ${n.toFixed(1)} su 5`,
      de: (n: number) => `Redaktionelle Bewertung ${n.toFixed(1)} von 5`,
      fr: (n: number) => `Note éditoriale ${n.toFixed(1)} sur 5`,
      es: (n: number) => `Valoración editorial ${n.toFixed(1)} sobre 5`,
    },
    ratingNote: {
      sl: "Uredniška ocena, nikoli uporabniška recenzija.",
      en: "Editorial rating, never a user review.",
      it: "Valutazione editoriale, mai una recensione utente.",
      de: "Redaktionelle Bewertung, niemals eine Nutzerrezension.",
      fr: "Note éditoriale, jamais un avis d’utilisateur.",
      es: "Valoración editorial, nunca una reseña de usuarios.",
    },
    metaBudget: { sl: "Proračun", en: "Budget", it: "Budget", de: "Budget", fr: "Budget", es: "Presupuesto" },
    metaDuration: { sl: "Priporočen čas", en: "Recommended time", it: "Tempo consigliato", de: "Empfohlene Zeit", fr: "Durée recommandée", es: "Tiempo recomendado" },
    metaCost: { sl: "Strošek na osebo", en: "Cost per person", it: "Costo per persona", de: "Kosten pro Person", fr: "Coût par personne", es: "Coste por persona" },
    metaCostV: {
      sl: (n: number) => `≈ ${n} € (ocena)`,
      en: (n: number) => `≈ €${n} (estimate)`,
      it: (n: number) => `≈ ${n} € (stima)`,
      de: (n: number) => `≈ ${n} € (Schätzung)`,
      fr: (n: number) => `≈ ${n} € (estimation)`,
      es: (n: number) => `≈ ${n} € (estimación)`,
    },
    coords: { sl: "Koordinate (WGS-84)", en: "Coordinates (WGS-84)", it: "Coordinate (WGS-84)", de: "Koordinaten (WGS-84)", fr: "Coordonnées (WGS-84)", es: "Coordenadas (WGS-84)" },
    highlights: { sl: "Poudarki", en: "Highlights", it: "Punti di forza", de: "Highlights", fr: "Points forts", es: "Destacados" },
    activities: { sl: "Aktivnosti", en: "Activities", it: "Attività", de: "Aktivitäten", fr: "Activités", es: "Actividades" },
    bestFor: { sl: "Najboljše za", en: "Best for", it: "Ideale per", de: "Ideal für", fr: "Idéal pour", es: "Ideal para" },
    bestSeason: { sl: "Najboljši čas obiska", en: "Best season", it: "Stagione ideale", de: "Beste Reisezeit", fr: "Meilleure saison", es: "Mejor época" },
    provenance: { sl: "Izvor zapisa", en: "Record provenance", it: "Provenienza della scheda", de: "Herkunft des Eintrags", fr: "Provenance de la fiche", es: "Procedencia del registro" },
    provOfficial: { sl: "Uradni vir", en: "Official source", it: "Fonte ufficiale", de: "Offizielle Quelle", fr: "Source officielle", es: "Fuente oficial" },
    provEditorial: { sl: "Uredniška kuracija", en: "Editorial curation", it: "Curatela editoriale", de: "Redaktionelle Kuratierung", fr: "Curation éditoriale", es: "Curaduría editorial" },
    provVerified: {
      sl: (at: string) => `Preverjeno: ${at}`,
      en: (at: string) => `Verified: ${at}`,
      it: (at: string) => `Verificato: ${at}`,
      de: (at: string) => `Geprüft: ${at}`,
      fr: (at: string) => `Vérifié : ${at}`,
      es: (at: string) => `Verificado: ${at}`,
    },
    provSourceLink: { sl: "Odpri vir", en: "Open source", it: "Apri la fonte", de: "Quelle öffnen", fr: "Ouvrir la source", es: "Abrir la fuente" },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓", it: "Nel mio viaggio ✓", de: "In meiner Reise ✓", fr: "Dans mon voyage ✓", es: "En mi viaje ✓" },
    planWith: { sl: "Načrtuj s to destinacijo", en: "Plan with this destination", it: "Pianifica con questa destinazione", de: "Mit diesem Reiseziel planen", fr: "Planifier avec cette destination", es: "Planificar con este destino" },
    goWith: { sl: "Pojdi — partnerji", en: "Go — partners", it: "Vai — partner", de: "Los — Partner", fr: "Partir — partenaires", es: "Ir — socios" },
    showOnMap: { sl: "Pokaži na zemljevidu", en: "Show on map", it: "Mostra sulla mappa", de: "Auf der Karte zeigen", fr: "Afficher sur la carte", es: "Mostrar en el mapa" },
    myTrip: { sl: "Moja pot", en: "My trip", it: "Il mio viaggio", de: "Meine Reise", fr: "Mon voyage", es: "Mi viaje" },
    enNote: {
      sl: "",
      en: "Content note: the destination dataset is canonically Slovenian; an English content overlay is not yet available.",
      it: "Nota sui contenuti: il dataset delle destinazioni è in sloveno (lingua originale); una versione italiana non è ancora disponibile.",
      de: "Hinweis zu den Inhalten: der Datensatz der Reiseziele ist im Original slowenisch; eine deutsche Fassung ist noch nicht verfügbar.",
      fr: "Note de contenu : les données des destinations sont en slovène (langue d’origine) ; une version française n’est pas encore disponible.",
      es: "Nota de contenido: los datos de los destinos están en esloveno (idioma original); una versión en español aún no está disponible.",
    },
    // Rezervacijska kartica (v2.5.0) — DELNI slovar {sl, en} (kanon 48-b):
    // provizijsko razkritje je obvezno in vidno, partnerji pa iz čistega
    // registra (affiliate-providers) — nič hardkodiranih imen.
    bookTitle: { sl: "Načrtuj bivanje", en: "Book nearby", it: "Prenota in zona", de: "In der Nähe buchen", fr: "Réserver à proximité", es: "Reservar cerca" },
    bookLead: {
      sl: "Rezerviraj v okolici — povezave odprejo pri partnerjih.",
      en: "Book in the area — links open with our partners.",
      it: "Prenota nei dintorni — i link si aprono presso i nostri partner.",
      de: "Buche in der Umgebung — die Links öffnen sich bei unseren Partnern.",
      fr: "Réserve dans les environs — les liens s’ouvrent chez nos partenaires.",
      es: "Reserva en la zona — los enlaces se abren con nuestros socios.",
    },
    bookStays: { sl: "Nastanitve", en: "Stays", it: "Pernottamenti", de: "Unterkünfte", fr: "Hébergements", es: "Alojamientos" },
    bookExperiences: { sl: "Doživetja", en: "Experiences", it: "Esperienze", de: "Erlebnisse", fr: "Expériences", es: "Experiencias" },
    bookFlights: { sl: "Letalske karte", en: "Flights", it: "Voli", de: "Flüge", fr: "Vols", es: "Vuelos" },
    bookCar: { sl: "Rent-a-car", en: "Car rental", it: "Autonoleggio", de: "Mietwagen", fr: "Location de voiture", es: "Alquiler de coches" },
    bookTransfers: {
      sl: "Prevozi (vlaki/avtobusi)",
      en: "Transfers (trains/buses)",
      it: "Trasferimenti (treni/autobus)",
      de: "Transfers (Züge/Busse)",
      fr: "Transferts (trains/bus)",
      es: "Traslados (trenes/autobuses)",
    },
    bookOpenAt: {
      sl: (name: string) => `Odpri pri ${name}`,
      en: (name: string) => `Open at ${name}`,
      it: (name: string) => `Apri su ${name}`,
      de: (name: string) => `Bei ${name} öffnen`,
      fr: (name: string) => `Ouvrir sur ${name}`,
      es: (name: string) => `Abrir en ${name}`,
    },
    bookFlyTo: {
      sl: (name: string) => `Leti do ${name}`,
      en: (name: string) => `Fly to ${name}`,
      it: (name: string) => `Vola a ${name}`,
      de: (name: string) => `Nach ${name} fliegen`,
      fr: (name: string) => `Voler vers ${name}`,
      es: (name: string) => `Volar a ${name}`,
    },
    fuelNearby: {
      sl: "Najbližja bencinska črpalka",
      en: "Nearest fuel station",
      it: "Benzinaio più vicino",
      de: "Nächstgelegene Tankstelle",
      fr: "Station-service la plus proche",
      es: "Gasolinera más cercana",
    },
    fuelStraight: { sl: "naravnost", en: "as the crow flies", it: "in linea d’aria", de: "Luftlinie", fr: "à vol d’oiseau", es: "en línea recta" },
    fuelNote: {
      sl: "Približna lega (odprti podatki); razdalja naravnost, ne po cesti.",
      en: "Approximate location (open data); straight-line distance, not by road.",
      it: "Posizione approssimativa (dati aperti); distanza in linea d’aria, non per strada.",
      de: "Ungefähre Lage (offene Daten); Entfernung in Luftlinie, nicht auf der Straße.",
      fr: "Position approximative (données ouvertes) ; distance à vol d’oiseau, pas par la route.",
      es: "Ubicación aproximada (datos abiertos); distancia en línea recta, no por carretera.",
    },
    bookDisclosure: {
      sl: "Ko rezerviraš prek povezav naših partnerjev, partner nama izplača provizijo — cena zate ostaja enaka.",
      en: "When you book through our partner links, the partner pays us a commission — your price stays the same.",
      it: "Quando prenoti tramite i link dei nostri partner, il partner ci paga una commissione — il tuo prezzo resta invariato.",
      de: "Wenn du über unsere Partnerlinks buchst, zahlt der Partner uns eine Provision — dein Preis bleibt gleich.",
      fr: "Quand tu réserves via les liens de nos partenaires, le partenaire nous verse une commission — ton prix reste le même.",
      es: "Cuando reservas a través de los enlaces de nuestros socios, el socio nos paga una comisión — tu precio no cambia.",
    },
  } as const;

  const meta = [
    { key: "country", Icon: Flag, label: pick(l, L.metaCountry), value: countryName(l, d.country) },
    { key: "region", Icon: MapPin, label: pick(l, L.metaRegion), value: regionLabel(d.region, l) },
    { key: "type", Icon: Compass, label: pick(l, L.metaType), value: typeLabel(d.type, l) },
    { key: "duration", Icon: Clock, label: pick(l, L.metaDuration), value: d.duration },
    { key: "budget", Icon: Wallet, label: pick(l, L.metaBudget), value: d.budget },
    { key: "cost", Icon: Coins, label: pick(l, L.metaCost), value: pick(l, L.metaCostV)(d.costPerPerson) },
  ];

  const chipGroups = [
    { heading: pick(l, L.highlights), items: d.highlights },
    { heading: pick(l, L.activities), items: d.activities },
    { heading: pick(l, L.bestFor), items: d.bestFor },
    {
      heading: pick(l, L.bestSeason),
      items: d.bestSeason.map((s) => pick(l, SEASONS[s])),
    },
  ];

  // Rezervacijske vrstice: dest je VEDNO ta destinacija (slug), letališče pa
  // hevristika po regiji (natančna geolokacija ni na voljo — je vidna v UI).
  // Gorivo SAMO za slovenske destinacije (nabor črpalk pokriva SI).
  const airport = nearestAirportForRegion(d.region);
  const fuel =
    d.country === "SI"
      ? nearestFuelStation(d.coords.lat, d.coords.lng)
      : null;
  const bookingRows = [
    { id: "booking", icon: BedDouble, label: pick(l, L.bookStays) },
    { id: "getyourguide", icon: Ticket, label: pick(l, L.bookExperiences) },
    { id: "kiwi", icon: Plane, label: pick(l, L.bookFlights) },
    { id: "rentalcars", icon: Car, label: pick(l, L.bookCar) },
    { id: "omio", icon: TrainFront, label: pick(l, L.bookTransfers) },
  ] as const;

  const onAdd = () => {
    const res = myTrip.add(d.slug, d.name, "destination", "destinacija");
    if (res.ok || res.already) {
      setInTrip(true);
    }
  };

  return (
    <article className="w-full">
      {/* Hero slika — POLIR12 (2.39.0): zgornja meja v svh enotah (prej
          enota velikega viewporta) — svh = delež najmanjšega stabilnega
          viewporta: pri VIDNI naslovni vrstici (iOS Safari / Chrome
          Android) hero ne zajema več površine pod vrstico; dvh zavrnjen
          (WebKit #266835 — jank na tokovnih blokih); v brezglavem
          brskalniku svh ≡ vh. Tudi odzivna minimalna višina ostane znotraj 54svh. */}
      <div className="relative min-h-[min(320px,54svh)] max-h-[54svh] w-full overflow-hidden bg-muted sm:min-h-[min(380px,54svh)] lg:min-h-[min(440px,54svh)]">
        <Image
          src={d.image}
          alt={`${d.name} — ${d.tagline}`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto w-full max-w-5xl px-4 pb-5 sm:px-6 lg:px-8">
            <Link
              href="/destinacije"
              className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white"
            >
              <ArrowRight className="size-4 rotate-180" aria-hidden="true" />
              {pick(l, L.back)}
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-4xl">
              {d.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/90 sm:text-base">
              {d.tagline}
            </p>
          </div>
        </div>
        {d.featured && (
          <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground shadow">
            {pick(l, { sl: "Izpostavljeno", en: "Featured", it: "In evidenza", de: "Empfohlen", fr: "À la une", es: "Destacado" })}
          </Badge>
        )}
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {l !== "sl" && pick(l, L.enNote) && (
          <p className="mb-6 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {pick(l, L.enNote)}
          </p>
        )}

        {/* Akcija: Dodaj v mojo pot */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={onAdd}
            size="lg"
            variant={inTrip ? "outline" : "default"}
            className="tap-target font-semibold"
          >
            {inTrip ? (
              <>
                <Check className="size-5" aria-hidden="true" />
                {pick(l, L.added)}
              </>
            ) : (
              <>
                <Plus className="size-5" aria-hidden="true" />
                {pick(l, L.addTrip)}
              </>
            )}
          </Button>
          <Button asChild size="lg" variant="outline" className="tap-target font-semibold">
            <Link href={`/nacrtuj?dest=${d.slug}`}>{pick(l, L.planWith)}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="tap-target font-semibold">
            <Link href={`/zemljevid?q=${encodeURIComponent(d.name)}&country=${d.country}&region=${encodeURIComponent(d.region)}`}>
              <MapPin className="size-4" aria-hidden="true" />
              {pick(l, L.showOnMap)}
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="tap-target font-semibold">
            <Link href={`/go?dest=${d.slug}`}>{pick(l, L.goWith)}</Link>
          </Button>
        </div>

        {/* Praktični podatki */}
        <Card className="mt-8 overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
          <CardContent className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <div className="flex items-center gap-2.5">
              <Star className="size-5 shrink-0 fill-primary text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {pick(l, L.metaRating)}
                </p>
                <p className="text-sm font-bold">
                  {d.rating.toFixed(1)} / 5
                  <span className="sr-only">{pick(l, L.metaRatingAria)(d.rating)}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{pick(l, L.ratingNote)}</p>
              </div>
            </div>
            {meta.map((m) => (
              <div key={m.key} className="flex min-w-0 items-center gap-2.5">
                <m.Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                  <p className="break-words text-sm font-bold">{m.value}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2.5">
              <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">{pick(l, L.coords)}</p>
                <p className="font-mono text-sm font-bold">
                  {d.coords.lat.toFixed(4)}, {d.coords.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Načrtuj bivanje — kontekstualne rezervacije pri partnerjih.
            Iskrenost: dest je ta destinacija; letalska vrstica pokaže
            letališče po regiji; gorivo (samo SI) je odprt podatek brez
            partnerja in brez provizije. */}
        <Card className="mt-8 rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {pick(l, L.bookTitle)}
            </CardTitle>
            <CardDescription>{pick(l, L.bookLead)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {bookingRows.map((row) => {
                // Register je edina resnica — neznan id se ne izriše.
                const p = getProvider(row.id);
                if (!p) return null;
                const cta =
                  row.id === "kiwi"
                    ? pick(l, L.bookFlyTo)(airport.nameSl)
                    : pick(l, L.bookOpenAt)(p.name);
                const Icon = row.icon;
                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {row.label}
                        </p>
                        <p className="truncate text-sm font-bold">{p.name}</p>
                      </div>
                    </div>
                    {/* POLIR8 (2.35.0): shrink-0 je preprečeval skrčenje vrstice,
                        nowrap gumb „Leti do …“ (510 px) je raznesel stran pri
                        390 px (161 px preliva) — min-w-0 dovoli skrčenje,
                        whitespace-normal h-auto preglane nowrap/h-8 osnovo
                        (tailwind-merge), min-h-8 ohrani minimalno višino.
                        EMPIRIČNO (@390): gumbu je treba pripeti tudi shrink
                        (preglase shrink-0 iz Button osnove — sicer flex-wrap
                        vrstica gumb (369 px) samodejno ne skrči). */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="font-semibold whitespace-normal h-auto min-h-8 shrink"
                      >
                        {/* Vodeni klik skozi lastni API (zapis klika + 302);
                            rel="sponsored" je obvezen za provizijske povezave. */}
                        <a
                          href={`/api/affiliate/go?provider=${row.id}&dest=${d.slug}`}
                          target="_blank"
                          rel="nofollow sponsored noopener"
                        >
                          {cta}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                      {/* POLIR B (FTC): razkritje OB povezavi — čip vodi na
                          /zaupanje-in-varnost (celotna objava o proviziji). */}
                      <AffiliateChip />
                    </div>
                  </div>
                );
              })}
              {fuel && (
                <div className="flex items-center gap-2.5">
                  <Fuel
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {pick(l, L.fuelNearby)}
                    </p>
                    <p className="text-sm font-bold">
                      {fuel.station.name} — ~{fuel.km.toFixed(1)} km (
                      {pick(l, L.fuelStraight)})
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {pick(l, L.fuelNote)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {pick(l, L.bookDisclosure)}
            </p>
          </CardContent>
        </Card>

        {/* Opis */}
        <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
          <p className="text-base leading-relaxed sm:text-lg">{d.description}</p>
        </div>

        {/* Žetoni: poudarki / aktivnosti / najboljše za / sezona */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {chipGroups.map((g) => (
            <Card key={g.heading} className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.heading}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {g.items.map((item) => (
                  <Badge
                    key={item}
                    variant="secondary"
                    className="px-2.5 py-1 text-xs font-medium"
                  >
                    {item}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        {/* Izvor zapisa (iskrenostni kanon) */}
        <Card className="rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-primary">
              {pick(l, L.provenance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-medium">
              {d.provenance.kind === "official"
                ? pick(l, L.provOfficial)
                : pick(l, L.provEditorial)}
              {" — "}
              {d.provenance.source}
            </p>
            <p className="text-muted-foreground">
              {pick(l, L.provVerified)(d.provenance.verifiedAt)}
            </p>
            {d.provenance.sourceUrl && (
              <a
                href={d.provenance.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {pick(l, L.provSourceLink)}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
