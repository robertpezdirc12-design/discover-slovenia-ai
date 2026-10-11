"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  FileDown,
  Footprints,
  Info,
  Link2,
  Loader2,
  Plus,
  Printer,
  Route as RouteIcon,
  Save,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
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
  formatDuration,
  formatMoney,
  interestChips,
  roadKm,
  round5,
  travelMinutes,
  type PlannerLang,
} from "@/lib/itinerary-engine";
import { myTrip } from "@/lib/my-trip";
import { interestDisplay } from "@/lib/interests-i18n";
import { saveLastPlan } from "@/lib/plan-store";
import { buildTripPdf, fromItineraryPlan } from "@/lib/pdf/trip-pdf-doc";
import { downloadTripPdf } from "@/lib/pdf/trip-pdf-render";
import { buildDaySegments } from "@/lib/day-segments";
import { normalizeInterests, REGIONS, regionLabel, typeLabel } from "@/lib/slovenia-data";
import type { Budget, Season } from "@/lib/slovenia-data";
import type { ItineraryPlan, TripStop } from "@/lib/types";

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
    sl: "Izberi želje — deterministični motor sestavi dnevni načrt iz kanonskih podatkov 38 destinacij. Isti vhod vedno da isti načrt (0 AI žetonov, 0 presenečenj).",
    en: "Pick your wishes — the deterministic engine builds a day plan from the canonical data of 38 destinations. The same input always yields the same plan (0 AI tokens, 0 surprises).",
    it: "Scegli i tuoi desideri — il motore deterministico costruisce un piano giornaliero dai dati canonici di 38 destinazioni. Lo stesso input dà sempre lo stesso piano (0 token AI, 0 sorprese).",
    de: "Wähle deine Wünsche — die deterministische Engine erstellt aus den kanonischen Daten von 38 Reisezielen einen Tagesplan. Gleiche Eingabe ergibt immer denselben Plan (0 KI-Tokens, 0 Überraschungen).",
    fr: "Choisis tes envies — le moteur déterministe construit un plan quotidien à partir des données canoniques de 38 destinations. La même entrée donne toujours le même plan (0 jeton d’IA, 0 surprise).",
    es: "Elige tus deseos — el motor determinista construye un plan diario con los datos canónicos de 38 destinos. La misma entrada da siempre el mismo plan (0 fichas de IA, 0 sorpresas).",
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
    sl: "Prilepi povezavo (YouTube, članek, TikTok) ali besedilo o potovanju — skripta prepozna kraje iz registra 38 destinacij in predlaga izhodišče za načrtovalnika. 0 AI, 0 ugibanj.",
    en: "Paste a link (YouTube, an article, TikTok) or text about a trip — a script recognizes places from the register of 38 destinations and proposes a starting point for the planner. 0 AI, no guessing.",
    it: "Incolla un link (YouTube, un articolo, TikTok) o un testo sul viaggio — uno script riconosce i luoghi dal registro di 38 destinazioni e propone un punto di partenza. 0 IA, nessuna ipotesi.",
    de: "Füge einen Link (YouTube, ein Artikel, TikTok) oder einen Text über eine Reise ein — ein Skript erkennt Orte aus dem Register von 38 Reisezielen und schlägt einen Ausgangspunkt vor. 0 KI, kein Rätselraten.",
    fr: "Colle un lien (YouTube, un article, TikTok) ou un texte sur un voyage — un script reconnaît les lieux du registre de 38 destinations et propose un point de départ. 0 IA, aucune devinette.",
    es: "Pega un enlace (YouTube, un artículo, TikTok) o un texto sobre un viaje — un script reconoce los lugares del registro de 38 destinos y propone un punto de partida. 0 IA, sin suposiciones.",
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
// Stran
// ---------------------------------------------------------------------------

export default function PlanPage() {
  const l = useLocale();
  const { ctx: nextStepCtx, ready: nextStepReady } = useNextStepContext();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />
      {nextStepReady && (
        <div className="mt-8">
          <NextStepCard ctx={nextStepCtx} surface="plan" />
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
  season: string;
  budget: string;
}

/** P2 (2.25.0): odgovor /api/start-anywhere (skriptni Start Anywhere). */
interface SaResult {
  engine: string;
  source:
    | { kind: "url"; host: string; title: string | null }
    | { kind: "text"; chars: number };
  matches: {
    slug: string;
    name: string;
    type: string;
    region: string;
    evidence: string;
    needle: string;
    kind: "stem" | "exact";
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
  const [plan, setPlan] = useState<ItineraryPlan | null>(null);
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
        setPlan(data as ItineraryPlan);
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
            <Button
              type="button"
              onClick={() => void runStartAnywhere()}
              disabled={saBusy || loading || saInput.trim().length < 4}
              className="min-h-11"
            >
              {saBusy ? pick(l, L.saBusy) : pick(l, L.saButton)}
            </Button>
          </div>
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
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {pick(l, L.saHint)}
          </p>
        </CardContent>
      </Card>

      {/* OBRAZEC */}
      <Card className="mt-8" id="nacrtuj-obrazec">
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
          />
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prikaz načrta: povzetek + dnevi s časovnico
// ---------------------------------------------------------------------------

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
}) {
  const l = useLocale();
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
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold">{pick(l, L.coverage)}: </span>
            {plan.coverageNote}
          </p>
        </CardContent>
      </Card>

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

      {/* Dnevi s časovnico */}
      <div className="mt-6 space-y-6">
        {plan.days.map((stops, dayIdx) => {
          const dayTitle =
            plan.dayTitles?.[dayIdx] ?? (lang === "en" ? `Day ${dayIdx + 1}` : `Dan ${dayIdx + 1}`);
          const dayCost = stops.reduce((s, x) => s + x.cost, 0);
          return (
            <Card key={dayIdx}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{dayTitle}</CardTitle>
                  <Badge variant="outline" className="gap-1">
                    {formatMoney(dayCost, lang)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <DayTimeline stops={stops} lang={lang} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Akcije */}
      <div className="mt-6 flex flex-wrap gap-3">
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
 * Časovnica dneva s segmenti Jutro/Popoldan/Večer (P0-D, kanon izvirnika):
 * glava segmenta + poštene etape (~km/~min) tudi preko mej segmentov.
 */
function DayTimeline({
  stops,
  lang,
}: {
  stops: TripStop[];
  lang: PlannerLang;
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
                <li key={stop.id}>
                  {i > 0 && <LegRow prev={stops[i - 1]} stop={stop} lang={lang} />}
                  <StopRow stop={stop} lang={lang} />
                </li>
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
