/**
 * NEXT-STEP — DETERMINISTIČNI stanjski stroj proaktivnega pomočnika (issue #1/3).
 *
 * Glede na čisto stanje uporabnika (NextStepContext — zbrano IZKLJUČNO iz
 * obstoječih lokalnih shramb: dai:my-trip, dai:last-plan, dai:go-trip,
 * prijava + dai:shared-plans) predlaga en glavni + po možnosti en
 * sekundarni naslednji smiseln korak — pred potjo, pri načrtovanju,
 * pred/po rezervaciji in med potovanjem.
 *
 * Kanoni:
 * - 0 AI žetonov, 0 omrežja — SAMO pravila (isti vhod → isti izhod);
 * - ISKRENOST: `reason` se vedno navezuje na dejanski kontekst
 *   (nikoli izmišljenih stanj); pokvarjen/neznan vnos → null/0;
 * - SL/EN prek L vzorca ({ sl, en } + pick — fallback sl).
 */

import { pick, type PickDict } from "./i18n-pick";
import { slUnit } from "./sl-utils";

// ---------------------------------------------------------------------------
// Vhod / izhod (čisto stanje — testabilno)
// ---------------------------------------------------------------------------

/**
 * Čisto stanje uporabnika. Vsi vnosi so DEJANJA stanja lokalnih shramb:
 * - myTripCount: število zapisov v dai:my-trip (useMyTripList),
 * - hasCloudTrip: prijavljen IN z znamenjem shranjenih potovanj,
 * - hasPlan/planDays: dai:last-plan (uporabni načrt = ≥ 1 dan),
 * - reservationCount/confirmedCount: na trenutni poti (0, če neznano —
 *   rezervacije živijo strežniško; brez znanega shareId jih NE izmišljujemo),
 * - goModeActive: dai:go-trip obstaja in ni zaključen.
 */
export interface NextStepContext {
  myTripCount: number;
  hasCloudTrip: boolean;
  hasPlan: boolean;
  planDays: number;
  reservationCount: number;
  confirmedCount: number;
  goModeActive: boolean;
}

/** Ikona predloga — komponenta jo preslika v lucide-react ikono. */
export type NextStepIcon =
  | "compass"
  | "map"
  | "ticket"
  | "sun"
  | "route"
  | "party"
  | "share";

/** En predlog naslednjega koraka (lokaliziran ob klicu). */
export interface NextStepSuggestion {
  /** Stabilen identifikator stanja (npr. "go-resume", "build-plan"). */
  id: string;
  icon: NextStepIcon;
  title: string;
  body: string;
  ctaLabel: string;
  /** Notranja povezava (/destinacije, /nacrtuj, /trznica, /na-poti, /moja-potovanja). */
  ctaHref: string;
  /** ZAKAJ predlagam — prozoren razlog, navezan na dejanski kontekst. */
  reason: string;
  /** Višja = pomembnejša (7 = Go Mode aktiven … 1 = odpri potovanja). */
  priority: number;
}

/** Glavni predlog + po možnosti en sekundarni (nižja prioriteta). */
export interface NextStepOutcome {
  primary: NextStepSuggestion;
  secondary: NextStepSuggestion | null;
}

// ---------------------------------------------------------------------------
// Pravila (po prioriteti — prva številka specifikacije = višja prioriteta)
// ---------------------------------------------------------------------------

/** Razlog je lahko odvisen od konteksta (npr. število dni/destinacij). */
type ReasonFn = (ctx: NextStepContext) => string;

interface RuleDef {
  id: string;
  priority: number;
  icon: NextStepIcon;
  href: string;
  matches(ctx: NextStepContext): boolean;
  title: PickDict<string>;
  body: PickDict<string>;
  ctaLabel: PickDict<string>;
  reason: PickDict<ReasonFn>;
}

const RULES: readonly RuleDef[] = [
  // 1) goModeActive → nadaljuj pot (najpomembnejše — potovanje je živo)
  {
    id: "go-resume",
    priority: 7,
    icon: "route",
    href: "/na-poti",
    matches: (c) => c.goModeActive,
    title: { sl: "Nadaljuj svojo pot", en: "Continue your trip", it: "Continua il tuo viaggio", de: "Setze deine Reise fort", fr: "Continue ton voyage", es: "Continúa tu viaje" },
    body: {
      sl: "Tvoje potovanje je v teku — odpri Go Mode in nadaljuj pri naslednjem postanku.",
      en: "Your trip is underway — open Go Mode and continue at your next stop.",
      it: "Il tuo viaggio è in corso — apri Go Mode e continua alla prossima tappa.",
      de: "Deine Reise läuft — öffne den Go Mode und mach am nächsten Stopp weiter.",
      fr: "Ton voyage est en cours — ouvre le Go Mode et continue à ta prochaine étape.",
      es: "Tu viaje está en marcha — abre el Go Mode y continúa en tu próxima parada.",
    },
    ctaLabel: { sl: "Odpri Na poti", en: "Open On the road", it: "Apri In viaggio", de: "Unterwegs öffnen", fr: "Ouvrir En route", es: "Abrir En camino" },
    reason: {
      sl: () =>
        "Go Mode je aktiven (potovanje ni zaključeno) — nadaljevanje poti je zdaj najpomembnejši korak.",
      en: () =>
        "Go Mode is active (the trip is not finished) — continuing your trip is the most important step right now.",
      it: () =>
        "Go Mode è attivo (il viaggio non è finito) — continuare il viaggio è ora il passo più importante.",
      de: () =>
        "Go Mode ist aktiv (die Reise ist nicht abgeschlossen) — die Reise fortzusetzen ist jetzt der wichtigste Schritt.",
      fr: () =>
        "Le Go Mode est actif (le voyage n’est pas terminé) — continuer ton voyage est maintenant l’étape la plus importante.",
      es: () =>
        "El Go Mode está activo (el viaje no ha terminado) — continuar tu viaje es ahora el paso más importante.",
    },
  },
  // 2) načrt obstaja, nič rezervacij → rezerviraj vnaprej
  {
    id: "book-ahead",
    priority: 6,
    icon: "ticket",
    href: "/trznica",
    matches: (c) => c.hasPlan && c.planDays > 0 && c.reservationCount === 0,
    title: { sl: "Rezerviraj vnaprej", en: "Book ahead", it: "Prenota in anticipo", de: "Im Voraus buchen", fr: "Réserve à l’avance", es: "Reserva con antelación" },
    body: {
      sl: "Načrt imaš, rezervacij pa še ni — poglej izdelke in doživetja za svoje postanke.",
      en: "You have a plan but no reservations yet — browse products and experiences for your stops.",
      it: "Hai un piano ma ancora nessuna prenotazione — dai un’occhiata a prodotti ed esperienze per le tue tappe.",
      de: "Du hast einen Plan, aber noch keine Buchungen — stöbere in Produkten und Erlebnissen für deine Stopps.",
      fr: "Tu as un plan mais pas encore de réservations — parcours les produits et expériences pour tes étapes.",
      es: "Tienes un plan pero aún sin reservas — mira productos y experiencias para tus paradas.",
    },
    ctaLabel: { sl: "Odpri tržnico", en: "Open the marketplace", it: "Apri il mercato", de: "Marktplatz öffnen", fr: "Ouvrir le marché", es: "Abrir el mercado" },
    reason: {
      sl: (c) =>
        `Imaš shranjen ${c.planDays}-dnevni načrt, a še nič rezervacij — rezervacija vnaprej ti prihrani skrbi v zadnjem trenutku.`,
      en: (c) =>
        `You have a ${c.planDays}-day plan and no reservations yet — booking ahead spares you the last-minute scramble.`,
      it: (c) =>
        `Hai un piano di ${c.planDays} giorni e ancora nessuna prenotazione — prenotare in anticipo ti risparmia l’affanno dell’ultimo minuto.`,
      de: (c) =>
        `Du hast einen ${c.planDays}-Tage-Plan und noch keine Buchungen — im Voraus zu buchen erspart dir die Hektik im letzten Moment.`,
      fr: (c) =>
        `Tu as un plan de ${c.planDays} jours et aucune réservation — réserver à l’avance t’évite la course de dernière minute.`,
      es: (c) =>
        `Tienes un plan de ${c.planDays} días y ninguna reserva — reservar con antelación te ahorra el agobio de última hora.`,
    },
  },
  // 3) potrjene rezervacije → pripravi se na pot
  {
    id: "prepare-go",
    priority: 5,
    icon: "sun",
    href: "/na-poti",
    matches: (c) => c.hasPlan && c.confirmedCount > 0,
    title: { sl: "Pripravi se na pot", en: "Get ready to go", it: "Preparati a partire", de: "Mach dich reisefertig", fr: "Prépare-toi à partir", es: "Prepárate para salir" },
    body: {
      sl: "Imaš že potrjene rezervacije — odpri Go Mode za dnevni potek in vreme na naslednjem postanku.",
      en: "You already have confirmed reservations — open Go Mode for the day flow and the weather at your next stop.",
      it: "Hai già prenotazioni confermate — apri Go Mode per il flusso della giornata e il meteo alla prossima tappa.",
      de: "Du hast bereits bestätigte Buchungen — öffne den Go Mode für den Tagesablauf und das Wetter am nächsten Stopp.",
      fr: "Tu as déjà des réservations confirmées — ouvre le Go Mode pour le déroulé de la journée et la météo à ta prochaine étape.",
      es: "Ya tienes reservas confirmadas — abre el Go Mode para el ritmo del día y el tiempo en tu próxima parada.",
    },
    ctaLabel: { sl: "Pojdi na pot", en: "Head out", it: "Parti", de: "Los geht’s", fr: "Pars", es: "En marcha" },
    reason: {
      sl: (c) =>
        `Ker imaš ${c.confirmedCount} ${slUnit(
          c.confirmedCount,
          "potrjeno rezervacijo",
          "potrjeni rezervaciji",
          "potrjene rezervacije",
          "potrjenih rezervacij"
        )}, je čas za pripravo na odhod.`,
      en: (c) =>
        `You have ${c.confirmedCount} confirmed ${
          c.confirmedCount === 1 ? "reservation" : "reservations"
        } — time to get ready to go.`,
      it: (c) =>
        `Hai ${c.confirmedCount} ${
          c.confirmedCount === 1 ? "prenotazione confermata" : "prenotazioni confermate"
        } — è tempo di prepararsi alla partenza.`,
      de: (c) =>
        `Du hast ${c.confirmedCount} ${
          c.confirmedCount === 1 ? "bestätigte Buchung" : "bestätigte Buchungen"
        } — Zeit, dich auf die Abreise vorzubereiten.`,
      fr: (c) =>
        `Tu as ${c.confirmedCount} ${
          c.confirmedCount === 1 ? "réservation confirmée" : "réservations confirmées"
        } — il est temps de te préparer au départ.`,
      es: (c) =>
        `Tienes ${c.confirmedCount} ${
          c.confirmedCount === 1 ? "reserva confirmada" : "reservas confirmadas"
        } — es hora de prepararte para la salida.`,
    },
  },
  // 4) ≥ 2 destinaciji v zbirki, brez načrta → zgradi načrt
  {
    id: "build-plan",
    priority: 4,
    icon: "map",
    href: "/nacrtuj",
    matches: (c) => c.myTripCount >= 2 && !c.hasPlan,
    title: { sl: "Zgradi načrt iz zbirke", en: "Build a plan from your collection", it: "Costruisci un piano dalla raccolta", de: "Baue einen Plan aus deiner Sammlung", fr: "Construis un plan à partir de ta collection", es: "Crea un plan a partir de tu colección" },
    body: {
      sl: "Iz dodanih destinacij sestavi dnevni načrt — deterministično, brez ugibanj.",
      en: "Turn your saved destinations into a day-by-day plan — deterministic, no guesswork.",
      it: "Trasforma le destinazioni salvate in un piano giorno per giorno — deterministico, senza tirare a indovinare.",
      de: "Verwandle deine gespeicherten Reiseziele in einen Plan Tag für Tag — deterministisch, ohne Rätselraten.",
      fr: "Transforme tes destinations enregistrées en un plan jour par jour — déterministe, sans suppositions.",
      es: "Convierte tus destinos guardados en un plan día a día — determinista, sin conjeturas.",
    },
    ctaLabel: { sl: "Odpri načrtovalnik", en: "Open the planner", it: "Apri il pianificatore", de: "Planer öffnen", fr: "Ouvrir le planificateur", es: "Abrir el planificador" },
    reason: {
      sl: (c) =>
        `Ker imaš ${c.myTripCount} ${slUnit(
          c.myTripCount,
          "dodano destinacijo",
          "dodani destinaciji",
          "dodane destinacije",
          "dodanih destinacij"
        )}, a še brez načrta — načrtovalnik jih sešteje v dneve.`,
      en: (c) =>
        `You have ${c.myTripCount} saved ${
          c.myTripCount === 1 ? "destination" : "destinations"
        } but no plan yet — the planner turns the collection into days.`,
      it: (c) =>
        `Hai ${c.myTripCount} ${
          c.myTripCount === 1 ? "destinazione salvata" : "destinazioni salvate"
        } ma ancora nessun piano — il pianificatore le trasforma in giorni.`,
      de: (c) =>
        `Du hast ${c.myTripCount} ${
          c.myTripCount === 1 ? "gespeichertes Reiseziel" : "gespeicherte Reiseziele"
        }, aber noch keinen Plan — der Planer macht daraus Tage.`,
      fr: (c) =>
        `Tu as ${c.myTripCount} ${
          c.myTripCount === 1 ? "destination enregistrée" : "destinations enregistrées"
        } mais pas encore de plan — le planificateur les transforme en jours.`,
      es: (c) =>
        `Tienes ${c.myTripCount} ${
          c.myTripCount === 1 ? "destino guardado" : "destinos guardados"
        } pero aún sin plan — el planificador los convierte en días.`,
    },
  },
  // 5) točno ena destinacija → dodaj še eno
  {
    id: "add-another",
    priority: 3,
    icon: "compass",
    href: "/destinacije",
    matches: (c) => c.myTripCount === 1,
    title: { sl: "Dodaj še eno", en: "Add one more", it: "Aggiungine un’altra", de: "Füge noch eines hinzu", fr: "Ajoute-en une autre", es: "Añade otra" },
    body: {
      sl: "V Moji poti imaš eno destinacijo — z vsaj še eno se odpre pravi dnevni načrt.",
      en: "You have one destination in My trip — with at least one more, a real day plan opens up.",
      it: "Hai una destinazione in Il mio viaggio — con almeno un’altra si apre un vero piano giornaliero.",
      de: "Du hast ein Reiseziel in Meiner Reise — mit mindestens einem weiteren öffnet sich ein echter Tagesplan.",
      fr: "Tu as une destination dans Mon voyage — avec au moins une autre, un vrai plan de journée s’ouvre.",
      es: "Tienes un destino en Mi viaje — con al menos uno más se abre un verdadero plan diario.",
    },
    ctaLabel: { sl: "Razišči destinacije", en: "Explore destinations", it: "Scopri le destinazioni", de: "Reiseziele entdecken", fr: "Explorer les destinations", es: "Descubre destinos" },
    reason: {
      sl: () =>
        "V Moji poti imaš točno en postanek — z dvema ali več destinacijami načrtovalnik sestavi dnevni red.",
      en: () =>
        "You have exactly one stop in My trip — with two or more destinations the planner can build a day schedule.",
      it: () =>
        "Hai esattamente una tappa in Il mio viaggio — con due o più destinazioni il pianificatore costruisce un programma giornaliero.",
      de: () =>
        "Du hast genau einen Stopp in Meiner Reise — mit zwei oder mehr Reisezielen kann der Planer einen Tagesablauf bauen.",
      fr: () =>
        "Tu as exactement une étape dans Mon voyage — avec deux destinations ou plus, le planificateur peut construire un programme de journée.",
      es: () =>
        "Tienes exactamente una parada en Mi viaje — con dos o más destinos el planificador puede crear un horario diario.",
    },
  },
  // 6) prazna zbirka, brez oblaka → razišči Slovenijo (prvi korak)
  {
    id: "explore-first",
    priority: 2,
    icon: "compass",
    href: "/destinacije",
    matches: (c) => c.myTripCount === 0 && !c.hasCloudTrip,
    title: { sl: "Razišči Slovenijo", en: "Explore Slovenia", it: "Esplora la Slovenia", de: "Slowenien entdecken", fr: "Explore la Slovénie", es: "Explora Eslovenia" },
    body: {
      sl: "Prvi korak: prebrskaj kanonske destinacije in dodaj prvo v Mojo pot.",
      en: "First step: browse the canonical destinations and add your first to My trip.",
      it: "Primo passo: sfoglia le destinazioni canoniche e aggiungi la prima al mio viaggio.",
      de: "Erster Schritt: stöbere in den kanonischen Reisezielen und füge dein erstes zu Meiner Reise hinzu.",
      fr: "Première étape : parcours les destinations canoniques et ajoute la première à Mon voyage.",
      es: "Primer paso: explora los destinos canónicos y añade el primero a Mi viaje.",
    },
    ctaLabel: { sl: "Odpri destinacije", en: "Browse destinations", it: "Sfoglia le destinazioni", de: "Reiseziele durchstöbern", fr: "Parcourir les destinations", es: "Ver destinos" },
    reason: {
      sl: () =>
        "Zbirka je prazna in znanih shranjenih potovanj ni — raziskovanje je najbolj smiseln prvi korak.",
      en: () =>
        "Your collection is empty and there are no known saved trips — exploring is the most sensible first step.",
      it: () =>
        "La raccolta è vuota e non ci sono viaggi salvati noti — esplorare è il primo passo più sensato.",
      de: () =>
        "Deine Sammlung ist leer und es gibt keine bekannten gespeicherten Reisen — Entdecken ist der sinnvollste erste Schritt.",
      fr: () =>
        "Ta collection est vide et aucun voyage enregistré n’est connu — explorer est la première étape la plus sensée.",
      es: () =>
        "Tu colección está vacía y no hay viajes guardados conocidos — explorar es el primer paso más sensato.",
    },
  },
  // 7) prijavljen s potovanji, brez načrta → odpri svoje potovanje
  {
    id: "open-trips",
    priority: 1,
    icon: "share",
    href: "/moja-potovanja",
    matches: (c) => c.hasCloudTrip && !c.hasPlan,
    title: { sl: "Odpri svoje potovanje", en: "Open your trips", it: "Apri i tuoi viaggi", de: "Deine Reisen öffnen", fr: "Ouvre tes voyages", es: "Abre tus viajes" },
    body: {
      sl: "Prijavljen si in imaš shranjena potovanja — nadaljuj v vozlišču Moja potovanja.",
      en: "You are signed in with saved trips — continue in the My travels hub.",
      it: "Sei connesso e hai viaggi salvati — continua nell’hub I miei viaggi.",
      de: "Du bist angemeldet und hast gespeicherte Reisen — mach weiter im Hub Meine Reisen.",
      fr: "Tu es connecté et tu as des voyages enregistrés — continue dans le hub Mes voyages.",
      es: "Has iniciado sesión y tienes viajes guardados — continúa en el hub Mis viajes.",
    },
    ctaLabel: { sl: "Odpri Moja potovanja", en: "Open My travels", it: "Apri I miei viaggi", de: "Meine Reisen öffnen", fr: "Ouvrir Mes voyages", es: "Abrir Mis viajes" },
    reason: {
      sl: () =>
        "Ker imaš shranjena potovanja, lokalna zbirka pa je še brez načrta — tvoje potovanje čaka v vozlišču.",
      en: () =>
        "You have saved trips while the local collection has no plan yet — your journey awaits in the hub.",
      it: () =>
        "Hai viaggi salvati mentre la raccolta locale è ancora senza piano — il tuo viaggio ti aspetta nell’hub.",
      de: () =>
        "Du hast gespeicherte Reisen, während die lokale Sammlung noch ohne Plan ist — deine Reise wartet im Hub.",
      fr: () =>
        "Tu as des voyages enregistrés alors que la collection locale n’a pas encore de plan — ton voyage t’attend dans le hub.",
      es: () =>
        "Tienes viajes guardados mientras la colección local aún no tiene plan — tu viaje te espera en el hub.",
    },
  },
] as const;

/**
 * Izhodilni predlog (prioriteta 0): nobeno pravilo ne ustreza (redko —
 * npr. oblak + načrt + samo nepotrjene rezervacije). Iskrena
 * prozornost: pomočnik pove, da stanje ne kaže enoličnega koraka,
 * in ponudi vedno smiselno raziskovanje.
 */
const FALLBACK_RULE: RuleDef = {
  id: "explore-any",
  priority: 0,
  icon: "compass",
  href: "/destinacije",
  matches: () => true,
  title: { sl: "Razišči Slovenijo", en: "Explore Slovenia", it: "Esplora la Slovenia", de: "Slowenien entdecken", fr: "Explore la Slovénie", es: "Explora Eslovenia" },
  body: {
    sl: "Prebrskaj kanonske destinacije in dodaj prvo v Mojo pot.",
    en: "Browse the canonical destinations and add your first to My trip.",
    it: "Sfoglia le destinazioni canoniche e aggiungi la prima al mio viaggio.",
    de: "Stöbere in den kanonischen Reisezielen und füge dein erstes zu Meiner Reise hinzu.",
    fr: "Parcours les destinations canoniques et ajoute la première à Mon voyage.",
    es: "Explora los destinos canónicos y añade el primero a Mi viaje.",
  },
  ctaLabel: { sl: "Odpri destinacije", en: "Browse destinations", it: "Sfoglia le destinazioni", de: "Reiseziele durchstöbern", fr: "Parcourir les destinations", es: "Ver destinos" },
  reason: {
    sl: () =>
      "Iz trenutnega stanja ne morem enolično izpeljati naslednjega koraka — raziskovanje destinacij je vedno smiselno.",
    en: () =>
      "Your current state doesn't point to a single clear next step — exploring destinations is always worthwhile.",
    it: () =>
      "Dallo stato attuale non posso ricavare un unico passo successivo chiaro — esplorare le destinazioni vale sempre la pena.",
    de: () =>
      "Aus dem aktuellen Zustand lässt sich kein eindeutiger nächster Schritt ableiten — Reiseziele zu entdecken lohnt sich immer.",
    fr: () =>
      "Ton état actuel n’indique pas une seule étape suivante claire — explorer les destinations vaut toujours le coup.",
    es: () =>
      "De tu estado actual no se puede deducir un único paso siguiente claro — explorar destinos siempre merece la pena.",
  },
};

// ---------------------------------------------------------------------------
// Validacija konteksta (iskrenost: pokvarjeno stanje → null, ne izmišljeno)
// ---------------------------------------------------------------------------

/** Ali je vnos veljaven NextStepContext (vsa polja pravih tipov, ≥ 0)? */
export function isNextStepContext(value: unknown): value is NextStepContext {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  const count = (v: unknown): boolean =>
    typeof v === "number" && Number.isFinite(v) && (v as number) >= 0;
  return (
    count(c.myTripCount) &&
    count(c.planDays) &&
    count(c.reservationCount) &&
    count(c.confirmedCount) &&
    typeof c.hasCloudTrip === "boolean" &&
    typeof c.hasPlan === "boolean" &&
    typeof c.goModeActive === "boolean"
  );
}

// ---------------------------------------------------------------------------
// Jedro: pravila → predlogi
// ---------------------------------------------------------------------------

function suggestionFor(
  rule: RuleDef,
  ctx: NextStepContext,
  locale: string
): NextStepSuggestion {
  return {
    id: rule.id,
    icon: rule.icon,
    title: pick(locale, rule.title),
    body: pick(locale, rule.body),
    ctaLabel: pick(locale, rule.ctaLabel),
    ctaHref: rule.href,
    reason: pick(locale, rule.reason)(ctx),
    priority: rule.priority,
  };
}

/**
 * Glavni + sekundarni predlog za dano stanje.
 * VEDNO najvišja prioriteta ki ustreza; sekundarni = naslednja ujemajoča
 * (nižja prioriteta), če obstaja. Null SAMO ob manjkajočem/pokvarjenem
 * kontekstu (redko) — za vsak veljaven kontekst vedno najde izhod.
 */
export function nextStepsFor(
  ctx: NextStepContext | null | undefined,
  locale: string = "sl"
): NextStepOutcome | null {
  if (!isNextStepContext(ctx)) return null;

  const matched = RULES.filter((r) => r.matches(ctx));
  if (matched.length === 0) {
    return { primary: suggestionFor(FALLBACK_RULE, ctx, locale), secondary: null };
  }

  const [first, second] = matched;
  return {
    primary: suggestionFor(first, ctx, locale),
    secondary: second ? suggestionFor(second, ctx, locale) : null,
  };
}

/**
 * Samo glavni predlog (priročno za enostavne prikaze).
 * Locales: "en" → angleški vnosi, vsi ostali (sl/it/de/fr/es …) → slovenski
 * (pick fallback kanon — slovenščina je vedno resnica).
 */
export function nextStepFor(
  ctx: NextStepContext | null | undefined,
  locale: string = "sl"
): NextStepSuggestion | null {
  return nextStepsFor(ctx, locale)?.primary ?? null;
}
