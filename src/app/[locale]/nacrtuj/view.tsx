"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  FileDown,
  FileUp,
  Footprints,
  GripVertical,
  Info,
  Link2,
  Loader2,
  Plus,
  Printer,
  Route as RouteIcon,
  Save,
  Scale,
  Search,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
// POLIR2 A (2.29.0): povleci-in-spusti urejanje dni — dnd-kit je bil v
// package.json ŽE nameščen (0 novih odvisnosti); v src/ ga prvič uporabljamo.
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PlanEditPanel } from "@/components/plan/plan-edit-panel";
import { DaySegmentHeader } from "@/components/day-segment-header";
import { NextStepCard, useNextStepContext } from "@/components/next-step-card";
import { StopKindIcon } from "@/components/plan/plan-bits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { asPickLocale, pick } from "@/lib/i18n-pick";
import {
  buildItinerary,
  budgetTier,
  formatDuration,
  formatMoney,
  interestChips,
  roadKm,
  round5,
  travelMinutes,
  type PlannerLang,
} from "@/lib/itinerary-engine";
import { myTrip } from "@/lib/my-trip";
// POLIR4 A (2.31.0): UVOZ KML/GPX — klientanski deterministični parser +
// ujemanje po kanonu DEST_NEEDLES/bližina (0 omrežja: datoteka NE zapusti
// brskalnika). Rezultat vstopi v ISTI tok Start Anywhere.
import {
  deriveImportSuggestion,
  matchImportPlacemarks,
  parseImportFile,
} from "@/lib/plan-import";
import { interestDisplay } from "@/lib/interests-i18n";
// POLIR2 A (2.29.0): čiste transformacije za ročno preurejanje dni.
import {
  isSameOrder,
  moveStop,
  recomputeDayTimes,
  recomputeDayTitle,
} from "@/lib/plan-reorder";
import { saveLastPlan } from "@/lib/plan-store";
// POLIR5 A (2.32.0): čista izpeljava IZMERJENIH dni (OSRM) za povzetek
// načrta — tip MeasuredDay + summarizeMeasured (0 omrežja, testabilna v bun;
// ista datoteka že nosi čisto logiko črt planMapLines za zemljevid).
// POLIR6 A (2.33.0): dayEstimate + fmtKm1 sta se prestavili sem — EN izvor
// resnice za izmerjene/ocenjene vrstice VSEH pogledov poti.
import {
  dayEstimate,
  fmtKm1,
  summarizeMeasured,
  type MeasuredDay,
} from "@/lib/plan-map-data";
import { buildTripPdf, fromItineraryPlan } from "@/lib/pdf/trip-pdf-doc";
import { downloadTripPdf } from "@/lib/pdf/trip-pdf-render";
import { buildDaySegments } from "@/lib/day-segments";
import {
  DESTINATIONS,
  normalizeInterests,
  REGIONS,
  regionLabel,
  typeLabel,
} from "@/lib/slovenia-data";
import type { Budget, Season } from "@/lib/slovenia-data";
// F5 (#41): državni filter + čezmejni blok (dokumenti/prehodi).
import { ALL_COUNTRY_CODES, COUNTRIES } from "@/lib/countries-data";
import {
  borderDocBlock,
  EU_DOCS_SOURCE_URL,
  SCHENGEN_SOURCE_URL,
} from "@/lib/border-docs";
import type { ItineraryPlan, TripStop } from "@/lib/types";

// POLIR2 B (2.29.0): ZEMLJEVID NAČRTA — klientanski dinamični uvoz
// (Leaflet dostopa do window že ob uvozu modula → ssr: false je
// OBVEZEN; Skeleton prepreči layout shift med nalaganjem). Imenovani
// export PlanMap iz @/components/plan/plan-map.
const PlanMap = dynamic(
  () => import("@/components/plan/plan-map").then((m) => m.PlanMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-xl sm:h-80" />,
  }
);

/**
 * /nacrtuj — DETERMINISTIČNI načrtovalnik (faza 45-d).
 *
 * Obrazec (interesni čipi iz activities ∪ bestFor, dnevi 1–5, regija,
 * sezona, proračun) → POST /api/itinerary → prikaz načrta s časovnico,
 * skupno ceno in izhodi: Shrani v Moja pot / Zaženi na poti / Natisni.
 * Isti vhod vedno da isti načrt (0 AI žetonov).
 */

const POPULAR_CHIPS = 24;

// ---------------------------------------------------------------------------
// Oznake (L vzorec — kanon izvirnika)
// ---------------------------------------------------------------------------

const L = {
  kicker: { sl: "Načrtuj", en: "Plan", it: "Pianifica", de: "Planen", fr: "Planifier", es: "Planifica" },
  title: { sl: "Načrtuj svojo pot po Sloveniji", en: "Plan your journey across Slovenia", it: "Pianifica il tuo viaggio in Slovenia", de: "Plane deine Reise durch Slowenien", fr: "Planifie ton voyage en Slovénie", es: "Planifica tu viaje por Eslovenia" },
  lead: {
    sl: "Izberi želje — deterministični motor sestavi dnevni načrt iz kanonskih podatkov 74 destinacij. Isti vhod vedno da isti načrt (0 AI žetonov, 0 presenečenj).",
    en: "Pick your wishes — the deterministic engine builds a day plan from the canonical data of 74 destinations. The same input always yields the same plan (0 AI tokens, 0 surprises).",
    it: "Scegli i tuoi desideri — il motore deterministico costruisce un piano giornaliero dai dati canonici di 74 destinazioni. Lo stesso input dà sempre lo stesso piano (0 token AI, 0 sorprese).",
    de: "Wähle deine Wünsche — die deterministische Engine erstellt aus den kanonischen Daten von 74 Reisezielen einen Tagesplan. Gleiche Eingabe ergibt immer denselben Plan (0 KI-Tokens, 0 Überraschungen).",
    fr: "Choisis tes envies — le moteur déterministe construit un plan quotidien à partir des données canoniques de 74 destinations. La même entrée donne toujours le même plan (0 jeton d’IA, 0 surprise).",
    es: "Elige tus deseos — el motor determinista construye un plan diario con los datos canónicos de 74 destinos. La misma entrada da siempre el mismo plan (0 fichas de IA, 0 sorpresas).",
  },
  formTitle: { sl: "Kaj želiš doživeti?", en: "What do you want to experience?", it: "Cosa vuoi vivere?", de: "Was möchtest du erleben?", fr: "Que veux-tu vivre ?", es: "¿Qué quieres vivir?" },
  formLead: {
    sl: "Izberi interese (čipi iz dejanskih podatkov destinacij) ali napiši svoje — nato sestavi načrt.",
    en: "Pick interests (chips from actual destination data) or write your own — then build the plan.",
    it: "Scegli gli interessi (chip dai dati reali delle destinazioni) o scrivi i tuoi — poi crea il piano.",
    de: "Wähle Interessen (Chips aus echten Reisezieldaten) oder schreibe eigene — dann erstelle den Plan.",
    fr: "Choisis des centres d’intérêt (puces issues des données réelles des destinations) ou écris les tiens — puis compose le plan.",
    es: "Elige intereses (fichas con datos reales de los destinos) o escribe los tuyos — y luego crea el plan.",
  },
  interestsLabel: { sl: "Interesi", en: "Interests", it: "Interessi", de: "Interessen", fr: "Centres d’intérêt", es: "Intereses" },
  customLabel: {
    sl: "Ali napiši svoje želje (loči z vejico)",
    en: "Or write your own wishes (comma-separated)",
    it: "Oppure scrivi i tuoi desideri (separati da virgola)",
    de: "Oder schreibe eigene Wünsche (durch Komma getrennt)",
    fr: "Ou écris tes propres envies (séparées par des virgules)",
    es: "O escribe tus propios deseos (separados por comas)",
  },
  customAdd: { sl: "Dodaj", en: "Add", it: "Aggiungi", de: "Hinzufügen", fr: "Ajouter", es: "Añadir" },
  customPlaceholder: { sl: "npr. jezero, družina, kremšnita", en: "e.g. lake, family, cream cake", it: "es. lago, famiglia, kremšnita", de: "z. B. See, Familie, Kremšnita", fr: "ex. lac, famille, kremšnita", es: "p. ej. lago, familia, kremšnita" },
  searchChips: { sl: "Išči med čipi …", en: "Search chips …", it: "Cerca tra le chip …", de: "Chips durchsuchen …", fr: "Rechercher dans les puces …", es: "Buscar fichas …" },
  showAll: { sl: "Pokaži vse", en: "Show all", it: "Mostra tutti", de: "Alle anzeigen", fr: "Tout afficher", es: "Mostrar todos" },
  showLess: { sl: "Pokaži manj", en: "Show less", it: "Mostra meno", de: "Weniger anzeigen", fr: "Afficher moins", es: "Mostrar menos" },
  remove: { sl: "Odstrani", en: "Remove", it: "Rimuovi", de: "Entfernen", fr: "Retirer", es: "Quitar" },
  daysLabel: { sl: "Število dni", en: "Number of days", it: "Numero di giorni", de: "Anzahl Tage", fr: "Nombre de jours", es: "Número de días" },
  fewerDays: { sl: "Manj dni", en: "Fewer days", it: "Meno giorni", de: "Weniger Tage", fr: "Moins de jours", es: "Menos días" },
  moreDays: { sl: "Več dni", en: "More days", it: "Più giorni", de: "Mehr Tage", fr: "Plus de jours", es: "Más días" },
  daysUnit: { sl: "dni", en: "days", it: "giorni", de: "Tage", fr: "jours", es: "días" },
  regionLabel: { sl: "Regija", en: "Region", it: "Regione", de: "Region", fr: "Région", es: "Región" },
  regionAny: { sl: "Vse regije", en: "All regions", it: "Tutte le regioni", de: "Alle Regionen", fr: "Toutes les régions", es: "Todas las regiones" },
  // F5 (#41): državni filter + čezmejni blok.
  countryLabel: { sl: "Država", en: "Country", it: "Paese", de: "Land", fr: "Pays", es: "País" },
  countryAny: { sl: "Cel Balkan (čezmejno dovoljeno)", en: "Whole Balkans (cross-border allowed)", it: "Tutti i Balcani (transfrontaliero consentito)", de: "Der ganze Balkan (grenzüberschreitend erlaubt)", fr: "Toute la Balkanique (transfrontalier autorisé)", es: "Todos los Balcanes (transfronterizo permitido)" },
  borderBlockTitle: { sl: "Mejni prehodi in potovalni dokumenti", en: "Border crossings and travel documents", it: "Confini e documenti di viaggio", de: "Grenzübergänge und Reisedokumente", fr: "Frontières et documents de voyage", es: "Fronteras y documentos de viaje" },
  borderDocsHeading: { sl: "Dokumenti po državah", en: "Documents by country", it: "Documenti per paese", de: "Dokumente je Land", fr: "Documents par pays", es: "Documentos por país" },
  borderSchengen: { sl: "Schengen", en: "Schengen", it: "Schengen", de: "Schengen", fr: "Schengen", es: "Schengen" },
  borderNonSchengen: { sl: "izven Schengena", en: "outside Schengen", it: "fuori Schengen", de: "außerhalb Schengens", fr: "hors Schengen", es: "fuera de Schengen" },
  borderCrossingsHeading: { sl: "Prehodi po vrsti potovanja", en: "Crossings in travel order", it: "Attraversamenti in ordine di viaggio", de: "Übergänge in Reihenfolge der Reise", fr: "Passages dans l'ordre du voyage", es: "Cruces en orden de viaje" },
  borderDay: { sl: "Dan", en: "Day", it: "Giorno", de: "Tag", fr: "Jour", es: "Día" },
  borderOfficial: { sl: "Uradni vir", en: "Official source", it: "Fonte ufficiale", de: "Offizielle Quelle", fr: "Source officielle", es: "Fuente oficial" },
  borderCurrency: { sl: "valuta", en: "currency", it: "valuta", de: "Währung", fr: "devise", es: "moneda" },
  borderSourceNote: { sl: "Viri: EU (Schengen članstvo, dokumenti) — preverjeno; pogoje z osebno izkaznico v izvenschengenskih državah preveri pri MZV RS (povezava pri vsaki državi).", en: "Sources: EU (Schengen membership, documents) — verified; check ID-card conditions for non-Schengen countries with the Slovenian MFA (link per country).", it: "Fonti: UE (appartenenza a Schengen, documenti) — verificate; per la carta d'identità fuori Schengen verifica con il MFA sloveno (link per paese).", de: "Quellen: EU (Schengen-Mitgliedschaft, Dokumente) — geprüft; Personalausweis-Bedingungen außerhalb Schengens beim slowenischen MFA prüfen (Link je Land).", fr: "Sources : UE (appartenance à Schengen, documents) — vérifiées ; pour la carte d'identité hors Schengen, vérifier auprès du MAE slovène (lien par pays).", es: "Fuentes: UE (pertenencia a Schengen, documentos) — verificadas; para el DNI fuera de Schengen consulta el MFA esloveno (enlace por país)." },
  seasonLabel: { sl: "Sezona (prednost)", en: "Season (preference)", it: "Stagione (preferenza)", de: "Jahreszeit (Bevorzugung)", fr: "Saison (préférence)", es: "Temporada (preferencia)" },
  seasonAny: { sl: "Katera koli", en: "Any", it: "Qualsiasi", de: "Beliebig", fr: "N’importe laquelle", es: "Cualquiera" },
  budgetLabel: { sl: "Proračun na postanek", en: "Budget per stop", it: "Budget per tappa", de: "Budget pro Stopp", fr: "Budget par étape", es: "Presupuesto por parada" },
  budgetAny: { sl: "Brez omejitve", en: "No limit", it: "Senza limiti", de: "Kein Limit", fr: "Sans limite", es: "Sin límite" },
  generate: { sl: "Sestavi načrt", en: "Build the plan", it: "Crea il piano", de: "Plan erstellen", fr: "Créer le plan", es: "Crear el plan" },
  generating: { sl: "Sestavljam …", en: "Building …", it: "Creazione …", de: "Erstelle …", fr: "Création …", es: "Creando …" },
  pickInterest: {
    sl: "Izberi ali napiši vsaj en interes.",
    en: "Pick or write at least one interest.",
    it: "Scegli o scrivi almeno un interesse.",
    de: "Wähle oder schreibe mindestens ein Interesse.",
    fr: "Choisis ou écris au moins un centre d’intérêt.",
    es: "Elige o escribe al menos un interés.",
  },
  networkError: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — please try again.", it: "Errore di rete — riprova.", de: "Netzwerkfehler — bitte erneut versuchen.", fr: "Erreur réseau — veuillez réessayer.", es: "Error de red — inténtalo de nuevo." },
  nlTitle: { sl: "Opiši potovanje s svojimi besedami", en: "Describe your trip in your own words", it: "Descrivi il tuo viaggio con parole tue", de: "Beschreibe deine Reise mit eigenen Worten", fr: "Décris ton voyage avec tes propres mots", es: "Describe tu viaje con tus propias palabras" },
  nlPlaceholder: { sl: "npr. 3 dni v gorah z družino, srednji proračun", en: "e.g. 3 days in the mountains with family, mid budget", it: "es. 3 giorni in montagna con la famiglia, budget medio", de: "z. B. 3 Tage in den Bergen mit der Familie, mittleres Budget", fr: "ex. 3 jours à la montagne en famille, budget moyen", es: "p. ej. 3 días en la montaña con la familia, presupuesto medio" },
  nlButton: { sl: "Razumej in sestavi načrt", en: "Understand and build the plan", it: "Capisci e crea il piano", de: "Verstehen und Plan erstellen", fr: "Comprendre et créer le plan", es: "Entender y crear el plan" },
  nlBusy: { sl: "Razumevam …", en: "Understanding …", it: "Sto capendo …", de: "Verstehe …", fr: "Je comprends …", es: "Entendiendo …" },
  nlHint: { sl: "Besedilo razume deterministična skripta (interesi, dnevi, regija, proračun) — brez AI modelov, brez ugibanj. Načrt sestavi deterministični motor: isti vhod vedno da isti načrt.", en: "Your words are understood by a deterministic script (interests, days, region, budget) — no AI models, no guessing. The plan itself is built by the deterministic engine: same input always gives the same plan.", it: "Il testo viene capito da uno script deterministico (interessi, giorni, regione, budget) — nessun modello di IA, nessuna ipotesi azzardata. Il piano lo crea il motore deterministico: stesso input, stesso piano.", de: "Der Text wird von einem deterministischen Skript verstanden (Interessen, Tage, Region, Budget) — keine KI-Modelle, kein Rätselraten. Den Plan erstellt die deterministische Engine: gleiche Eingabe, gleicher Plan.", fr: "Le texte est compris par un script déterministe (centres d'intérêt, jours, région, budget) — sans modèle d'IA, sans devinettes. Le plan reste créé par le moteur déterministe : même entrée, même plan.", es: "El texto lo entiende un script determinista (intereses, días, región, presupuesto) — sin modelos de IA, sin suposiciones. El plan lo sigue creando el motor determinista: misma entrada, mismo plan." },
  // P2 (2.25.0): START ANYWHERE — prilepi povezavo ali besedilo → skripta
  // prepozna kraje iz registra (0 AI) in predlaga izhodišče.
  saTitle: { sl: "Začni kjerkoli — povezava ali besedilo", en: "Start anywhere — a link or text", it: "Inizia da qualsiasi punto — un link o un testo", de: "Irgendwo anfangen — Link oder Text", fr: "Commence n'importe où — un lien ou du texte", es: "Empieza desde cualquier punto — un enlace o texto" },
  saLead: {
    sl: "Prilepi povezavo (YouTube, članek, TikTok) ali besedilo o potovanju — skripta prepozna kraje iz registra 74 destinacij in predlaga izhodišče za načrtovalnika. 0 AI, 0 ugibanj.",
    en: "Paste a link (YouTube, an article, TikTok) or text about a trip — a script recognizes places from the register of 74 destinations and proposes a starting point for the planner. 0 AI, no guessing.",
    it: "Incolla un link (YouTube, un articolo, TikTok) o un testo sul viaggio — uno script riconosce i luoghi dal registro di 74 destinazioni e propone un punto di partenza. 0 IA, nessuna ipotesi.",
    de: "Füge einen Link (YouTube, ein Artikel, TikTok) oder einen Text über eine Reise ein — ein Skript erkennt Orte aus dem Register von 74 Reisezielen und schlägt einen Ausgangspunkt vor. 0 KI, kein Rätselraten.",
    fr: "Colle un lien (YouTube, un article, TikTok) ou un texte sur un voyage — un script reconnaît les lieux du registre de 74 destinations et propose un point de départ. 0 IA, aucune devinette.",
    es: "Pega un enlace (YouTube, un artículo, TikTok) o un texto sobre un viaje — un script reconoce los lugares del registro de 74 destinos y propone un punto de partida. 0 IA, sin suposiciones.",
  },
  saPlaceholder: { sl: "https://… ali prilepi besedilo (npr. 3 dni: Bled, Bohinj in Soča)", en: "https://… or paste text (e.g. 3 days: Bled, Bohinj and the Soča)", it: "https://… o incolla un testo (es. 3 giorni: Bled, Bohinj e la Soča)", de: "https://… oder Text einfügen (z. B. 3 Tage: Bled, Bohinj und die Soča)", fr: "https://… ou colle du texte (ex. 3 jours : Bled, Bohinj et la Soča)", es: "https://… o pega texto (p. ej. 3 días: Bled, Bohinj y el Soča)" },
  saButton: { sl: "Prepoznaj kraje", en: "Recognize places", it: "Riconosci i luoghi", de: "Orte erkennen", fr: "Reconnaître les lieux", es: "Reconocer los lugares" },
  saBusy: { sl: "Prepoznavam …", en: "Recognizing …", it: "Sto riconoscendo …", de: "Erkenne …", fr: "Reconnaissance …", es: "Reconociendo …" },
  saSource: { sl: "vir", en: "source", it: "fonte", de: "Quelle", fr: "source", es: "fuente" },
  saMatchesTitle: { sl: "Prepoznani kraji", en: "Recognized places", it: "Luoghi riconosciuti", de: "Erkannte Orte", fr: "Lieux reconnus", es: "Lugares reconocidos" },
  saEvidence: { sl: "zadetek", en: "match", it: "corrispondenza", de: "Treffer", fr: "correspondance", es: "coincidencia" },
  saSuggestionTitle: { sl: "Predlagano izhodišče", en: "Suggested starting point", it: "Punto di partenza suggerito", de: "Vorgeschlagener Ausgangspunkt", fr: "Point de départ suggéré", es: "Punto de partida sugerido" },
  saInterestsLabel: { sl: "interesi", en: "interests", it: "interessi", de: "Interessen", fr: "centres d'intérêt", es: "intereses" },
  saRegionLabel: { sl: "regija", en: "region", it: "regione", de: "Region", fr: "région", es: "región" },
  saDaysLabel: { sl: "dnevi", en: "days", it: "giorni", de: "Tage", fr: "jours", es: "días" },
  saDaysKept: { sl: "dni niso navedeni — ohranjena izbira", en: "days not stated — your choice kept", it: "giorni non indicati — resta la tua scelta", de: "Tage nicht angegeben — deine Wahl bleibt", fr: "jours non précisés — ton choix est conservé", es: "días no indicados — se mantiene tu elección" },
  saApply: { sl: "Uporabi kot izhodišče", en: "Use as the starting point", it: "Usa come punto di partenza", de: "Als Ausgangspunkt verwenden", fr: "Utiliser comme point de départ", es: "Usar como punto de partida" },
  saApplied: { sl: "✓ Uporabljeno — načrt se gradi", en: "✓ Applied — building the plan", it: "✓ Applicato — creo il piano", de: "✓ Übernommen — Plan wird erstellt", fr: "✓ Appliqué — création du plan", es: "✓ Aplicado — creando el plan" },
  // POLIR4 A (2.31.0): UVOZ KML/GPX — uvoz seznama krajev (Google My Maps,
  // pohodniška/kolesarska orodja) kot izhodišče načrta. Vse klientansko
  // (0 omrežja), iskerno poročanje neznanih imen in izpuščenih poti.
  importButton: { sl: "Uvozi KML/GPX", en: "Import KML/GPX", it: "Importa KML/GPX", de: "KML/GPX importieren", fr: "Importer KML/GPX", es: "Importar KML/GPX" },
  importSource: {
    sl: (f: string, n: number) => `Uvožena datoteka ${f.toUpperCase()} · ${n} ${n % 100 === 1 ? "točka" : n % 100 === 2 ? "točki" : n % 100 === 3 || n % 100 === 4 ? "točke" : "točk"}`,
    en: (f: string, n: number) => `Imported ${f.toUpperCase()} file · ${n} ${n === 1 ? "point" : "points"}`,
    it: (f: string, n: number) => `File ${f.toUpperCase()} importato · ${n} ${n === 1 ? "punto" : "punti"}`,
    de: (f: string, n: number) => `Importierte ${f.toUpperCase()}-Datei · ${n} ${n === 1 ? "Punkt" : "Punkte"}`,
    fr: (f: string, n: number) => `Fichier ${f.toUpperCase()} importé · ${n} ${n === 1 ? "point" : "points"}`,
    es: (f: string, n: number) => `Archivo ${f.toUpperCase()} importado · ${n} ${n === 1 ? "punto" : "puntos"}`,
  },
  importUnmatched: {
    sl: (names: string[]) => `Niso v registru: ${names.join(", ")} — niso vključeni v predlog (ne ugibamo).`,
    en: (names: string[]) => `Not in the register: ${names.join(", ")} — not included in the suggestion (we don't guess).`,
    it: (names: string[]) => `Non nel registro: ${names.join(", ")} — non inclusi nel suggerimento (non tiriamo a indovinare).`,
    de: (names: string[]) => `Nicht im Register: ${names.join(", ")} — nicht in den Vorschlag aufgenommen (wir raten nicht).`,
    fr: (names: string[]) => `Pas dans le registre : ${names.join(", ")} — non inclus dans la suggestion (on ne devine pas).`,
    es: (names: string[]) => `No están en el registro: ${names.join(", ")} — no se incluyen en la sugerencia (no adivinamos).`,
  },
  importSkippedPaths: {
    sl: (n: number) => `Izpuščene poti (niso kraji): ${n}.`,
    en: (n: number) => `Skipped paths (not places): ${n}.`,
    it: (n: number) => `Percorsi saltati (non luoghi): ${n}.`,
    de: (n: number) => `Übersprungene Pfade (keine Orte): ${n}.`,
    fr: (n: number) => `Itinéraires ignorés (pas des lieux) : ${n}.`,
    es: (n: number) => `Rutas omitidas (no lugares): ${n}.`,
  },
  importDuplicates: {
    sl: (n: number) => `Ponovljene točke: ${n} — isti kraj je upoštevan samo enkrat.`,
    en: (n: number) => `Repeated points: ${n} — the same place is counted only once.`,
    it: (n: number) => `Punti ripetuti: ${n} — lo stesso luogo è contato una sola volta.`,
    de: (n: number) => `Wiederholte Punkte: ${n} — derselbe Ort wird nur einmal gezählt.`,
    fr: (n: number) => `Points répétés : ${n} — un même lieu n'est compté qu'une seule fois.`,
    es: (n: number) => `Puntos repetidos: ${n} — el mismo lugar se cuenta solo una vez.`,
  },
  importTruncated: { sl: "Datoteka ima več kot 200 točk — upoštevanih je prvih 200.", en: "The file has more than 200 points — the first 200 are used.", it: "Il file ha più di 200 punti — vengono usati i primi 200.", de: "Die Datei hat mehr als 200 Punkte — die ersten 200 werden verwendet.", fr: "Le fichier contient plus de 200 points — les 200 premiers sont utilisés.", es: "El archivo tiene más de 200 puntos — se usan los primeros 200." },
  importNoMatch: {
    sl: "V datoteki nisem prepoznal nobenega kraja iz registra (74 destinacij). Ne ugibam — dodaj imena krajev (npr. Bled) v datoteko ali izberi interese spodaj.",
    en: "No place from the register (74 destinations) was recognized in the file. We don't guess — add place names (e.g. Bled) to the file or pick interests below.",
    it: "Nel file non è stato riconosciuto nessun luogo del registro (74 destinazioni). Non indoviniamo — aggiungi i nomi dei luoghi (es. Bled) al file oppure scegli gli interessi sotto.",
    de: "In der Datei wurde kein Ort aus dem Register (74 Reiseziele) erkannt. Wir raten nicht — füge Ortsnamen (z. B. Bled) zur Datei hinzu oder wähle unten Interessen.",
    fr: "Aucun lieu du registre (74 destinations) n'a été reconnu dans le fichier. On ne devine pas — ajoute des noms de lieux (ex. Bled) au fichier ou choisis des centres d'intérêt ci-dessous.",
    es: "No se reconoció ningún lugar del registro (74 destinos) en el archivo. No adivinamos — añade nombres de lugares (p. ej. Bled) al archivo o elige intereses abajo.",
  },
  importReadError: { sl: "Datoteke ni bilo mogoče prebrati — poskusi znova.", en: "The file could not be read — please try again.", it: "Impossibile leggere il file — riprova.", de: "Die Datei konnte nicht gelesen werden — bitte erneut versuchen.", fr: "Le fichier n'a pas pu être lu — veuillez réessayer.", es: "No se pudo leer el archivo — inténtalo de nuevo." },
  importPrivacy: { sl: "Obdelava v brskalniku — datoteka ne zapusti naprave.", en: "Processed in the browser — the file never leaves your device.", it: "Elaborazione nel browser — il file non lascia il dispositivo.", de: "Verarbeitung im Browser — die Datei verlässt dein Gerät nicht.", fr: "Traitement dans le navigateur — le fichier ne quitte pas l'appareil.", es: "Procesado en el navegador — el archivo no sale del dispositivo." },
  importOriginNote: {
    sl: "Uvoženi kraji so izhodišče načrta (interesi in regija), ne prisilna pot — načrt sestavi deterministični motor.",
    en: "Imported places are the plan's starting point (interests and region), not a forced route — the plan is built by the deterministic engine.",
    it: "I luoghi importati sono il punto di partenza del piano (interessi e regione), non un itinerario forzato — il piano lo crea il motore deterministico.",
    de: "Importierte Orte sind der Ausgangspunkt des Plans (Interessen und Region), keine erzwungene Route — den Plan erstellt die deterministische Engine.",
    fr: "Les lieux importés sont le point de départ du plan (centres d'intérêt et région), pas un itinéraire imposé — le plan est créé par le moteur déterministe.",
    es: "Los lugares importados son el punto de partida del plan (intereses y región), no una ruta forzada — el plan lo crea el motor determinista.",
  },
  fewerDaysNote: {
    sl: (requested: number, filled: number) => `Zahteval si ${requested} ${requested === 1 ? "dan" : "dni"}, sestavljenih pa je bilo mogoče le ${filled}. Za preostale dni ni bilo več ustreznih destinacij za izbrane interese in regijo — razširi interese, spremeni regijo ali zmanjšaj število dni. Iskreno povejamo, namesto da bi izmišljevali postanke.`,
    en: (requested: number, filled: number) => `You asked for ${requested} ${requested === 1 ? "day" : "days"}, but only ${filled} ${filled === 1 ? "was" : "were"} possible to fill. There were no more matching destinations for the chosen interests and region — broaden the interests, change the region or reduce the number of days. We tell you honestly instead of inventing stops.`,
    it: (requested: number, filled: number) => `Hai chiesto ${requested} ${requested === 1 ? "giorno" : "giorni"}, ma è stato possibile compilarne solo ${filled}. Non ci sono più destinazioni corrispondenti agli interessi e alla regione scelti — amplia gli interessi, cambia regione o riduci i giorni. Te lo diciamo onestamente invece di inventare tappe.`,
    de: (requested: number, filled: number) => `Du hast ${requested} ${requested === 1 ? "Tag" : "Tage"} angefragt, aber nur ${filled} ${filled === 1 ? "konnte" : "konnten"} gefüllt werden. Es gab keine passenden Ziele mehr für die gewählten Interessen und die Region — erweitere die Interessen, wechsle die Region oder reduziere die Tage. Wir sagen es ehrlich, statt Halte zu erfinden.`,
    fr: (requested: number, filled: number) => `Tu as demandé ${requested} ${requested === 1 ? "jour" : "jours"}, mais seulement ${filled} ${filled === 1 ? "a pu être rempli" : "ont pu être remplis"}. Il n'y a plus de destinations correspondant aux intérêts et à la région choisis — élargis les intérêts, change de région ou réduis le nombre de jours. Nous te le disons honnêtement au lieu d'inventer des étapes.`,
    es: (requested: number, filled: number) => `Pediste ${requested} ${requested === 1 ? "día" : "días"}, pero solo se pudieron completar ${filled}. Ya no quedan destinos que coincidan con los intereses y la región elegidos — amplía los intereses, cambia la región o reduce los días. Te lo decimos con honestidad en lugar de inventar paradas.`,
  },
  saHint: {
    sl: "Skripta teče na strežniku: povezavo prebere z varovalkami (samo javni naslovi, ≤ 256 KiB, ≤ 8 s) in išče kraje po korenu — slovenski skloni vključeni („na Bledu“ → Bled, „po Ljubljani“ → Ljubljana). Isti vhod vedno da isti predlog; prepoznano vedno pokažemo z dokazom. 0 AI žetonov.",
    en: "The script runs server-side: the link is fetched with guardrails (public hosts only, ≤ 256 KiB, ≤ 8 s) and places are matched by word stems — Slovenian declensions included (“na Bledu” → Bled). Same input always gives the same suggestion; every match is shown with its evidence. 0 AI tokens.",
    it: "Lo script gira sul server: il link viene letto con protezioni (solo host pubblici, ≤ 256 KiB, ≤ 8 s) e i luoghi vengono riconosciuti per radice — declinazioni slovene incluse («na Bledu» → Bled). Stesso input, stesso suggerimento; ogni riconoscimento è mostrato con la prova. 0 token IA.",
    de: "Das Skript läuft serverseitig: Der Link wird mit Schutzvorrichtungen gelesen (nur öffentliche Hosts, ≤ 256 KiB, ≤ 8 s) und Orte werden über Wortstämme erkannt — slowenische Beugungen inklusive („na Bledu“ → Bled). Gleiche Eingabe, gleicher Vorschlag; jeder Treffer wird mit Beleg gezeigt. 0 KI-Tokens.",
    fr: "Le script tourne côté serveur : le lien est lu avec des garde-fous (hôtes publics uniquement, ≤ 256 KiB, ≤ 8 s) et les lieux sont reconnus par radical — déclinaisons slovènes incluses (« na Bledu » → Bled). Même entrée, même suggestion ; chaque reconnaissance est affichée avec sa preuve. 0 jeton d'IA.",
    es: "El script corre en el servidor: el enlace se lee con salvaguardas (solo hosts públicos, ≤ 256 KiB, ≤ 8 s) y los lugares se reconocen por raíces — declinaciones eslovenas incluidas («na Bledu» → Bled). Misma entrada, misma sugerencia; cada reconocimiento se muestra con su prueba. 0 fichas de IA.",
  },
  nlTooShort: { sl: "Napiši vsaj nekaj besed (npr. \"3 dni ob morju\").", en: "Write at least a few words (e.g. \"3 days by the sea\").", it: "Scrivi almeno qualche parola (es. \"3 giorni al mare\").", de: "Schreibe mindestens ein paar Wörter (z. B. \"3 Tage am Meer\").", fr: "Écris au moins quelques mots (ex. « 3 jours au bord de la mer »).", es: "Escribe al menos unas palabras (p. ej. \"3 días junto al mar\")." },
  nlNotUnderstood: { sl: "Opisa ni bilo mogoče razumeti dovolj natančno — izberi interese in dneve spodaj.", en: "The description could not be understood precisely enough — pick interests and days below.", it: "La descrizione non è stata capita con sufficiente precisione — scegli interessi e giorni sotto.", de: "Die Beschreibung konnte nicht genau genug verstanden werden — wähle unten Interessen und Tage.", fr: "La description n'a pas pu être comprise assez précisément — choisis les centres d'intérêt et les jours ci-dessous.", es: "No se pudo entender la descripción con suficiente precisión — elige intereses y días abajo." },
  presetsTitle: { sl: "Hitre prednastavitve", en: "Quick presets", it: "Preset rapidi", de: "Schnelle Voreinstellungen", fr: "Préréglages rapides", es: "Ajustes rápidos" },
  presetsLead: {
    sl: "Trije preizkušeni izhodi — en klik in načrt je tu.",
    en: "Three proven starting points — one click and the plan is here.",
    it: "Tre punti di partenza collaudati — un clic e il piano è pronto.",
    de: "Drei erprobte Ausgangspunkte — ein Klick und der Plan steht.",
    fr: "Trois points de départ éprouvés — un clic et le plan est là.",
    es: "Tres puntos de partida probados — un clic y el plan está listo.",
  },
  usePreset: { sl: "Uporabi", en: "Use", it: "Usa", de: "Verwenden", fr: "Utiliser", es: "Usar" },
  planTitle: { sl: "Tvoj načrt", en: "Your plan", it: "Il tuo piano", de: "Dein Plan", fr: "Votre plan", es: "Tu plan" },
  totalCost: { sl: "skupaj na osebo", en: "total per person", it: "totale per persona", de: "gesamt pro Person", fr: "total par personne", es: "total por persona" },
  coverage: { sl: "Pokritje", en: "Coverage", it: "Copertura", de: "Abdeckung", fr: "Couverture", es: "Cobertura" },
  driveEstimate: { sl: "ocena vožnje", en: "drive estimate", it: "stima del tragitto", de: "Fahrt (Schätzung)", fr: "estimation du trajet", es: "estimación del trayecto" },
  duration: { sl: "trajanje", en: "duration", it: "durata", de: "Dauer", fr: "durée", es: "duración" },
  cost: { sl: "cena", en: "cost", it: "costo", de: "Preis", fr: "prix", es: "precio" },
  free: { sl: "brezplačno", en: "free", it: "gratis", de: "kostenlos", fr: "gratuit", es: "gratis" },
  save: { sl: "Shrani v Moja pot", en: "Save to My trip", it: "Salva in I miei viaggi", de: "In Meine Reisen speichern", fr: "Enregistrer dans Mes voyages", es: "Guardar en Mis viajes" },
  saved: { sl: "Shranjeno v Moja pot", en: "Saved to My trip", it: "Salvato in I miei viaggi", de: "In Meine Reisen gespeichert", fr: "Enregistré dans Mes voyages", es: "Guardado en Mis viajes" },
  go: { sl: "Zaženi na poti", en: "Start on the road", it: "Inizia il viaggio", de: "Unterwegs starten", fr: "Démarrer sur la route", es: "Empezar en camino" },
  // QA U10 (2026-10-11): POENOTEN nabor izvozov na vseh treh pogledih
  // (/nacrtuj, /potovanje, /pot/[shareId]) — ista imena gumbov za ista
  // dejanja (prej: „Izpiši / natisni“ tu, „Natisni / shrani PDF“ na /pot).
  print: { sl: "Natisni", en: "Print", it: "Stampa", de: "Drucken", fr: "Imprimer", es: "Imprimir" },
  pdfBtn: { sl: "Izvozi PDF", en: "Export PDF", it: "Esporta PDF", de: "PDF exportieren", fr: "Exporter en PDF", es: "Exportar PDF" },
  pdfBusy: { sl: "Pripravljam PDF …", en: "Preparing PDF …", it: "Preparo il PDF …", de: "PDF wird vorbereitet …", fr: "Préparation du PDF …", es: "Preparando PDF …" },
  pdfErr: { sl: "PDF izvoz ni uspel — poskusi znova.", en: "PDF export failed — try again.", it: "Esportazione PDF non riuscita — riprova.", de: "PDF-Export fehlgeschlagen — bitte erneut versuchen.", fr: "Échec de l'export PDF — réessaie.", es: "Fallo al exportar PDF — reinténtalo." },
  icsBtn: { sl: "Koledar (.ics)", en: "Calendar (.ics)", it: "Calendario (.ics)", de: "Kalender (.ics)", fr: "Calendrier (.ics)", es: "Calendario (.ics)" },
  // QA U10: načrtovalnik nima realnih datumov (dnevi so zaporedne
  // številke; datumi se določijo na deljeni poti) → buildTripIcs bi vrnil
  // null. Iskrena onemogočitev z napotilom, ne tiha oz. izmišljeni datumi.
  icsNoDatesTitle: { sl: "Najprej shrani datume", en: "Save the dates first", it: "Prima salva le date", de: "Zuerst die Daten speichern", fr: "Enregistre d'abord les dates", es: "Primero guarda las fechas" },
  icsNoDates: {
    sl: "Izvoz v koledar (.ics) potrebuje realne datume poti — shrani načrt, odpri potovanje in ga shrani kot skupinsko pot; datume nato določiš na deljeni poti (/pot/…).",
    en: "The calendar (.ics) export needs real trip dates — save the plan, open the journey and save it as a shared trip; you can then set the dates on the shared trip (/pot/…).",
    it: "L'esportazione Calendario (.ics) richiede le date reali del viaggio — salva il piano, apri il viaggio e salvalo come viaggio condiviso; le date le imposti poi sul viaggio condiviso (/pot/…).",
    de: "Der Kalenderexport (.ics) braucht echte Reisedaten — speichere den Plan, öffne die Reise und speichere sie als geteilte Reise; die Daten legst du dann auf der geteilten Reise fest (/pot/…).",
    fr: "L'export Calendrier (.ics) nécessite les vraies dates du voyage — enregistre le plan, ouvre le voyage et enregistre-le comme voyage partagé ; tu définiras ensuite les dates sur le voyage partagé (/pot/…).",
    es: "La exportación a Calendario (.ics) necesita fechas reales del viaje — guarda el plan, abre el viaje y guárdalo como viaje compartido; las fechas las defines luego en el viaje compartido (/pot/…).",
  },
  openJourney: { sl: "Odpri potovanje", en: "Open the journey", it: "Apri il viaggio", de: "Reise öffnen", fr: "Ouvrir le voyage", es: "Abrir el viaje" },
  emptyTitle: { sl: "Načrt še ni sestavljen", en: "No plan yet", it: "Nessun piano per ora", de: "Noch kein Plan", fr: "Pas encore de plan", es: "Aún no hay plan" },
  emptyBody: {
    sl: "Izberi vsaj en interes in pritisni „Sestavi načrt“ — ali pa uporabi prednastavitev.",
    en: "Pick at least one interest and press “Build the plan” — or use a preset.",
    it: "Scegli almeno un interesse e premi «Crea il piano» — oppure usa un preset.",
    de: "Wähle mindestens ein Interesse und klicke auf „Plan erstellen“ — oder nutze eine Voreinstellung.",
    fr: "Choisis au moins un centre d’intérêt et appuie sur « Créer le plan » — ou utilise un préréglage.",
    es: "Elige al menos un interés y pulsa «Crear el plan» — o usa un ajuste rápido.",
  },
  errorTitle: { sl: "Načrta ni bilo mogoče sestaviti", en: "The plan could not be built", it: "Impossibile creare il piano", de: "Der Plan konnte nicht erstellt werden", fr: "Le plan n’a pas pu être créé", es: "No se pudo crear el plan" },
  retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
  deterministic: {
    sl: "Deterministični motor: isti vhod → isti izhod; vsi časi in cene izhajajo iz realnih podatkov destinacij (vožnje so ocene ~60 km/h).",
    en: "Deterministic engine: same input → same output; all times and prices come from real destination data (drives are ~60 km/h estimates).",
    it: "Motore deterministico: stesso input → stesso output; tutti i tempi e i prezzi provengono dai dati reali delle destinazioni (i tragitti sono stime a ~60 km/h).",
    de: "Deterministische Engine: gleiche Eingabe → gleiche Ausgabe; alle Zeiten und Preise stammen aus echten Reisezieldaten (Fahrten sind Schätzungen mit ~60 km/h).",
    fr: "Moteur déterministe : même entrée → même sortie ; tous les horaires et prix proviennent des données réelles des destinations (les trajets sont estimés à ~60 km/h).",
    es: "Motor determinista: misma entrada → misma salida; todos los tiempos y precios provienen de datos reales de los destinos (los trayectos son estimaciones a ~60 km/h).",
  },
  selectedInterests: { sl: "Izbrani interesi", en: "Selected interests", it: "Interessi selezionati", de: "Ausgewählte Interessen", fr: "Intérêts sélectionnés", es: "Intereses seleccionados" },
  noChipsFound: { sl: "Noben čip ne ustreza iskanju.", en: "No chips match your search.", it: "Nessuna chip corrisponde alla ricerca.", de: "Keine Chips entsprechen deiner Suche.", fr: "Aucune puce ne correspond à ta recherche.", es: "Ninguna ficha coincide con tu búsqueda." },
  stopsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
    it: (n: number) => `${n} ${n === 1 ? "tappa" : "tappe"}`,
    de: (n: number) => `${n} ${n === 1 ? "Stopp" : "Stopps"}`,
    fr: (n: number) => `${n} ${n === 1 ? "étape" : "étapes"}`,
    es: (n: number) => `${n} ${n === 1 ? "parada" : "paradas"}`,
  },
  daysWord: {
    sl: (n: number) => `${n} ${n === 1 ? "dan" : n === 2 ? "dneva" : "dni"}`,
    en: (n: number) => `${n} ${n === 1 ? "day" : n === 2 ? "days" : "days"}`,
    it: (n: number) => `${n} ${n === 1 ? "giorno" : "giorni"}`,
    de: (n: number) => `${n} ${n === 1 ? "Tag" : "Tage"}`,
    fr: (n: number) => `${n} ${n === 1 ? "jour" : "jours"}`,
    es: (n: number) => `${n} ${n === 1 ? "día" : "días"}`,
  },
  regionsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "regija" : n === 2 ? "regiji" : n <= 4 ? "regije" : "regij"}`,
    en: (n: number) => `${n} ${n === 1 ? "region" : "regions"}`,
    it: (n: number) => `${n} ${n === 1 ? "regione" : "regioni"}`,
    de: (n: number) => `${n} ${n === 1 ? "Region" : "Regionen"}`,
    fr: (n: number) => `${n} ${n === 1 ? "région" : "régions"}`,
    es: (n: number) => `${n} ${n === 1 ? "región" : "regiones"}`,
  },
  // POLIR A (2.28.0), naloga 1: one-click primeri prostega opisa (time-to-value).
  examplesLabel: {
    sl: "Ali začni s primerom — klik zgolj zapolni vnos, načrt se ne sestavi samodejno:",
    en: "Or start from an example — a click only fills the input, the plan is not built automatically:",
    it: "Oppure parti da un esempio — un clic riempie solo il campo, il piano non si crea automaticamente:",
    de: "Oder starte mit einem Beispiel — ein Klick füllt nur das Feld, der Plan wird nicht automatisch erstellt:",
    fr: "Ou pars d’un exemple — un clic remplit seulement le champ, le plan n’est pas créé automatiquement :",
    es: "O empieza con un ejemplo — un clic solo rellena el campo, el plan no se crea automáticamente:",
  },
  exampleUse: { sl: "Uporabi primer", en: "Use example", it: "Usa l’esempio", de: "Beispiel verwenden", fr: "Utiliser l’exemple", es: "Usar el ejemplo" },
  // POLIR A (2.28.0), naloga 2: 3-korakov onboarding trak (statičen, diskreten).
  stepsLabel: { sl: "Kako do načrta", en: "How to get a plan", it: "Come ottenere un piano", de: "So bekommst du einen Plan", fr: "Comment obtenir un plan", es: "Cómo conseguir un plan" },
  stepOne: { sl: "Opiši pot", en: "Describe the trip", it: "Descrivi il viaggio", de: "Beschreibe die Reise", fr: "Décris le voyage", es: "Describe el viaje" },
  stepTwo: { sl: "Prilagodi čipe in dneve", en: "Adjust the chips and days", it: "Regola le chip e i giorni", de: "Passe Chips und Tage an", fr: "Ajuste les puces et les jours", es: "Ajusta las fichas y los días" },
  stepThree: { sl: "Zaženi na poti z Go Mode", en: "Start it on the road with Go Mode", it: "Vivilo in viaggio con Go Mode", de: "Starte es unterwegs mit Go Mode", fr: "Lance-le sur la route avec Go Mode", es: "Ejecútalo en camino con Go Mode" },
  // POLIR A (2.28.0), naloga 3: primerjalnik proračunov (odločitvena podpora).
  compareTitle: { sl: "Primerjaj proračune", en: "Compare budgets", it: "Confronta i budget", de: "Budgets vergleichen", fr: "Comparer les budgets", es: "Compara presupuestos" },
  compareLead: {
    sl: "Ocene za trenutne izbire obrazca — isti deterministični motor, drugačen proračunski filter. Številke so ocene iz registra destinacij (vožnje ~60 km/h), ne obljube. Klik preklopi raven in znova sestavi načrt.",
    en: "Estimates for the current form choices — the same deterministic engine, a different budget filter. The numbers are estimates from the destination register (drives at ~60 km/h), not promises. Clicking a tier rebuilds the plan.",
    it: "Stime per le scelte attuali del modulo — lo stesso motore deterministico, un filtro budget diverso. I numeri sono stime dal registro delle destinazioni (tragitti a ~60 km/h), non promesse. Un clic sul livello ricrea il piano.",
    de: "Schätzungen für die aktuellen Formularauswahlen — dieselbe deterministische Engine, ein anderer Budgetfilter. Die Zahlen sind Schätzungen aus dem Zielregister (Fahrten mit ~60 km/h), keine Versprechen. Ein Klick auf eine Stufe erstellt den Plan neu.",
    fr: "Estimations pour les choix actuels du formulaire — le même moteur déterministe, un filtre budget différent. Les chiffres sont des estimations tirées du registre des destinations (trajets à ~60 km/h), pas des promesses. Un clic sur un palier recrée le plan.",
    es: "Estimaciones para las elecciones actuales del formulario — el mismo motor determinista, un filtro de presupuesto distinto. Los números son estimaciones del registro de destinos (trayectos a ~60 km/h), no promesas. Un clic en un nivel vuelve a crear el plan.",
  },
  compareEstimate: { sl: "ocena", en: "estimate", it: "stima", de: "Schätzung", fr: "estimation", es: "estimación" },
  compareCurrent: { sl: "trenutna izbira", en: "current choice", it: "scelta attuale", de: "aktuelle Wahl", fr: "choix actuel", es: "elección actual" },
  compareRelaxed: {
    sl: "Premogo ustreznih destinacij — filter je bil sproščen, načrt vsebuje tudi dražje postanke.",
    en: "Too few matching destinations — the filter was relaxed, the plan also contains pricier stops.",
    it: "Troppe poche destinazioni adatte — il filtro è stato allentato, il piano contiene anche tappe più costose.",
    de: "Zu wenige passende Ziele — der Filter wurde gelockert, der Plan enthält auch teurere Stopps.",
    fr: "Trop peu de destinations adaptées — le filtre a été assoupli, le plan contient aussi des étapes plus chères.",
    es: "Muy pocos destinos adecuados — el filtro se relajó, el plan también contiene paradas más caras.",
  },
  compareFiltered: {
    sl: "Proračunski filter je izpustil dražje postanke — zato manj postankov.",
    en: "The budget filter skipped pricier stops — hence fewer stops.",
    it: "Il filtro budget ha scartato le tappe più costose — quindi meno tappe.",
    de: "Der Budgetfilter hat teurere Stopps ausgelassen — daher weniger Stopps.",
    fr: "Le filtre budget a écarté les étapes plus chères — donc moins d’étapes.",
    es: "El filtro de presupuesto descartó las paradas más caras — por eso menos paradas.",
  },
  // POLIR2 A (2.29.0): POVLECI-IN-SPUSTI urejanje dni (Wanderlog vzorec) —
  // vsa nova besedila ×6 po vzorcu obstoječih ključev.
  manualBadge: { sl: "Ročno preurejeno", en: "Manually reordered", it: "Riordinato manualmente", de: "Manuell umgeordnet", fr: "Réordonné manuellement", es: "Reordenado manualmente" },
  manualNote: {
    sl: "Vrstni red si preuredil sam; časi so preračunani (začetek 09:00 + trajanja + ocenjene vožnje).",
    en: "You reordered the plan yourself; times are recalculated (09:00 start + durations + estimated drives).",
    it: "Hai riordinato il piano tu; gli orari sono ricalcolati (inizio 09:00 + durate + tragitti stimati).",
    de: "Du hast die Reihenfolge selbst umgeordnet; die Zeiten werden neu berechnet (Start 09:00 + Dauern + geschätzte Fahrten).",
    fr: "Tu as réordonné le plan toi-même ; les horaires sont recalculés (début 09:00 + durées + trajets estimés).",
    es: "Reordenaste el plan tú mismo; los horarios se recalculan (inicio 09:00 + duraciones + trayectos estimados).",
  },
  resetOrder: { sl: "Povrni vrstni red motorja", en: "Restore the engine order", it: "Ripristina l'ordine del motore", de: "Motor-Reihenfolge wiederherstellen", fr: "Restaurer l'ordre du moteur", es: "Restaurar el orden del motor" },
  resetOrderAria: { sl: "Povrni prvotni vrstni red, ki ga je sestavil motor", en: "Restore the original order built by the engine", it: "Ripristina l'ordine originale creato dal motore", de: "Die ursprüngliche Reihenfolge der Engine wiederherstellen", fr: "Restaurer l'ordre original construit par le moteur", es: "Restaurar el orden original creado por el motor" },
  dragHandle: { sl: "Povleci za preurejanje", en: "Drag to reorder", it: "Trascina per riordinare", de: "Zum Umsortieren ziehen", fr: "Glisser pour réordonner", es: "Arrastra para reordenar" },
  // POLIR2 B (2.29.0): zemljevid načrta — naslov in legenda kartice.
  mapTitle: { sl: "Zemljevid načrta", en: "Plan map", it: "Mappa del piano", de: "Plankarte", fr: "Carte du plan", es: "Mapa del plan" },
  mapDesc: {
    sl: "Položaji postankov po dnevih — barva in številka pomenita dan.",
    en: "Stop positions by day — colour and number stand for the day.",
    it: "Posizioni delle tappe per giorno — colore e numero indicano il giorno.",
    de: "Positionen der Stopps nach Tag — Farbe und Nummer stehen für den Tag.",
    fr: "Positions des arrêts par jour — couleur et numéro désignent le jour.",
    es: "Posiciones de las paradas por día — color y número indican el día.",
  },
  dropHere: { sl: "Spusti postanek sem", en: "Drop a stop here", it: "Trascina qui una tappa", de: "Stopp hier ablegen", fr: "Dépose une étape ici", es: "Suelta una parada aquí" },
  dragKeyboardHint: {
    sl: "Vlečenje deluje tudi s tipkovnico: fokusiraj ročico, preslednica dvigne, puščice premikajo, preslednica spusti.",
    en: "Dragging also works with the keyboard: focus the handle, Space lifts, arrow keys move, Space drops.",
    it: "Anche il trascinamento funziona con la tastiera: metti a fuoco la maniglia, Spazio solleva, le frecce spostano, Spazio rilascia.",
    de: "Das Ziehen funktioniert auch mit der Tastatur: Griff fokussieren, Leertaste hebt an, Pfeiltasten bewegen, Leertaste legt ab.",
    fr: "Le glisser fonctionne aussi au clavier : focalise la poignée, Espace soulève, les flèches déplacent, Espace dépose.",
    es: "Arrastrar también funciona con el teclado: enfoca el tirador, Espacio levanta, las flechas mueven, Espacio suelta.",
  },
  movedAnnouncement: {
    sl: (name: string, day: string, m: number) => `${name} premaknjen na ${day}, mesto ${m}.`,
    en: (name: string, day: string, m: number) => `${name} moved to ${day}, place ${m}.`,
    it: (name: string, day: string, m: number) => `${name} spostato in ${day}, posizione ${m}.`,
    de: (name: string, day: string, m: number) => `${name} verschoben nach ${day}, Platz ${m}.`,
    fr: (name: string, day: string, m: number) => `${name} déplacé vers ${day}, place ${m}.`,
    es: (name: string, day: string, m: number) => `${name} movido a ${day}, lugar ${m}.`,
  },
  // POLIR5 A (2.32.0): IZMERJENE razdalje v povzetku načrta (Wanderlog
  // pariteta: dnevne skupne POD glavo dneva + skupna vrstica; vsaka
  // številka nosi razložljiv vir — izmerjeno OSRM ali izrecno označena
  // ocena; vsota združuje SAMO izmerjene dneve).
  measuredDay: {
    sl: (km: string, min: number) => `${km} km · ${min} min vožnje — izmerjeno (OSRM/OpenStreetMap)`,
    en: (km: string, min: number) => `${km} km · ${min} min of driving — measured (OSRM/OpenStreetMap)`,
    it: (km: string, min: number) => `${km} km · ${min} min di guida — misurato (OSRM/OpenStreetMap)`,
    de: (km: string, min: number) => `${km} km · ${min} Min. Fahrt — gemessen (OSRM/OpenStreetMap)`,
    fr: (km: string, min: number) => `${km} km · ${min} min de conduite — mesuré (OSRM/OpenStreetMap)`,
    es: (km: string, min: number) => `${km} km · ${min} min de conducción — medido (OSRM/OpenStreetMap)`,
  },
  estimatedDay: {
    sl: (km: number, min: number) => `~ ${km} km · ~ ${min} min — ocena (premočrtna razdalja ×1,3 @ ~60 km/h)`,
    en: (km: number, min: number) => `~ ${km} km · ~ ${min} min — estimate (straight-line ×1.3 @ ~60 km/h)`,
    it: (km: number, min: number) => `~ ${km} km · ~ ${min} min — stima (linea d'aria ×1,3 a ~60 km/h)`,
    de: (km: number, min: number) => `~ ${km} km · ~ ${min} Min. — Schätzung (Luftlinie ×1,3 bei ~60 km/h)`,
    fr: (km: number, min: number) => `~ ${km} km · ~ ${min} min — estimation (à vol d'oiseau ×1,3 à ~60 km/h)`,
    es: (km: number, min: number) => `~ ${km} km · ~ ${min} min — estimación (línea recta ×1,3 a ~60 km/h)`,
  },
  measuredTotal: {
    sl: (km: string, dur: string) => `Skupaj izmerjeno: ${km} km · ${dur} vožnje (OSRM/OpenStreetMap)`,
    en: (km: string, dur: string) => `Measured in total: ${km} km · ${dur} of driving (OSRM/OpenStreetMap)`,
    it: (km: string, dur: string) => `Totale misurato: ${km} km · ${dur} di guida (OSRM/OpenStreetMap)`,
    de: (km: string, dur: string) => `Insgesamt gemessen: ${km} km · ${dur} Fahrt (OSRM/OpenStreetMap)`,
    fr: (km: string, dur: string) => `Total mesuré : ${km} km · ${dur} de conduite (OSRM/OpenStreetMap)`,
    es: (km: string, dur: string) => `Total medido: ${km} km · ${dur} de conducción (OSRM/OpenStreetMap)`,
  },
  measuredMissing: {
    sl: (n: number) => `za ${n} ${n === 1 ? "dan" : "dni"} ni izmerjenih podatkov — prikazana je ocena`,
    en: (n: number) => `for ${n} ${n === 1 ? "day" : "days"} no measured data is available — an estimate is shown`,
    it: (n: number) => `per ${n} ${n === 1 ? "giorno" : "giorni"} non ci sono dati misurati — viene mostrata una stima`,
    de: (n: number) => `für ${n} ${n === 1 ? "Tag" : "Tage"} liegen keine gemessenen Daten vor — eine Schätzung wird angezeigt`,
    fr: (n: number) => `pour ${n} ${n === 1 ? "jour" : "jours"} aucune donnée mesurée n'est disponible — une estimation est affichée`,
    es: (n: number) => `para ${n} ${n === 1 ? "día" : "días"} no hay datos medidos — se muestra una estimación`,
  },
  measuredSrPrefix: {
    sl: "Vožnja tega dne: ",
    en: "Driving this day: ",
    it: "Guida di questo giorno: ",
    de: "Fahrt an diesem Tag: ",
    fr: "Conduite de ce jour : ",
    es: "Conducción de este día: ",
  },
} as const;

const SEASONS: {
  value: Season;
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
}[] = [
  { value: "spring", sl: "Pomlad", en: "Spring", it: "Primavera", de: "Frühling", fr: "Printemps", es: "Primavera" },
  { value: "summer", sl: "Poletje", en: "Summer", it: "Estate", de: "Sommer", fr: "Été", es: "Verano" },
  { value: "autumn", sl: "Jesen", en: "Autumn", it: "Autunno", de: "Herbst", fr: "Automne", es: "Otoño" },
  { value: "winter", sl: "Zima", en: "Winter", it: "Inverno", de: "Winter", fr: "Hiver", es: "Invierno" },
];

const BUDGETS: {
  value: Budget;
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
}[] = [
  { value: "€", sl: "Najceneje (€)", en: "Cheapest (€)", it: "Economico (€)", de: "Günstigste (€)", fr: "Le moins cher (€)", es: "Más barato (€)" },
  { value: "€€", sl: "Zmerno (€€)", en: "Moderate (€€)", it: "Medio (€€)", de: "Mittel (€€)", fr: "Modéré (€€)", es: "Moderado (€€)" },
  { value: "€€€", sl: "Brez omejitve (€€€)", en: "No limit (€€€)", it: "Senza limiti (€€€)", de: "Kein Limit (€€€)", fr: "Sans limite (€€€)", es: "Sin límite (€€€)" },
];

/**
 * POLIR A (2.28.0), naloga 3: ravni primerjalnika proračunov (navdih
 * MonkeyTravel „3 budget tiers“). €€€ = brez omejitve (dovoljuje vse
 * ravni registra — enak nabor kot „any“ v spustnem meniju).
 */
const COMPARE_TIERS: {
  value: Budget;
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
}[] = [
  { value: "€", sl: "Varčno (€)", en: "Budget (€)", it: "Economico (€)", de: "Günstig (€)", fr: "Économique (€)", es: "Económico (€)" },
  { value: "€€", sl: "Zmerno (€€)", en: "Balanced (€€)", it: "Equilibrato (€€)", de: "Ausgewogen (€€)", fr: "Équilibré (€€)", es: "Equilibrado (€€)" },
  { value: "€€€", sl: "Brez omejitve (€€€)", en: "No limit (€€€)", it: "Senza limiti (€€€)", de: "Kein Limit (€€€)", fr: "Sans limite (€€€)", es: "Sin límites (€€€)" },
];

interface PresetDef {
  id: string;
  days: number;
  interests: string[];
  season?: Season;
  region?: string;
  budget?: Budget;
  title: { sl: string; en: string; it: string; de: string; fr: string; es: string };
  body: { sl: string; en: string; it: string; de: string; fr: string; es: string };
}

const PRESETS: PresetDef[] = [
  {
    id: "mirni-vikend-reka",
    days: 2,
    interests: ["reka", "mir", "sprehod", "narava"],
    title: {
      sl: "Miren vikend ob reki",
      en: "A calm weekend by the river",
      it: "Un fine settimana tranquillo al fiume",
      de: "Ein ruhiges Wochenende am Fluss",
      fr: "Un week-end paisible au bord de la rivière",
      es: "Un fin de semana tranquilo junto al río",
    },
    body: {
      sl: "Počasen tempo: reka, sprehodi in lokalna hrana.",
      en: "Slow pace: the river, walks and local food.",
      it: "Ritmo lento: il fiume, passeggiate e cibo locale.",
      de: "Gemächliches Tempo: der Fluss, Spaziergänge und lokale Küche.",
      fr: "Rythme lent : la rivière, les promenades et la cuisine locale.",
      es: "Ritmo tranquilo: el río, paseos y comida local.",
    },
  },
  {
    id: "druzinski-izlet",
    days: 1,
    interests: ["družina", "jezero", "sprehod"],
    title: {
      sl: "Družinski izlet danes",
      en: "Family day trip today",
      it: "Gita in famiglia oggi",
      de: "Familienausflug heute",
      fr: "Excursion en famille aujourd’hui",
      es: "Excursión familiar hoy",
    },
    body: {
      sl: "Krajše razdalje, varne atrakcije, sladki zastanki.",
      en: "Shorter distances, safe sights, sweet stops.",
      it: "Distanze brevi, attrazioni sicure, soste dolci.",
      de: "Kürzere Strecken, sichere Sehenswürdigkeiten, süße Stopps.",
      fr: "Distances courtes, sites sûrs, pauses gourmandes.",
      es: "Distancias cortas, atracciones seguras, paradas dulces.",
    },
  },
  {
    id: "romantika-vino",
    days: 2,
    interests: ["romantika", "vino", "hrana", "sončni zahod"],
    season: "autumn",
    title: {
      sl: "Romantičen vikend z vinom",
      en: "Romantic wine weekend",
      it: "Weekend romantico col vino",
      de: "Romantisches Wein-Wochenende",
      fr: "Week-end romantique et vin",
      es: "Fin de semana romántico con vino",
    },
    body: {
      sl: "Vinske gorice, razgledi in večerja za dva.",
      en: "Wine hills, viewpoints and dinner for two.",
      it: "Colli del vino, panorami e cena per due.",
      de: "Weinhügel, Aussichtspunkte und Dinner zu zweit.",
      fr: "Coteaux viticoles, points de vue et dîner en tête-à-tête.",
      es: "Colinas vinícolas, miradores y cena para dos.",
    },
  },
];

// ---------------------------------------------------------------------------
// POLIR A (2.28.0), naloga 1: ONE-CLICK PRIMERI PROSTEGA OPISA.
//
// Vsak primer je PREVERJENO razumljiv z obstoječo skriptno NLU
// (src/lib/advisor/nlu.ts) — interesi/dnevi/regija se res izvlečejo
// (zaklenjeno v tests/nacrtuj-polir.test.ts: 6 jezikov × 3 primeri).
// Odločitve (iskrene, ne ugibanja):
//  - IT/ES: skripta NE pozna „sci“/„esquí“ → 3. primer v gorski različici
//    („gora“ pride iz imena kraja Kranjska Gora);
//  - FR: besednjak NE pozna „vin“/„vignoble“ (samo vina/vino/vini/vinc/…)
//    → 2. primer v gastronomski različici (Maribor ostane nosilec regije);
//  - DE/FR: „Wochenende“/„week-end“ bi skripta napačno prebrala kot teden
//    (podniz „woche“/„week“ → 5 dni) → izrecna številka dni (2 Tage/jours).
// ---------------------------------------------------------------------------
const NL_EXAMPLES: ReadonlyArray<{
  sl: string;
  en: string;
  it: string;
  de: string;
  fr: string;
  es: string;
}> = [
  // 1) Bled + družina + jezero → [družina, jezero], 2 dni, gorenjska (×6).
  {
    sl: "vikend na Bledu z družino",
    en: "a weekend on Lake Bled with the family",
    it: "un weekend familiare sul lago di Bled",
    de: "2 Tage in Bled mit der Familie",
    fr: "2 jours au lac de Bled en famille",
    es: "2 días en el lago de Bled en familia",
  },
  // 2) Vinogradi / Štajerska → vino (FR: kulinarika), 3 dni, stajerska (×6).
  {
    sl: "3 dni med vinogradi na Štajerskem",
    en: "3 days among the vineyards of Styria",
    it: "3 giorni alla scoperta dei vini di Maribor",
    de: "3 Tage zwischen den Weingärten der Steiermark",
    fr: "3 jours de gastronomie près de Maribor",
    es: "3 días de catas de vino cerca de Maribor",
  },
  // 3) Smučarski teden → smučanje+gora (IT/ES: gora), 5 dni, brez regije (×6).
  {
    sl: "smučarski teden v Kranjski Gori",
    en: "a week of skiing in Kranjska Gora",
    it: "5 giorni in montagna a Kranjska Gora",
    de: "eine Woche Skifahren in Kranjska Gora",
    fr: "5 jours de ski à Kranjska Gora",
    es: "5 días de montaña en Kranjska Gora",
  },
];

// ---------------------------------------------------------------------------
// Stran
// ---------------------------------------------------------------------------

export default function PlanPage({
  nextStepDismissed = false,
}: {
  /** POLIR13 (2.40.0): sejni dismiss zrcaljen v piškotek
   *  dai:next-step-dismissed — strežniški starš (page.tsx) ga prebere s
   *  cookies() in kartico izpusti ŽE v SSR (ni rezervacije prostora, ni
   *  premika vsebine po ponovnem nalaganju v isti seji). */
  nextStepDismissed?: boolean;
}) {
  const l = useLocale();
  const { ctx: nextStepCtx, ready: nextStepReady } = useNextStepContext();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />
      {/* POLIR13 (2.40.0): vrata so strežniška (piškotek
          dai:next-step-dismissed, ne več nextStepReady) + kartica se izriše
          NEVIDNA že v SSR in se razkrije ob `ready` (prop) — rezervacija
          prostora po web.dev kanonu „Reserve space for late-loading
          content“ (vstavitev 347 px po hidraciji je povzročala CLS 0,239). */}
      {!nextStepDismissed && (
        <div className="mt-8">
          <NextStepCard ctx={nextStepCtx} surface="plan" ready={nextStepReady} />
        </div>
      )}
      <Suspense fallback={<PlannerSkeleton />}>
        <PlannerApp />
      </Suspense>
      {/* P1-B (issue #3 §3/§6): ukazno urejanje zadnjega načrta + načrt
          iz osebnih preferenc (deterministično, 0 AI). */}
      <PlanEditPanel />
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-hidden="true">
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

interface FormState {
  interests: string[];
  days: number;
  region: string;
  country: string;
  season: string;
  budget: string;
}

/** P2 (2.25.0): odgovor /api/start-anywhere (skriptni Start Anywhere). */
interface SaResult {
  engine: string;
  source:
    | { kind: "url"; host: string; title: string | null }
    | { kind: "text"; chars: number }
    // POLIR4 A (2.31.0): uvožena datoteka KML/GPX (klientansko razčlenjena).
    | { kind: "import"; format: "kml" | "gpx"; points: number };
  matches: {
    slug: string;
    name: string;
    type: string;
    region: string;
    evidence: string;
    // needle manjka pri koordinatnem ujemanju uvoza (dokaz je bližina).
    needle?: string;
    kind: "stem" | "exact" | "coords";
  }[];
  intent: {
    interests?: string[];
    days?: number;
    region?: string;
    season?: string;
    budget?: string;
  } | null;
  suggestion: { interests: string[]; region?: string };
  hint?: string;
  // POLIR4 A: iskreni dodatki uvoza (samo pri source.kind === "import").
  unmatchedNames?: string[];
  skippedPaths?: number;
  duplicateCount?: number;
  truncated?: boolean;
}

function PlannerApp() {
  const l = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang: PlannerLang = asPickLocale(l);

  const chips = useMemo(() => interestChips(), []);
  const chipLabels = useMemo(() => new Set(chips.map((c) => c.label)), [chips]);

  const [form, setForm] = useState<FormState>({
    interests: [],
    days: 2,
    region: "all",
    country: "all",
    season: "any",
    budget: "any",
  });
  const [customInput, setCustomInput] = useState("");
  const [chipSearch, setChipSearch] = useState("");
  const [showAllChips, setShowAllChips] = useState(false);
  // P1 (2.24.0): prosti opis potovanja → SKRIPTNI NLU → obstoječi
  // deterministični motor (kje bi bil AI model, tu je skripta).
  const [nlInput, setNlInput] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);
  // P2 (2.25.0): START ANYWHERE — povezava/besedilo → skripta → izhodišče.
  const [saInput, setSaInput] = useState("");
  const [saBusy, setSaBusy] = useState(false);
  const [saError, setSaError] = useState<string | null>(null);
  const [saResult, setSaResult] = useState<SaResult | null>(null);
  const [saApplied, setSaApplied] = useState(false);
  // POLIR4 A (2.31.0): skriti datotečni vhod uvoza KML/GPX (sr-only; klik
  // sproži gumb „Uvozi KML/GPX" — po branju se vrednost RESETIRA, da lahko
  // uporabnik izbere ISTO datoteko znova).
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<ItineraryPlan | null>(null);
  // POLIR2 A (2.29.0): zadnji ČISTI načrt motorja (za „Povrni vrstni red
  // motorja“) + zastavica ročnega preurejanja (iskrena značka). PlannerApp
  // ob mountu NE hidrira zadnjega načrta (dai:last-plan berejo /na-poti,
  // /potovanje, PDF in PlanEditPanel — tukaj se načrt sestavi na novo),
  // zato manualOrder = true SAMO po dejanskem spustu vlečenja.
  const [enginePlan, setEnginePlan] = useState<ItineraryPlan | null>(null);
  const [manualOrder, setManualOrder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  // QA U10: PDF izvoz načrta (enake knjižnice kot /potovanje in /pot —
  // jsPDF + Liberation Sans se naložita šele ob kliku, leni chunk).
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const startedRef = React.useRef(false);

  const generate = useCallback(
    async (f: FormState) => {
      if (f.interests.length === 0) {
        setError(pick(l, L.pickInterest));
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/itinerary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interests: f.interests,
            days: f.days,
            region: f.region !== "all" ? f.region : undefined,
            country: f.country !== "all" ? f.country : undefined,
            season: f.season !== "any" ? f.season : undefined,
            budget: f.budget !== "any" ? f.budget : undefined,
            locale: lang,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
          return;
        }
        const nov = data as ItineraryPlan;
        setPlan(nov);
        // POLIR2 A: vsak svež načrt motorja izstreše zastavico ročnega
        // urejanja (prednastavitve / NLU / primerjalnik / ponovni poskus
        // gredo VSI skozi ta en sam setPlan — nov čist kanon).
        setEnginePlan(nov);
        setManualOrder(false);
        setSavedMsg(false);
        requestAnimationFrame(() => {
          document.getElementById("nacrt-rezultat")?.scrollIntoView({ behavior: "smooth" });
        });
      } catch {
        setError(pick(l, L.networkError));
      } finally {
        setLoading(false);
      }
    },
    [lang, l]
  );

  // ?preset= (izhodi s starih strani/domov) → enkratna prednaloga + generiranje.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const preset = PRESETS.find((p) => p.id === searchParams.get("preset"));
    if (preset) {
      const next: FormState = {
        interests: preset.interests,
        days: preset.days,
        region: preset.region ?? "all",
        country: "all", // F5: prednastavitve ostanejo čezmejno odprte
        season: preset.season ?? "any",
        budget: preset.budget ?? "any",
      };
      setForm(next);
      void generate(next);
    }
  }, []);

  // P1 (2.24.0): prosti opis → /api/plan-intent (SKRIPTNI NLU — 0 AI
  // modelov, 0 žetonov) → isti deterministični tok kot prednastavitve
  // (setForm + generate). Nerazumljeno (422) → iskreno sporočilo,
  // uporabnik obdrži čipe in izbire — NIKOLI ne ugibamo.
  const understandNl = useCallback(async () => {
    const t = nlInput.trim();
    if (t.length < 4) {
      setNlError(pick(l, L.nlTooShort));
      return;
    }
    setNlBusy(true);
    setNlError(null);
    try {
      const res = await fetch("/api/plan-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data: unknown = await res.json().catch(() => null);
      const intent =
        data && typeof data === "object" && "intent" in data
          ? (data as { intent?: Record<string, unknown> }).intent
          : null;
      if (!res.ok || !intent) {
        setNlError(pick(l, L.nlNotUnderstood));
        return;
      }
      const next: FormState = {
        interests:
          Array.isArray(intent.interests) && intent.interests.length > 0
            ? (intent.interests as string[])
            : form.interests,
        days:
          typeof intent.days === "number" && intent.days >= 1 && intent.days <= 5
            ? intent.days
            : form.days,
        region: typeof intent.region === "string" && intent.region !== "" ? intent.region : "all",
        country: form.country, // F5: NLU ne spreminja državnega filtra
        season: typeof intent.season === "string" && intent.season !== "" ? intent.season : "any",
        budget: typeof intent.budget === "string" && intent.budget !== "" ? intent.budget : "any",
      };
      setForm(next);
      void generate(next);
    } catch {
      setNlError(pick(l, L.networkError));
    } finally {
      setNlBusy(false);
    }
  }, [nlInput, form, l, generate]);

  // P2 (2.25.0): START ANYWHERE — povezava ALI besedilo → /api/start-anywhere
  // (SKRIPTA: SSRF-varovano branje + ujemanje krajev po korenu + NLU namen).
  // Prepoznano (422) → iskreno sporočilo; uporabnik obdrži obrazec — NIKOLI
  // ne ugibamo. Uspeh → rezultat s predlogom; gumb „Uporabi kot izhodišče"
  // zliti predlog v obstoječi deterministični tok (setForm + generate).
  const runStartAnywhere = useCallback(async () => {
    const t = saInput.trim();
    if (t.length < 4) {
      setSaError(pick(l, L.nlTooShort));
      return;
    }
    setSaBusy(true);
    setSaError(null);
    setSaResult(null);
    setSaApplied(false);
    try {
      const isUrl = /^https?:\/\//i.test(t);
      const res = await fetch("/api/start-anywhere", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isUrl ? { url: t } : { text: t.slice(0, 2000) }),
      });
      const data: unknown = await res.json().catch(() => null);
      const msg =
        data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : null;
      if (!res.ok) {
        setSaError(msg ?? `HTTP ${res.status}`);
        return;
      }
      const parsed = data as SaResult | null;
      if (!parsed || !Array.isArray(parsed.matches) || parsed.matches.length === 0) {
        setSaError(pick(l, L.nlNotUnderstood));
        return;
      }
      setSaResult(parsed);
    } catch {
      setSaError(pick(l, L.networkError));
    } finally {
      setSaBusy(false);
    }
  }, [saInput, l]);

  // POLIR4 A (2.31.0): UVOZ KML/GPX — datoteka se prebere in razčleni
  // IZKLJUČNO v brskalniku (FileReader + ročni deterministični tokenizer iz
  // @/lib/plan-import; 0 fetch, 0 omrežja — datoteka NE zapusti naprave).
  // Rezultat vstopi v ISTI tok Start Anywhere: saResult → „Uporabi kot
  // izhodišče" → applyStartAnywhere (obstoječa zlitjev v obrazec + motor).
  // 0 zadetkov → iskrena napaka brez načrta (nikoli ne ugibamo).
  const onImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      e.target.value = ""; // reset: uporabnik lahko izbere ISTO datoteko znova
      if (!file) return;
      if (saApplied) setSaApplied(false);
      setSaBusy(true);
      setSaError(null);
      setSaResult(null);
      const done = () => setSaBusy(false);
      const reader = new FileReader();
      reader.onerror = () => {
        setSaError(pick(l, L.importReadError));
        done();
      };
      reader.onload = () => {
        try {
          const text = typeof reader.result === "string" ? reader.result : "";
          const parsed = parseImportFile(text);
          if (parsed.error !== null || parsed.format === null) {
            setSaError(parsed.error ?? pick(l, L.importNoMatch));
            done();
            return;
          }
          const mr = matchImportPlacemarks(parsed.placemarks);
          if (mr.matched.length === 0) {
            setSaError(pick(l, L.importNoMatch));
            done();
            return;
          }
          setSaResult({
            engine: "client-import → deterministic-planner",
            source: {
              kind: "import",
              format: parsed.format,
              points: parsed.placemarks.length,
            },
            matches: mr.matched,
            intent: null, // uvoz ne razume namena (dni/sezona) — izhodišče so kraji
            suggestion: deriveImportSuggestion(mr.matched),
            unmatchedNames: mr.unmatchedNames,
            skippedPaths: parsed.skippedPaths,
            duplicateCount: mr.duplicateCount,
            truncated: parsed.truncated,
          });
        } catch {
          setSaError(pick(l, L.importReadError));
        }
        done();
      };
      reader.readAsText(file);
    },
    [l, saApplied]
  );

  // Zlivanje predloga v obrazec + generiranje (isti tok kot prednastavitve).
  const applyStartAnywhere = useCallback(() => {
    if (!saResult) return;
    const intent = saResult.intent;
    const sug = saResult.suggestion;
    const next: FormState = {
      interests:
        Array.isArray(sug?.interests) && sug.interests.length > 0
          ? sug.interests
          : form.interests,
      days:
        typeof intent?.days === "number" && intent.days >= 1 && intent.days <= 5
          ? intent.days
          : form.days,
      region:
        typeof sug?.region === "string" && sug.region !== "" ? sug.region : form.region,
      country: form.country, // F5: Start Anywhere ne spreminja državnega filtra
      season:
        typeof intent?.season === "string" && intent.season !== "" ? intent.season : form.season,
      budget:
        typeof intent?.budget === "string" && intent.budget !== "" ? intent.budget : form.budget,
    };
    setSaApplied(true);
    setForm(next);
    void generate(next);
    requestAnimationFrame(() => {
      document.getElementById("nacrt-rezultat")?.scrollIntoView({ behavior: "smooth" });
    });
  }, [saResult, form, generate]);

  const toggleInterest = (label: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(label)
        ? f.interests.filter((x) => x !== label)
        : [...f.interests, label],
    }));
  };

  const addCustomInterests = () => {
    const added = normalizeInterests(customInput);
    if (added.length === 0) return;
    setForm((f) => ({ ...f, interests: [...new Set([...f.interests, ...added])] }));
    setCustomInput("");
  };

  const applyPreset = (preset: PresetDef) => {
    const next: FormState = {
      interests: preset.interests,
      days: preset.days,
      region: preset.region ?? "all",
      country: "all", // F5: prednastavitve ostanejo čezmejno odprte
      season: preset.season ?? "any",
      budget: preset.budget ?? "any",
    };
    setForm(next);
    void generate(next);
  };

  // QA U4: iskanje med čipi dela po SLOVENSKEM kanonu IN po prikaznem
  // prevodu (v EN vmesniku uporabnik išče „family“ in najde „družina“).
  const visibleChips = useMemo(() => {
    const q = chipSearch.trim().toLowerCase();
    const filtered = q
      ? chips.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            interestDisplay(c.label, l).toLowerCase().includes(q)
        )
      : chips;
    return showAllChips || q ? filtered : filtered.slice(0, POPULAR_CHIPS);
  }, [chips, chipSearch, showAllChips, l]);

  const saveToMyTrip = () => {
    if (!plan) return;
    for (const stop of plan.days.flat()) {
      if (stop.slug) myTrip.add(stop.slug, stop.name, "destination", "nacrtuj");
    }
    saveLastPlan(plan);
    setSavedMsg(true);
  };

  const startGo = () => {
    if (!plan) return;
    saveLastPlan(plan);
    // Locale-zavedajoči push (iz @/i18n/navigation) — /en prefix se ohrani.
    router.push("/na-poti?start=1");
  };

  /**
   * QA U10: IZVOZI PDF trenutnega načrta — isti tok kot na /potovanje
   * (fromItineraryPlan + buildTripPdf + downloadTripPdf; brez realnih
   * datumov, ker jih načrtovalnik nima — PDF izpiše dneve po zaporedju).
   */
  const exportPdf = useCallback(async () => {
    if (!plan || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const doc = buildTripPdf(fromItineraryPlan(plan, null), l);
      await downloadTripPdf(doc);
    } catch {
      setPdfError(pick(l, L.pdfErr));
    } finally {
      setPdfBusy(false);
    }
  }, [plan, pdfBusy, l]);

  // POLIR A (2.28.0), naloga 3: klik na raven primerjalnika → preklop
  // proračuna + regeneracija (ISTI deterministični tok kot prednastavitve:
  // setForm + generate — številke na karticah so bile izračunane iz
  // istega motorja za isti obrazec, zato se načrt ujema s kartico).
  const pickBudget = useCallback(
    (b: Budget) => {
      const next: FormState = { ...form, budget: b };
      setForm(next);
      void generate(next);
    },
    [form, generate]
  );

  // POLIR2 A (2.29.0): POVLECI-IN-SPUSTI — spust vlečenja nad načrtom.
  // Časi vseh dni se preračunajo po ISTEM kanonu kot motor:
  // recomputeDayTimes je idempotenten (nedotaknjeni dnevi ostanejo bajtno
  // enaki — zaklenjeno v tests/nacrtuj-dnd.test.ts), dotaknjeni dnevi pa
  // dobijo pošten urnik 09:00 + trajanja + ocenjene vožnje. Naslovi dni
  // postanejo iskreni „Dan N · regije“ (motorjevih naslovov po premiku ne
  // moremo reproducirati). saveLastPlan poskrbi, da PDF / Go Mode / oblak
  // berejo isti `plan` → sprememba velja povsod samodejno.
  const handleReorder = useCallback(
    (newDays: TripStop[][]) => {
      if (!plan) return;
      const days = newDays.map((stops) => recomputeDayTimes(stops));
      if (isSameOrder(plan.days, days)) return; // spust brez spremembe → brez lažne zastavice
      const nov: ItineraryPlan = {
        ...plan,
        days,
        dayTitles: days.map((stops, i) => recomputeDayTitle(i, stops, lang)),
      };
      setPlan(nov);
      saveLastPlan(nov);
      setManualOrder(true);
    },
    [plan, lang]
  );

  // POLIR2 A: povrnitev vrstnega reda motorja (iskrena razveljavitev —
  // tudi dai:last-plan se povrne na čist izhod motorja).
  const handleResetOrder = useCallback(() => {
    if (!enginePlan) return;
    setPlan(enginePlan);
    saveLastPlan(enginePlan);
    setManualOrder(false);
  }, [enginePlan]);

  return (
    <>
      {/* PREDNASTAVITVE */}
      <section className="mt-10" aria-labelledby="prednastavitve">
        <h2 id="prednastavitve" className="text-xl font-bold tracking-tight">
          {pick(l, L.presetsTitle)}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.presetsLead)}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={loading}
              className="group flex min-h-36 flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              <div>
                <h3 className="text-sm font-bold leading-snug group-hover:text-primary">
                  {p.title[lang]}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.body[lang]}</p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <Wand2 className="size-3.5" aria-hidden="true" />
                {pick(l, L.usePreset)} · {L.daysWord[lang](p.days)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* P2 (2.25.0): START ANYWHERE — prilepi povezavo ali besedilo →
          skripta prepozna kraje (0 AI) in predlaga izhodišče. */}
      <Card className="mt-8" id="zacni-kjerkoli">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5 text-primary" aria-hidden="true" />
            {pick(l, L.saTitle)}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.saLead)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="sa-input"
              value={saInput}
              onChange={(e) => {
                setSaInput(e.target.value);
                if (saApplied) setSaApplied(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runStartAnywhere();
                }
              }}
              placeholder={pick(l, L.saPlaceholder)}
              maxLength={2100}
              className="min-h-11 flex-1"
              disabled={saBusy || loading}
            />
            {/* POLIR7 (2.34.0): flex-wrap — oba gumba imata whitespace-nowrap
                (osnova Button), v FR (15 px) in ES (23 px) skupaj prelivata
                ekran; vrstica se lomi, oznaki ostanejeta enovrstni. */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void runStartAnywhere()}
                disabled={saBusy || loading || saInput.trim().length < 4}
                className="min-h-11"
              >
                {saBusy ? pick(l, L.saBusy) : pick(l, L.saButton)}
              </Button>
              {/* POLIR4 A (2.31.0): uvoz datoteke KML/GPX — 100 % klientansko
                  (razčlenitev v brskalniku, datoteka ne zapusti naprave). */}
              <Button
                type="button"
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={saBusy || loading}
                className="min-h-11"
              >
                <FileUp className="size-4" aria-hidden="true" />
                {pick(l, L.importButton)}
              </Button>
            </div>
          </div>
          {/* Skriti datotečni vhod (sr-only) — reset value po branju omogoča
              ponovni izbor ISTE datoteke; sprejema samo KML/GPX/XML. */}
          <input
            ref={importInputRef}
            type="file"
            accept=".kml,.gpx,.xml"
            className="sr-only"
            aria-label={pick(l, L.importButton)}
            onChange={onImportFile}
          />
          {saError && (
            <p className="text-sm text-destructive" role="alert">
              {saError}
            </p>
          )}

          {saResult && !saBusy && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">
                {pick(l, L.saSource)}: {" "}
                {saResult.source.kind === "url"
                  ? saResult.source.title ?? saResult.source.host
                  : saResult.source.kind === "import"
                    ? pick(l, L.importSource)(saResult.source.format, saResult.source.points)
                    : `${saResult.source.chars} zn.`}
              </p>
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {pick(l, L.saMatchesTitle)} ({saResult.matches.length})
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {saResult.matches.map((m) => (
                    <li
                      key={m.slug}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground">
                        · {regionLabel(m.region, lang)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        — {pick(l, L.saEvidence)}: „{m.evidence}“
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* POLIR4 A: ISKRENO poročanje o uvozu — neznana imena, izpuščene
                  poti, ponovitve in odrez (samo kadar so > 0, nikoli tiho). */}
              {saResult.source.kind === "import" &&
                (saResult.unmatchedNames?.length ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {pick(l, L.importUnmatched)(saResult.unmatchedNames ?? [])}
                  </p>
                )}
              {saResult.source.kind === "import" && (saResult.skippedPaths ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  {pick(l, L.importSkippedPaths)(saResult.skippedPaths ?? 0)}
                </p>
              )}
              {saResult.source.kind === "import" && (saResult.duplicateCount ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  {pick(l, L.importDuplicates)(saResult.duplicateCount ?? 0)}
                </p>
              )}
              {saResult.source.kind === "import" && saResult.truncated === true && (
                <p className="text-sm text-muted-foreground">{pick(l, L.importTruncated)}</p>
              )}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">{pick(l, L.saSuggestionTitle)}</p>
                <p className="mt-1 text-muted-foreground">
                  {pick(l, L.saInterestsLabel)}:{" "}
                  {saResult.suggestion.interests.length > 0
                    ? saResult.suggestion.interests
                        .map((i) => interestDisplay(i, l))
                        .join(", ")
                    : "—"}{" "}
                  · {pick(l, L.saRegionLabel)}:{" "}
                  {saResult.suggestion.region
                    ? regionLabel(saResult.suggestion.region, lang)
                    : "—"}{" "}
                  · {pick(l, L.saDaysLabel)}:{" "}
                  {typeof saResult.intent?.days === "number"
                    ? saResult.intent.days
                    : pick(l, L.saDaysKept)}
                </p>
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyStartAnywhere}
                    disabled={saApplied || loading}
                  >
                    <CircleCheck className="size-4" aria-hidden="true" />
                    {saApplied ? pick(l, L.saApplied) : pick(l, L.saApply)}
                  </Button>
                </div>
              </div>
              {/* POLIR4 A: zasebnost (0 omrežja) + kraji so izhodišče načrta
                  (kot pri povezavah/besedilu) — ne prisilna pot. */}
              {saResult.source.kind === "import" && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.importPrivacy)} {pick(l, L.importOriginNote)}
                </p>
              )}
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {pick(l, L.saHint)}
          </p>
        </CardContent>
      </Card>

      {/* POLIR A (2.28.0), naloga 2: 3-korakov onboarding trak — statičen,
          diskreten (text-xs, muted), brez zapiranja/cookies. Iskrena
          mikrocopy poti do načrta. */}
      <ol
        aria-label={pick(l, L.stepsLabel)}
        className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground"
      >
        <li className="inline-flex items-center gap-1.5">
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded-full border bg-muted font-semibold tabular-nums"
            aria-hidden="true"
          >
            1
          </span>
          {pick(l, L.stepOne)}
        </li>
        <li aria-hidden="true" className="text-muted-foreground/50">→</li>
        <li className="inline-flex items-center gap-1.5">
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded-full border bg-muted font-semibold tabular-nums"
            aria-hidden="true"
          >
            2
          </span>
          {pick(l, L.stepTwo)}
        </li>
        <li aria-hidden="true" className="text-muted-foreground/50">→</li>
        <li className="inline-flex items-center gap-1.5">
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded-full border bg-muted font-semibold tabular-nums"
            aria-hidden="true"
          >
            3
          </span>
          {pick(l, L.stepThree)}
        </li>
      </ol>

      {/* OBRAZEC */}
      <Card className="mt-3" id="nacrtuj-obrazec">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            {pick(l, L.formTitle)}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.formLead)}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* P1 (2.24.0): prosti opis → SKRIPTNI NLU → deterministični motor */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <Label htmlFor="nl-input">{pick(l, L.nlTitle)}</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="nl-input"
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void understandNl();
                  }
                }}
                placeholder={pick(l, L.nlPlaceholder)}
                maxLength={400}
                className="min-h-11 flex-1"
                disabled={nlBusy || loading}
              />
              <Button
                type="button"
                onClick={() => void understandNl()}
                disabled={nlBusy || loading || nlInput.trim().length < 4}
                className="min-h-11"
              >
                {nlBusy ? pick(l, L.nlBusy) : pick(l, L.nlButton)}
              </Button>
            </div>
            {nlError && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {nlError}
              </p>
            )}
            {/* POLIR A (2.28.0), naloga 1: ONE-CLICK PRIMERI — klik zgolj
                ZAPOLNI vnos (ne generira): uporabnik vidi besedilo, ga lahko
                prilagodi in pritisne gumb — iskreno in predvidljivo.
                Stili čipov = obstoječi interest čipi, a min-h-11 (44 px). */}
            <div className="mt-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {pick(l, L.examplesLabel)}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {NL_EXAMPLES.map((ex) => {
                  const text = pick(l, ex);
                  return (
                    <li key={text}>
                      <button
                        type="button"
                        onClick={() => {
                          setNlInput(text);
                          setNlError(null);
                          document.getElementById("nl-input")?.focus();
                        }}
                        aria-label={`${pick(l, L.exampleUse)}: ${text}`}
                        className="inline-flex min-h-11 items-center rounded-full border bg-background px-3.5 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                        disabled={nlBusy || loading}
                      >
                        {text}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {pick(l, L.nlHint)}
            </p>
          </div>
          {/* Izbrani interesi */}
          {form.interests.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {pick(l, L.selectedInterests)} ({form.interests.length})
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {form.interests.map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => toggleInterest(label)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {/* QA U4: prikaz je PREVEDEN (interestDisplay), identiteta
                          žetona ostane kanonska — motor in ključi se ne
                          spreminjajo; neznan žeton → surova oblika. */}
                      {interestDisplay(label, l)}
                      <X className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        {pick(l, L.remove)}: {interestDisplay(label, l)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prosti vnos */}
          <div>
            <Label htmlFor="interests-custom">{pick(l, L.customLabel)}</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="interests-custom"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomInterests();
                  }
                }}
                placeholder={pick(l, L.customPlaceholder)}
                className="min-h-11 flex-1"
              />
              <Button type="button" variant="secondary" onClick={addCustomInterests} className="min-h-11">
                <Plus className="size-4" aria-hidden="true" />
                {pick(l, L.customAdd)}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Čipi */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="chip-search">{pick(l, L.interestsLabel)}</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="chip-search"
                  value={chipSearch}
                  onChange={(e) => setChipSearch(e.target.value)}
                  placeholder={pick(l, L.searchChips)}
                  className="h-9 w-56 pl-8"
                />
              </div>
            </div>
            <div
              className={`scrollbar-slim mt-3 flex flex-wrap gap-2 overflow-y-auto pr-1 ${
                showAllChips || chipSearch ? "max-h-96" : "max-h-44"
              }`}
            >
              {visibleChips.length === 0 && (
                <p className="text-sm text-muted-foreground">{pick(l, L.noChipsFound)}</p>
              )}
              {visibleChips.map((chip) => {
                const active = form.interests.includes(chip.label);
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => toggleInterest(chip.label)}
                    aria-pressed={active}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      active
                        ? "border-primary/50 bg-primary/10 font-medium text-primary"
                        : "bg-background text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {/* QA U4: preveden prikaz čipa (kanon ostane chip.label). */}
                    {interestDisplay(chip.label, l)}
                    <span className="text-xs text-muted-foreground" aria-hidden="true">
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {!chipSearch && chips.length > POPULAR_CHIPS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 min-h-11"
                onClick={() => setShowAllChips((v) => !v)}
              >
                {showAllChips ? (
                  <>
                    <ChevronUp className="size-4" aria-hidden="true" />
                    {pick(l, L.showLess)}
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" aria-hidden="true" />
                    {pick(l, L.showAll)} ({chips.length})
                  </>
                )}
              </Button>
            )}
          </div>

          <Separator />

          {/* Dnevi + filtri */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="days-stepper">{pick(l, L.daysLabel)}</Label>
              <div
                id="days-stepper"
                className="mt-2 flex items-center gap-2"
                role="group"
                aria-label={pick(l, L.daysLabel)}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setForm((f) => ({ ...f, days: Math.max(1, f.days - 1) }))}
                  disabled={form.days <= 1}
                >
                  <span aria-hidden="true">−</span>
                  <span className="sr-only">{pick(l, L.fewerDays)}</span>
                </Button>
                <span className="min-w-16 text-center text-lg font-bold tabular-nums">
                  {form.days}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {pick(l, L.daysUnit)}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setForm((f) => ({ ...f, days: Math.min(5, f.days + 1) }))}
                  disabled={form.days >= 5}
                >
                  <span aria-hidden="true">+</span>
                  <span className="sr-only">{pick(l, L.moreDays)}</span>
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="region-select">{pick(l, L.regionLabel)}</Label>
              <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                <SelectTrigger id="region-select" className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{pick(l, L.regionAny)}</SelectItem>
                  {Object.entries(REGIONS).map(([id, r]) => (
                    <SelectItem key={id} value={id}>
                      {pick(l, r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* F5 (#41): državni filter — "cel Balkan" je privzeti in pomeni,
                da čezmejni načrti dovoljeni (vidni prehodi + dokumenti). */}
            <div>
              <Label htmlFor="country-select">{pick(l, L.countryLabel)}</Label>
              <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                <SelectTrigger id="country-select" className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{pick(l, L.countryAny)}</SelectItem>
                  {ALL_COUNTRY_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {COUNTRIES[code].flag} {COUNTRIES[code].names[lang] ?? code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="season-select">{pick(l, L.seasonLabel)}</Label>
              <Select value={form.season} onValueChange={(v) => setForm((f) => ({ ...f, season: v }))}>
                <SelectTrigger id="season-select" className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{pick(l, L.seasonAny)}</SelectItem>
                  {SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {pick(l, s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="budget-select">{pick(l, L.budgetLabel)}</Label>
              <Select value={form.budget} onValueChange={(v) => setForm((f) => ({ ...f, budget: v }))}>
                <SelectTrigger id="budget-select" className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{pick(l, L.budgetAny)}</SelectItem>
                  {BUDGETS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {pick(l, b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="min-h-12 w-full text-base sm:w-auto"
            onClick={() => void generate(form)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                {pick(l, L.generating)}
              </>
            ) : (
              <>
                <Wand2 className="size-5" aria-hidden="true" />
                {pick(l, L.generate)}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* NAPAKA */}
      {error && (
        <Alert variant="destructive" className="mt-6" role="alert">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>{pick(l, L.errorTitle)}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => void generate(form)}>
              {pick(l, L.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* REZULTAT */}
      <section id="nacrt-rezultat" className="mt-10 scroll-mt-24" aria-live="polite">
        {loading && !plan && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {!loading && !plan && !error && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <RouteIcon className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="font-semibold">{pick(l, L.emptyTitle)}</p>
              <p className="max-w-md text-sm text-muted-foreground">{pick(l, L.emptyBody)}</p>
            </CardContent>
          </Card>
        )}

        {plan && (
          <PlanResult
            plan={plan}
            lang={lang}
            requestedDays={form.days}
            saved={savedMsg}
            onSave={saveToMyTrip}
            onGo={startGo}
            pdfBusy={pdfBusy}
            pdfError={pdfError}
            onPdf={() => void exportPdf()}
            compareForm={form}
            onBudgetPick={pickBudget}
            onReorder={handleReorder}
            onResetOrder={handleResetOrder}
            manualOrder={manualOrder}
            loading={loading}
          />
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prikaz načrta: povzetek + dnevi s časovnico
// ---------------------------------------------------------------------------

/** POLIR2 A: najdi dan + mesto postanka z id-jem (id-ji so globalno unikatni). */
function findStop(
  days: TripStop[][],
  stopId: string
): { dayIdx: number; stopIdx: number } | null {
  for (let d = 0; d < days.length; d++) {
    const i = days[d].findIndex((s) => s.id === stopId);
    if (i !== -1) return { dayIdx: d, stopIdx: i };
  }
  return null;
}

/** POLIR2 A: kam spada cilj vlečenja — postanek (dan + mesto) ali cona
 *  praznega dneva (id „day-N“ iz EmptyDayDropZone). */
function locateTarget(
  days: TripStop[][],
  overId: string
): { dayIdx: number; stopIdx?: number } | null {
  const stop = findStop(days, overId);
  if (stop) return stop;
  const m = overId.match(/^day-(\d+)$/);
  if (m) {
    const dayIdx = Number(m[1]);
    if (dayIdx >= 0 && dayIdx < days.length) return { dayIdx };
  }
  return null;
}

function PlanResult({
  plan,
  lang,
  requestedDays,
  saved,
  onSave,
  onGo,
  pdfBusy,
  pdfError,
  onPdf,
  // POLIR A (2.28.0), naloga 3: primerjalnik proračunov — variante za
  // TRENUTNE izbire obrazca; klik preklopi raven in regenerira načrt.
  compareForm,
  onBudgetPick,
  // POLIR2 A (2.29.0): povleci-in-spusti — spust vlečenja pokliče onReorder
  // (novi dnevi že s preračunanimi časi prek PlannerApp.handleReorder);
  // onResetOrder povrne čist vrstni red motorja.
  onReorder,
  onResetOrder,
  manualOrder,
  loading,
}: {
  plan: ItineraryPlan;
  lang: PlannerLang;
  /** Zahtevano št. dni (iz obrazca) — za iskreno opombo o manjkajočih dneh. */
  requestedDays: number;
  saved: boolean;
  onSave: () => void;
  onGo: () => void;
  /** QA U10: PDF izvoz (stanje + akcija iz PlannerApp). */
  pdfBusy: boolean;
  pdfError: string | null;
  onPdf: () => void;
  /** POLIR A (2.28.0): obrazec za primerjalnik (izbire + aktivna raven). */
  compareForm: FormState;
  onBudgetPick: (b: Budget) => void;
  /** POLIR2 A: ročno preurejanje dni (dnd-kit). */
  onReorder: (newDays: TripStop[][]) => void;
  onResetOrder: () => void;
  manualOrder: boolean;
  loading: boolean;
}) {
  const l = useLocale();
  // POLIR2 A: lokalni PREDogled vlečenja (premik MED dnevi brez preračuna
  // časov — časi se preračunajo šele ob spustu) + aria-live naznanilo
  // zadnjega premika (samo za bralnike zaslona). Predogled velja SAMO za
  // načrt, ob katerem je nastal — regeneracija (nov objekt plan) ga
  // samodejno razveljavi, brez čiščenja v efektu.
  const [preview, setPreview] = useState<{
    plan: ItineraryPlan;
    days: TripStop[][];
  } | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  // POLIR2 B (2.29.0): sinhronizacija seznam ↔ zemljevid (Wanderlog
  // vzorec) — hover/fokus vrstice poudari marker; klik markerja poudari
  // vrstico in zadrsi do nje.
  const [highlightStopId, setHighlightStopId] = useState<string | null>(null);
  const previewDays = preview?.plan === plan ? preview.days : null;
  const days = previewDays ?? plan.days;

  // POLIR5 A (2.32.0): IZMERJENI dnevi iz odgovora proxyja (OSRM distance/
  // duration). Stanje je VEZANO NA REFERENCO dni (isti kanon kot poti v
  // PlanMap in predogled vlečenja): velja samo za `days`, ob katerih je
  // nastalo — regeneracija/reurejanje (nova referenca) ga samodejno
  // razveljavi, zato povzetek NIKOLI ne kaže številk tujega vrstnega reda.
  const [measuredState, setMeasuredState] = useState<{
    forDays: TripStop[][];
    stats: MeasuredDay[];
  } | null>(null);
  const handleMeasured = useCallback(
    (stats: MeasuredDay[]) => setMeasuredState({ forDays: days, stats }),
    [days]
  );
  const measured = measuredState?.forDays === days ? measuredState.stats : null;

  // Čista presodba povzetka (vrstica pod glavo dneva + skupna vrstica).
  // SAMO nad izmerjenimi dnevi — padli dnevi se izrecno preštejejo
  // (Roadtrippersova past izklopljenih točk: mešana vsota bi tiho lagala).
  const measuredSummary = useMemo(
    () => (measured ? summarizeMeasured(days.length, measured) : null),
    [measured, days.length]
  );

  // POLIR2 B: klik markerja → poudarek + mehko drsenje do vrstice
  // (iskanje po data-stop-id). POZOR: `CSS` je tu dnd-kitov pomočnik,
  // zato brskalnikov CSS.escape klicemo prek globalThis (ni senčen).
  // Manjka escape (starejši brskalniki) → nedolžen id (slugi so varni).
  const handleMarkerClick = useCallback((stopId: string) => {
    setHighlightStopId(stopId);
    if (typeof document !== "undefined") {
      const browserCss = (globalThis as { CSS?: { escape?: (v: string) => string } })
        .CSS;
      const safeId = browserCss?.escape ? browserCss.escape(stopId) : stopId;
      const el = document.querySelector(`[data-stop-id="${safeId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Sensorji: kazalec (8 px vzdržljivosti — klik na vrstico ne odlepi
  // vlečenja) + tipkovnica (sortableKeyboardCoordinates: puščice premikajo
  // tudi MED dnevi, preslednica dvigne/spusti).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Predogled MED dnevi (onDragOver): premik brez preračuna časov — uporabnik
  // vidi KJE bo postanek pristal; urnik se preračuna pošteno šele ob spustu.
  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const { active, over } = e;
      if (!over) return;
      const current = previewDays ?? plan.days;
      const from = findStop(current, String(active.id));
      if (!from) return;
      const target = locateTarget(current, String(over.id));
      if (!target) return;
      // Znotraj istega dneva predogleda ni (vrstni red se zamenja šele ob
      // spustu — standardna semantika razvrščljivih seznamov/dnd-kit).
      if (target.dayIdx === from.dayIdx) return;
      const toIndex =
        target.stopIdx !== undefined ? target.stopIdx : current[target.dayIdx].length;
      setPreview({
        plan,
        days: moveStop(current, String(active.id), target.dayIdx, toIndex),
      });
    },
    [previewDays, plan]
  );

  // Končni spust (onDragEnd): izračun končnega dne + mesta → moveStop →
  // preračun časov obeh dotaknjenih dni → onReorder + aria-live naznanilo.
  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      // Končno stanje izračunamo iz PREDogleda (WYSIWYG), naj ga počistimo.
      const current = previewDays ?? plan.days;
      setPreview(null);
      if (!over) return;
      const activeId = String(active.id);
      const from = findStop(current, activeId);
      if (!from) return;
      const target = locateTarget(current, String(over.id));
      if (!target) return;
      // Spust na prazno-dnevno cono → konec dneva; spust na postanek →
      // njegovo mesto (pri vlečenju navzdol konča ZA njim, navzgor PRED njim
      // — semantika arrayMove, ki jo uporabniki pričakujejo od seznamov).
      const toIndex =
        target.stopIdx !== undefined ? target.stopIdx : current[target.dayIdx].length;
      const moved = current[from.dayIdx][from.stopIdx];
      let newDays = moveStop(current, activeId, target.dayIdx, toIndex);
      if (isSameOrder(plan.days, newDays)) return; // spust brez spremembe
      // Časi na obeh dotaknjenih dneh po kanonu motorja (ostali dnevi so že
      // preračunani ali bajtno enaki — recomputeDayTimes je idempotenten).
      newDays = newDays.map((stops, i) =>
        i === from.dayIdx || i === target.dayIdx ? recomputeDayTimes(stops) : stops
      );
      const finalIdx = newDays[target.dayIdx].findIndex((s) => s.id === activeId);
      setAnnouncement(
        pick(l, L.movedAnnouncement)(
          moved.name,
          recomputeDayTitle(target.dayIdx, newDays[target.dayIdx], lang),
          finalIdx + 1
        )
      );
      onReorder(newDays);
    },
    [previewDays, plan, lang, l, onReorder]
  );

  const handleDragCancel = useCallback(() => setPreview(null), []);

  const allStops = plan.days.flat();
  const regions = new Set(allStops.map((s) => s.region).filter(Boolean));

  return (
    <div>
      {/* Povzetek trak */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight">{plan.title}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {plan.summary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <RouteIcon className="size-3.5" aria-hidden="true" />
                {L.daysWord[lang](plan.days.length)}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {L.stopsWord[lang](allStops.length)}
              </Badge>
              {regions.size > 0 && (
                <Badge variant="secondary">{L.regionsWord[lang](regions.size)}</Badge>
              )}
              <Badge className="gap-1 bg-primary text-primary-foreground">
                {formatMoney(plan.totalCost, lang)}
                <span className="font-normal opacity-80">{pick(l, L.totalCost)}</span>
              </Badge>
              {manualOrder && (
                // POLIR2 A: iskrena značka — vrstni red ni več motorjev
                // (amber outline, vidna tudi v natisu — načrt je resnično
                // ročno preurejen in to mora ostati razkrito tudi na papirju).
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/60 text-amber-700 dark:text-amber-400"
                >
                  <GripVertical className="size-3.5" aria-hidden="true" />
                  {pick(l, L.manualBadge)}
                </Badge>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold">{pick(l, L.coverage)}: </span>
            {plan.coverageNote}
          </p>
          {/* POLIR5 A (2.32.0): SKUPNA IZMERJENA vrstica — SAMO nad izmerjenimi
              dnevi (OSRM/OpenStreetMap); vidna TUDI v natisu (dnevi so vir
              resnice, izmerna pa je del povzetka, ne zemljevida). Ni nobenega
              izmerjenega dneva → vrstice NI (iskrena odsotnost, ne laž). */}
          {measuredSummary && measuredSummary.totalKm !== null && measuredSummary.totalMin !== null && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {pick(l, L.measuredTotal)(
                fmtKm1(l, measuredSummary.totalKm),
                formatDuration(measuredSummary.totalMin)
              )}
            </p>
          )}
          {/* Iskrena opomba o dnevih BREZ izmere (padli/neupravičeni) —
              izrecno število, ocena se pokaže pod glavo teh dni. */}
          {measuredSummary &&
            measuredSummary.totalKm !== null &&
            measuredSummary.failedCount > 0 && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {pick(l, L.measuredMissing)(measuredSummary.failedCount)}
              </p>
            )}
          {manualOrder && (
            // POLIR2 A: mikrovrstica z razlago preračuna (vidna tudi v natisu).
            <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              {pick(l, L.manualNote)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* F5 (#41): ČEZMEJNI BLOK — viden SAMO pri čezmejnem načrtu.
          Prehodi so IZPELJANI iz držav postankov (motor, deterministično);
          dokumenti iz preverjenih virov (EU — glej border-docs.ts) + iskren
          namig k MZV RS za pogoje, ki jih ta vir ne potrjuje. Vidno tudi
          v natisu (break-inside-avoid). */}
      {plan.borderCrossings && plan.borderCrossings.length > 0 && (() => {
        const docBlock = borderDocBlock(
          allStops.map((s) => s.country ?? "").filter(Boolean)
        );
        if (docBlock.length === 0) return null;
        return (
          <div className="mt-6 print:break-inside-avoid">
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RouteIcon className="size-4" aria-hidden="true" />
                  {pick(l, L.borderBlockTitle)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Prehodi po vrsti potovanja (izpeljano iz načrta). */}
                <div>
                  <p className="text-sm font-semibold">
                    {pick(l, L.borderCrossingsHeading)}
                  </p>
                  <ol className="mt-2 space-y-1.5">
                    {plan.borderCrossings.map((c, i) => (
                      <li
                        key={`${c.from}-${c.to}-${c.day}-${i}`}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <Badge variant="outline" className="font-mono text-xs">
                          {pick(l, L.borderDay)} {c.day}
                        </Badge>
                        <span aria-hidden="true">{COUNTRIES[c.from as keyof typeof COUNTRIES]?.flag ?? "🏳"} → {COUNTRIES[c.to as keyof typeof COUNTRIES]?.flag ?? "🏳"}</span>
                        <span>
                          {COUNTRIES[c.from as keyof typeof COUNTRIES]?.names[lang] ?? c.from}
                          {" → "}
                          {COUNTRIES[c.to as keyof typeof COUNTRIES]?.names[lang] ?? c.to}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Dokumenti po državah (preverjeni viri + iskren namig). */}
                <div>
                  <p className="text-sm font-semibold">{pick(l, L.borderDocsHeading)}</p>
                  <ul className="mt-2 space-y-3">
                    {docBlock.map((d) => (
                      <li
                        key={d.code}
                        className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span aria-hidden="true" className="text-base">{d.flag}</span>
                          <span className="font-semibold">{d.nameSl}</span>
                          <Badge
                            variant="outline"
                            className={
                              d.schengen
                                ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                                : "border-amber-500/50 text-amber-700 dark:text-amber-400"
                            }
                          >
                            {d.schengen ? pick(l, L.borderSchengen) : pick(l, L.borderNonSchengen)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {pick(l, L.borderCurrency)}: {d.currency}
                          </span>
                        </div>
                        <p className="mt-1.5">{pick(l, d.doc)}</p>
                        <a
                          href={d.mzzUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2"
                        >
                          {pick(l, L.borderOfficial)}: MZV RS — {d.code}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Iskren vir — kaj je preverjeno in kaj ostaja uporabniku. */}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {pick(l, L.borderSourceNote)}{" "}
                  <a
                    href={SCHENGEN_SOURCE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    home-affairs.ec.europa.eu
                  </a>{" · "}
                  <a
                    href={EU_DOCS_SOURCE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    europa.eu/youreurope
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* POLIR2 B (2.29.0): ZEMLJEVID NAČRTA — dnevno obarvani številčni
          markerji + črtkane premočrtne povezave (iskrena opomba o premočrtni
          povezavi je znotraj komponente). Klientanski dinamični uvoz —
          Leaflet potrebuje window (ssr: false, Skeleton med nalaganjem).
          V natisu se zemljevid izpusti (print:hidden): kartice dneva so
          vir resnice, ploščice se natisnejo nezanesljivo. */}
      <div className="mt-6 print:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{pick(l, L.mapTitle)}</CardTitle>
            <p className="text-xs text-muted-foreground">{pick(l, L.mapDesc)}</p>
          </CardHeader>
          <CardContent>
            <PlanMap
              days={days}
              highlightId={highlightStopId}
              onMarkerClick={handleMarkerClick}
              onMeasured={handleMeasured}
            />
          </CardContent>
        </Card>
      </div>

      {/* POLIR A (2.28.0), naloga 3: PRIMERJALNIK PRORAČUNOV — 3 ravni,
          številke IZKLJUČNO iz motorja (ocena, ne obljuba). Prikazan samo
          ob obstoječem načrtu; brez layout shifta (isti render kot načrt). */}
      <BudgetCompare
        form={compareForm}
        lang={lang}
        loading={loading}
        onPick={onBudgetPick}
      />

      {/* ISKRENA OPOZORILNA PLOŠČICA: manjkajoči dnevi (kanon 2.26.0) —
          coverageNote vsebuje podrobnost, a je v drobnem besedilu;
          uporabnik ki skenira dneve mora takoj videti zakaj manjka dan. */}
      {plan.days.length < requestedDays && (
        <div
          role="note"
          className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <Info className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="leading-relaxed text-amber-900 dark:text-amber-200">
            {pick(l, L.fewerDaysNote)(requestedDays, plan.days.length)}
          </p>
        </div>
      )}

      {/* Dnevi s časovnico — POLIR2 A (2.29.0): POVLECI-IN-SPUSTI urejanje
          dni (Wanderlog vzorec). EN DndContext okoli VSEH dni omogoča
          vlečenje znotraj dneva IN med dnevi; brez DragOverlay (preprosto
          domače premikanje). Ročica je edini aktivator, zato pomikanje
          strani po vrstici deluje normalno. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Tipkovnična navodila (sr-only — bralcem zaslonov ob vsakem načrtu) */}
        <p className="sr-only">{pick(l, L.dragKeyboardHint)}</p>
        <div className="mt-6 space-y-6">
          {days.map((stops, dayIdx) => {
            const dayTitle =
              plan.dayTitles?.[dayIdx] ?? (lang === "en" ? `Day ${dayIdx + 1}` : `Dan ${dayIdx + 1}`);
            const dayCost = stops.reduce((s, x) => s + x.cost, 0);
            // POLIR5 A (2.32.0): vrstica IZMERE POD GLAVO DNEVA (Wanderlog
            // pariteta — „total time and distance … under that day's
            // heading"). Izmerjen dan → izmerjeno (OSRM); drugače → ISTA
            // hevristika kot LegRow, izrecno označena kot ocena. Dan brez
            // vožnje (manj kot 2 postanka) → vrstice ni (iskrena odsotnost).
            // Vidna TUDI v natisu — je del povzetka dneva (vir resnice so
            // kartice dni, zemljevid se v natisu izpusti, ta vrstica pa NE).
            const mRow = measuredSummary?.rows[dayIdx];
            const est = mRow?.kind === "estimate" ? dayEstimate(stops) : null;
            return (
              <Card key={dayIdx}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{dayTitle}</CardTitle>
                    <Badge variant="outline" className="gap-1">
                      {formatMoney(dayCost, lang)}
                    </Badge>
                  </div>
                  {mRow?.kind === "measured" && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      <span className="sr-only">{pick(l, L.measuredSrPrefix)}</span>
                      {pick(l, L.measuredDay)(fmtKm1(l, mRow.km), mRow.min)}
                    </p>
                  )}
                  {mRow?.kind === "estimate" && est && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      <span className="sr-only">{pick(l, L.measuredSrPrefix)}</span>
                      {pick(l, L.estimatedDay)(est.km, est.min)}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <SortableContext
                    items={stops.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <DayTimeline
                      stops={stops}
                      lang={lang}
                      highlightId={highlightStopId}
                      onHighlight={setHighlightStopId}
                    />
                  </SortableContext>
                  {stops.length === 0 && <EmptyDayDropZone dayIdx={dayIdx} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {/* aria-live naznanilo zadnjega premika (POLIR2 A, samo za bralnike
            zaslonov — dnd-kit s tipkovnico sicer sporoča premike sam, to je
            naše potrditveno naznanilo končnega mesta po spustu) */}
        <div role="status" aria-live="polite" className="sr-only">
          {announcement ?? ""}
        </div>
      </DndContext>

      {/* Akcije */}
      <div className="mt-6 flex flex-wrap gap-3">
        {manualOrder && (
          // POLIR2 A: povrnitev čistega vrstnega reda motorja (iskrena
          // razveljavitev ročnega preurejanja — samo ko je načrt ročno preurejen).
          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="min-h-12"
            onClick={onResetOrder}
            aria-label={pick(l, L.resetOrderAria)}
          >
            <Undo2 className="size-5" aria-hidden="true" />
            {pick(l, L.resetOrder)}
          </Button>
        )}
        <Button type="button" size="lg" className="min-h-12" onClick={onSave}>
          {saved ? (
            <>
              <CircleCheck className="size-5" aria-hidden="true" />
              {pick(l, L.saved)}
            </>
          ) : (
            <>
              <Save className="size-5" aria-hidden="true" />
              {pick(l, L.save)}
            </>
          )}
        </Button>
        <Button type="button" size="lg" variant="secondary" className="min-h-12" onClick={onGo}>
          <Footprints className="size-5" aria-hidden="true" />
          {pick(l, L.go)}
        </Button>
        {/* QA U10: poenoten nabor izvozov — Izvozi PDF (živ tok kot na
            /potovanje in /pot) + Koledar (.ics) iskreno onemogočen. */}
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-12"
          onClick={onPdf}
          disabled={pdfBusy}
        >
          {pdfBusy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="size-5" aria-hidden="true" />
          )}
          {pdfBusy ? pick(l, L.pdfBusy) : pick(l, L.pdfBtn)}
        </Button>
        {/* QA U10: .ics brez realnih datumov je ONEMOGOČEN z iskrenim
            napotilom (buildTripIcs fail-closed vrne null — nikoli
            izmišljeni „približni“ datumi). */}
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-12"
          disabled
          title={pick(l, L.icsNoDatesTitle)}
          aria-describedby="nacrtuj-ics-hint"
        >
          <CalendarDays className="size-5" aria-hidden="true" />
          {pick(l, L.icsBtn)}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-12"
          onClick={() => window.print()}
        >
          <Printer className="size-5" aria-hidden="true" />
          {pick(l, L.print)}
        </Button>
        <Button asChild type="button" size="lg" variant="ghost" className="min-h-12">
          <Link href="/potovanje">
            {pick(l, L.openJourney)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {pdfError && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {pdfError}
        </p>
      )}
      <p id="nacrtuj-ics-hint" className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {pick(l, L.icsNoDates)}
      </p>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {pick(l, L.deterministic)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// POLIR A (2.28.0), naloga 3: PRIMERJALNIK PRORAČUNOV (3 ravni)
// ---------------------------------------------------------------------------

/**
 * Kompakten primerjalnik treh proračunskih ravni nad prikazanim načrtom
 * (Varčno € / Zmerno €€ / Brez omejitve €€€). Vsaka kartica kaže št.
 * postankov, oceno skupne cene na osebo in št. regij — VSE iz motora.
 *
 * Implementacija: variante izračuna NEPOSDREDNO s čisto funkcijo motorja
 * (buildItinerary — isti modul kot /api/itinerary; 0 strežniških
 * odvisnosti, 0 omrežja, 0 AI) za TRENUTNE izbire obrazca — klik na
 * kartico torej regenerira NATANKO tisto, kar kartica obljublja.
 * Relaksacijo filtra (pool < dni×2 → engine sprosti budget filter)
 * izpeljemo iz istega registra (budgetTier + regija); zrcalo je
 * zaklenjeno v tests/nacrtuj-polir.test.ts proti coverageNote motorja.
 *
 * Iskrenost: številke so OCENE (besedilo motora že pravi „ocena X € na
 * osebo“); sprostitve in izpuščeni dražji postanki so razkrite na kartici.
 */
function BudgetCompare({
  form,
  lang,
  loading,
  onPick,
}: {
  form: FormState;
  lang: PlannerLang;
  loading: boolean;
  onPick: (b: Budget) => void;
}) {
  const l = useLocale();

  const variants = useMemo(() => {
    // ISTA normalizacija kot POST /api/itinerary (trim/lowercase/dedup/12),
    // da so variante bajtno enake regeneraciji prek API-ja.
    const interests = [
      ...new Set(
        form.interests.map((s) => s.trim().toLowerCase()).filter(Boolean)
      ),
    ].slice(0, 12);
    const region = form.region !== "all" ? form.region : undefined;
    const season = (form.season !== "any" ? form.season : undefined) as
      | Season
      | undefined;
    // Locale kanon /api/itinerary: vsebina načrta je sl/en — številke
    // (postanki/cena/regije) so od jezikov neodvisne, izbira pa ista.
    const locale: PlannerLang = lang === "en" ? "en" : "sl";
    return COMPARE_TIERS.map((tier) => {
      const p = buildItinerary({
        interests,
        days: form.days,
        region,
        season,
        budget: tier.value,
        locale,
      });
      const stops = p.days.flat();
      return {
        tier,
        stops: stops.length,
        cost: p.totalCost,
        regions: new Set(stops.map((s) => s.region).filter(Boolean)).size,
        // Zrcalo motorjeve relaksacije: pool (regija ∧ budget) < dni × 2
        // → engine sprosti filter (PLANNER_MSG.budgetRelaxed v coverageNote).
        relaxed:
          DESTINATIONS.filter(
            (d) =>
              (!region || d.region === region) &&
              budgetTier(d.budget) <= budgetTier(tier.value)
          ).length < form.days * 2,
      };
    });
  }, [form, lang]);

  // Referenca za „manj postankov zaradi filtra“ je €€€ (dovoljuje vse).
  const ref = variants[variants.length - 1];
  // „any“ (brez filtra) ≡ €€€ (dovoljuje vse ravni) — zato je €€€ aktivna
  // tudi, ko je v spustnem meniju izbrano „Brez omejitve“ brez €-znakov.
  const active: Budget =
    form.budget === "€" || form.budget === "€€" ? form.budget : "€€€";

  // Brez interesov API iskreno zavrne (400) — kartice takrat ne kažemo,
  // saj ne morejo obljubiti številk, ki jih ni mogoče regenerirati.
  if (form.interests.length === 0) return null;

  return (
    <section className="mt-4" aria-labelledby="primerjalnik-proracunov">
      <div className="flex items-center gap-2">
        <Scale className="size-4 text-primary" aria-hidden="true" />
        <h3 id="primerjalnik-proracunov" className="text-sm font-bold tracking-tight">
          {pick(l, L.compareTitle)}
        </h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {pick(l, L.compareLead)}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {variants.map((v) => {
          const isActive = v.tier.value === active;
          return (
            <button
              key={v.tier.value}
              type="button"
              onClick={() => onPick(v.tier.value)}
              disabled={loading}
              aria-pressed={isActive}
              className={`flex min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 ${
                isActive
                  ? "border-primary/50 bg-primary/5"
                  : "bg-card hover:border-primary/30 hover:bg-accent/50"
              }`}
            >
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {pick(l, v.tier)}
                {isActive && (
                  <Badge variant="secondary" className="gap-1">
                    <CircleCheck className="size-3" aria-hidden="true" />
                    {pick(l, L.compareCurrent)}
                  </Badge>
                )}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="tabular-nums">{L.stopsWord[lang](v.stops)}</span>
                <span className="tabular-nums">{L.regionsWord[lang](v.regions)}</span>
                <span className="tabular-nums font-medium text-foreground">
                  {pick(l, L.compareEstimate)} {formatMoney(v.cost, lang)} ·{" "}
                  {pick(l, L.totalCost)}
                </span>
              </span>
              {v.relaxed ? (
                <span className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                  {pick(l, L.compareRelaxed)}
                </span>
              ) : v.stops < ref.stops ? (
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {pick(l, L.compareFiltered)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// POLIR5 A (2.32.0): pomoži IZMERJENIH razdalj — dayEstimate + fmtKm1 sta se
// POLIR6 A (2.33.0) PRESTAVILI v @/lib/plan-map-data (EN izvor resnice za
// vse poglede poti: /nacrtuj, /potovanje, /pot/[shareId]) — tukaj sta samo
// še UVOŽENI (obnašanje povzetka načrta NEPREMJENJENO).
// ---------------------------------------------------------------------------

/** Noga vožnje med postankoma (iskrena ocena, vir: hevristika). */
function LegRow({
  prev,
  stop,
  lang,
}: {
  prev: TripStop;
  stop: TripStop;
  lang: PlannerLang;
}) {
  const l = useLocale();
  if (!prev.coords || !stop.coords) return null;
  const km = round5(roadKm(prev.coords, stop.coords));
  const min = travelMinutes(prev.coords, stop.coords);
  const label = pick(l, L.driveEstimate);
  return (
    <div className="flex items-center gap-3 py-2 pl-4 sm:pl-6" aria-label={`${label}: ~${km} km, ~${min} min`}>
      <span className="h-6 w-px bg-border" aria-hidden="true" />
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        <RouteIcon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{label}: </span>
        ~{km} km · ~{min} min · {label}
      </span>
    </div>
  );
}

/**
 * POLIR2 A (2.29.0): VLEČLJIVA VRSTICA POSTANKA — wrapper <li> nosi
 * transform/transition (standardni dnd-kit pristop brez DragOverlay),
 * ročica GripVertical pa je EDINI aktivator (listeners/attributes samo
 * na njej — vlečenje ne ugrabi klikov po vrstici, pomikanje strani
 * drugje deluje normalno; Wanderlog vzorec). Tipkovnica: fokus ročice +
 * preslednica dvigne, puščice premikajo, preslednica spusti.
 */
function SortableStopRow({
  stop,
  prev,
  lang,
  highlighted,
  onHover,
}: {
  stop: TripStop;
  prev?: TripStop;
  lang: PlannerLang;
  /** POLIR2 B: vrstica je poudarjena (klik markerja na zemljevidu). */
  highlighted?: boolean;
  /** POLIR2 B: hover/fokus → poudarek markerja; odhod → ponastavitev. */
  onHover?: (id: string | null) => void;
}) {
  const l = useLocale();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition ?? undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-stop-id={stop.id}
      className={isDragging ? "relative z-10" : undefined}
      onMouseEnter={() => onHover?.(stop.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(stop.id)}
      onBlur={() => onHover?.(null)}
    >
      {prev && <LegRow prev={prev} stop={stop} lang={lang} />}
      <div className="flex items-start gap-1.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={`mt-3 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden ${
            isDragging ? "cursor-grabbing" : ""
          }`}
          aria-label={`${pick(l, L.dragHandle)}: ${stop.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <div
          className={`min-w-0 flex-1 rounded-xl transition-colors ${
            highlighted
              ? "bg-accent/50 ring-2 ring-primary/60"
              : ""
          }`}
        >
          <StopRow stop={stop} lang={lang} />
        </div>
      </div>
    </li>
  );
}

/** POLIR2 A: cona za spust v PRAZEN dan (dan, ki ga je uporabnik izpraznil
 *  z vlečenjem — črtkana obroba, iskreno prazno stanje z možnostjo vračila). */
function EmptyDayDropZone({ dayIdx }: { dayIdx: number }) {
  const l = useLocale();
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayIdx}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-16 items-center justify-center rounded-xl border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors ${
        isOver ? "border-primary/60 bg-primary/5" : "border-border"
      }`}
    >
      {pick(l, L.dropHere)}
    </div>
  );
}

/**
 * Časovnica dneva s segmenti Jutro/Popoldan/Večer (P0-D, kanon izvirnika):
 * glava segmenta + poštene etape (~km/~min) tudi preko mej segmentov.
 * POLIR2 A: vsak postanek je ovit v SortableStopRow (vlečenje po kanonu
 * dnd-kit — vrstni red dneva določa vrstni red v SortableContext). */
function DayTimeline({
  stops,
  lang,
  highlightId,
  onHighlight,
}: {
  stops: TripStop[];
  lang: PlannerLang;
  /** POLIR2 B: id poudarjenega postanka (obroba vrstice) ali null. */
  highlightId?: string | null;
  /** POLIR2 B: hover/fokus vrstice → poudarek markerja na zemljevidu. */
  onHighlight?: (id: string | null) => void;
}) {
  const groups = buildDaySegments(stops);
  const indexOf = new Map(stops.map((s, i) => [s.id, i]));
  return (
    <div>
      {groups.map((group) => (
        <section key={group.segment + `-${group.stops[0]?.id ?? "0"}`}>
          <DaySegmentHeader segment={group.segment} count={group.stops.length} />
          <ol>
            {group.stops.map((stop) => {
              const i = indexOf.get(stop.id) ?? 0;
              return (
                <SortableStopRow
                  key={stop.id}
                  stop={stop}
                  prev={i > 0 ? stops[i - 1] : undefined}
                  lang={lang}
                  highlighted={highlightId === stop.id}
                  onHover={onHighlight}
                />
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Vrstica postanka: čas, ime, tip, trajanje, cena, regija. */
function StopRow({ stop, lang }: { stop: TripStop; lang: PlannerLang }) {
  const l = useLocale();
  const kindLabel = typeLabel(stop.kind, lang);
  const regionTxt = stop.region ? regionLabel(stop.region, lang) : "";
  return (
    <div className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-accent/50">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary">
        <StopKindIcon kind={stop.kind} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-bold tabular-nums">{stop.time ?? "—"}</span>
          <span className="font-semibold">{stop.name}</span>
          <Badge variant="outline" className="text-[11px]">
            {kindLabel}
          </Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="sr-only">{pick(l, L.duration)}: </span>
            {formatDuration(stop.durationMin, lang)}
          </span>
          <span>
            <span className="sr-only">{pick(l, L.cost)}: </span>
            {stop.cost === 0 ? pick(l, L.free) : formatMoney(stop.cost, lang)}
          </span>
          {regionTxt && <span>{regionTxt}</span>}
        </p>
      </div>
    </div>
  );
}
