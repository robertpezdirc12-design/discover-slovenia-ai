"use client";

import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  Check,
  CircleCheck,
  CloudUpload,
  ExternalLink,
  FileDown,
  Footprints,
  Info,
  Loader2,
  MapPin,
  Printer,
  Route as RouteIcon,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { DaySegmentHeader } from "@/components/day-segment-header";
import { StopKindIcon } from "@/components/plan/plan-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { asPickLocale, pick } from "@/lib/i18n-pick";
import { intlDateLocale } from "@/lib/intl-locale";
import {
  buildPlanFromMyTrip,
  formatDuration,
  formatMoney,
  osmDirectionsUrl,
  roadKm,
  round5,
  travelMinutes,
  validatePlanGeo,
  type GeoValidation,
  type PlannerLang,
} from "@/lib/itinerary-engine";
import { useMyTripList } from "@/lib/my-trip";
import { interestDisplay } from "@/lib/interests-i18n";
// POLIR6 A (2.33.0): čisti pomoži IZMERJENIH dni (EN izvor resnice — isti
// kot na /nacrtuj; ocena dneva = ISTA hevristika kot LegRow, km pa nosijo
// 1 decimalko po jeziku, EN pika / ostali vejica — determinizem brez Intl).
import {
  dayEstimate,
  fmtKm1,
  summarizeMeasured,
  type MeasuredDay,
} from "@/lib/plan-map-data";
import { loadLastPlan, type SavedPlan } from "@/lib/plan-store";
import { buildTripPdf, fromItineraryPlan } from "@/lib/pdf/trip-pdf-doc";
import { downloadTripPdf } from "@/lib/pdf/trip-pdf-render";
import { sharedPlans, type SharedPlan } from "@/lib/shared-plan";
import { randomShareIdClient } from "@/lib/share-id";
import { buildDaySegments } from "@/lib/day-segments";
import { regionLabel, typeLabel } from "@/lib/slovenia-data";
import type { ItineraryPlan, MyTripItem, TripStop } from "@/lib/types";

/**
 * /potovanje — JOURNEY PLANNER pogled (rekonstrukcija po Task 58 + mirror):
 * časovnica dnevnega načrta (dai:last-plan ali osnutek iz dai:my-trip),
 * dnevna navigacija, akcija Navigiraj (OSM directions — legal, brez ključev)
 * in sekcija ISKRENIH opozoril (geo-časovna validacija po vzorcu P0.2:
 * sosednja postanka — razdalja in ocena vožnje ~60 km/h).
 * POLIR3 B (2.30.0): + ZEMLJEVID POTI — vsi dnevi načrta na enem pogledu
 * (isti PlanMap kot na /nacrtuj; pariteta s /pot/[shareId]).
 */

// POLIR3 B (2.30.0): ZEMLJEVID POTI — klientanski dinamični uvoz (Leaflet
// dostopa do window že ob uvozu modula → ssr: false je OBVEZEN; Skeleton
// prepreči layout shift med nalaganjem). Imenovani export PlanMap iz
// @/components/plan/plan-map — ISTA komponenta kot na /nacrtuj (2.29.0),
// zemljevid ni podvojen.
const PlanMap = dynamic(
  () => import("@/components/plan/plan-map").then((m) => m.PlanMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-xl sm:h-80" />,
  }
);

const L = {
  kicker: { sl: "Potovanje", en: "Journey", it: "Viaggio", de: "Reise", fr: "Voyage", es: "Viaje" },
  title: { sl: "Tvoje potovanje", en: "Your journey", it: "Il tuo viaggio", de: "Deine Reise", fr: "Ton voyage", es: "Tu viaje" },
  lead: {
    sl: "Dnevna časovnica zadnjega načrta (ali osnutka iz Moje poti) z navigacijo in iskreno preverbo izvedljivosti — brez izmišljenih podatkov.",
    en: "The daily timeline of your last plan (or a draft from My trip) with navigation and an honest feasibility check — no invented data.",
    it: "La timeline giornaliera del tuo ultimo piano (o di una bozza da Il mio viaggio) con navigazione e un onesto controllo di fattibilità — senza dati inventati.",
    de: "Die tägliche Timeline deines letzten Plans (oder eines Entwurfs aus Meine Reise) mit Navigation und einer ehrlichen Machbarkeitsprüfung — ohne erfundene Daten.",
    fr: "Le fil chronologique quotidien de ton dernier plan (ou d'un brouillon de Mon voyage) avec navigation et un contrôle honnête de faisabilité — sans données inventées.",
    es: "La línea de tiempo diaria de tu último plan (o de un borrador de Mi viaje) con navegación y una comprobación honesta de viabilidad — sin datos inventados.",
  },
  dayNav: { sl: "Dnevi poti", en: "Trip days", it: "Giorni del viaggio", de: "Reisetage", fr: "Jours du voyage", es: "Días del viaje" },
  day: {
    sl: (n: number) => `Dan ${n}`,
    en: (n: number) => `Day ${n}`,
    it: (n: number) => `Giorno ${n}`,
    de: (n: number) => `Tag ${n}`,
    fr: (n: number) => `Jour ${n}`,
    es: (n: number) => `Día ${n}`,
  },
  timelineTitle: { sl: "Časovnica dneva", en: "Day timeline", it: "Timeline della giornata", de: "Tages-Timeline", fr: "Timeline de la journée", es: "Línea de tiempo del día" },
  navigate: { sl: "Navigiraj", en: "Navigate", it: "Naviga", de: "Navigieren", fr: "Naviguer", es: "Navegar" },
  duration: { sl: "trajanje", en: "duration", it: "durata", de: "Dauer", fr: "durée", es: "duración" },
  cost: { sl: "cena", en: "cost", it: "costo", de: "Kosten", fr: "coût", es: "coste" },
  free: { sl: "brezplačno", en: "free", it: "gratis", de: "kostenlos", fr: "gratuit", es: "gratis" },
  driveEstimate: { sl: "ocena vožnje", en: "drive estimate", it: "stima di guida", de: "geschätzte Fahrt", fr: "estimation du trajet", es: "estimación del trayecto" },
  dayTotal: { sl: "Danes skupaj", en: "Day total", it: "Totale giornata", de: "Tagessumme", fr: "Total du jour", es: "Total del día" },
  warningsTitle: { sl: "Iskrena opozorila", en: "Honest warnings", it: "Avvisi onesti", de: "Ehrliche Warnungen", fr: "Avertissements honnêtes", es: "Avisos honestos" },
  warningsLead: {
    sl: "Preverjanje izvedljivosti: prekrivanja časov, dolgi presledki in razdalje med sosednjima postankoma (ocena vožnje ~60 km/h, premočna razdalja ×1,3 — ni podatka o prometu v realnem času).",
    en: "Feasibility check: schedule overlaps, long gaps and distances between adjacent stops (drive estimate ~60 km/h, straight-line ×1.3 — no real-time traffic data).",
    it: "Controllo di fattibilità: sovrapposizioni di orari, lunghi intervalli e distanze tra tappe adiacenti (stima di guida ~60 km/h, distanza in linea d'aria ×1,3 — nessun dato sul traffico in tempo reale).",
    de: "Machbarkeitsprüfung: Zeitüberschneidungen, lange Lücken und Distanzen zwischen benachbarten Stopps (geschätzte Fahrt ~60 km/h, Luftlinie ×1,3 — keine Echtzeit-Verkehrsdaten).",
    fr: "Contrôle de faisabilité : chevauchements d'horaires, longs intervalles et distances entre étapes adjacentes (estimation du trajet ~60 km/h, distance à vol d'oiseau ×1,3 — pas de données de trafic en temps réel).",
    es: "Comprobación de viabilidad: solapamientos de horarios, huecos largos y distancias entre paradas adyacentes (estimación del trayecto ~60 km/h, distancia en línea recta ×1,3 — sin datos de tráfico en tiempo real).",
  },
  allClear: {
    sl: "Ni opozoril: časi in razdalje so znotraj udobnih okvirjev (po oceni).",
    en: "No warnings: times and distances are within comfortable limits (estimated).",
    it: "Nessun avviso: orari e distanze rientrano in limiti comodi (stimati).",
    de: "Keine Warnungen: Zeiten und Distanzen liegen innerhalb komfortabler Grenzen (geschätzt).",
    fr: "Aucun avertissement : horaires et distances restent dans des limites confortables (estimés).",
    es: "Sin avisos: horarios y distancias están dentro de límites cómodos (estimados).",
  },
  worstOk: { sl: "PREVERJENO · OK", en: "CHECKED · OK", it: "VERIFICATO · OK", de: "GEPRÜFT · OK", fr: "VÉRIFIÉ · OK", es: "VERIFICADO · OK" },
  worstWarn: { sl: "OPOZORILO", en: "WARNING", it: "AVVISO", de: "WARNUNG", fr: "AVERTISSEMENT", es: "AVISO" },
  worstError: { sl: "NI IZVEDLJIVO (po urniku)", en: "NOT FEASIBLE (per schedule)", it: "NON FATIBILE (secondo il programma)", de: "NICHT MACHBAR (laut Zeitplan)", fr: "NON RÉALISABLE (selon l'horaire)", es: "NO VIABLE (según el horario)" },
  metricsTitle: { sl: "Metrike po dnevih", en: "Per-day metrics", it: "Metriche per giorno", de: "Metriken pro Tag", fr: "Mesures par jour", es: "Métricas por día" },
  km: { sl: "km vožnje", en: "km of driving", it: "km di guida", de: "km Fahrt", fr: "km de conduite", es: "km de conducción" },
  driveMin: { sl: "min vožnje", en: "min driving", it: "min di guida", de: "Min Fahrt", fr: "min de conduite", es: "min de conducción" },
  activityMin: { sl: "min aktivnosti", en: "min of activities", it: "min di attività", de: "Min Aktivität", fr: "min d'activités", es: "min de actividades" },
  stopsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
    it: (n: number) => `${n} ${n === 1 ? "tappa" : "tappe"}`,
    de: (n: number) => `${n} ${n === 1 ? "Stopp" : "Stopps"}`,
    fr: (n: number) => `${n} ${n === 1 ? "étape" : "étapes"}`,
    es: (n: number) => `${n} ${n === 1 ? "parada" : "paradas"}`,
  },
  sourcePlan: {
    sl: "Vir: zadnji načrt z /nacrtuj (shranjen lokalno).",
    en: "Source: the last plan from /nacrtuj (stored locally).",
    it: "Fonte: l'ultimo piano da /nacrtuj (salvato in locale).",
    de: "Quelle: der letzte Plan von /nacrtuj (lokal gespeichert).",
    fr: "Source : le dernier plan de /nacrtuj (stocké localement).",
    es: "Fuente: el último plan de /nacrtuj (guardado localmente).",
  },
  sourceDraft: {
    sl: "Vir: osnutek iz zbirke „Moja pot“ (tvoj vrstni red) — časi so predlogi.",
    en: "Source: a draft from your “My trip” collection (your order) — times are proposals.",
    it: "Fonte: una bozza dalla collezione «Il mio viaggio» (il tuo ordine) — gli orari sono proposte.",
    de: "Quelle: ein Entwurf aus der Sammlung „Meine Reise“ (deine Reihenfolge) — Zeiten sind Vorschläge.",
    fr: "Source : un brouillon de la collection « Mon voyage » (ton ordre) — les horaires sont des propositions.",
    es: "Fuente: un borrador de la colección «Mi viaje» (tu orden) — los horarios son propuestas.",
  },
  unmatchedTitle: { sl: "Brez lokacije", en: "Without a location", it: "Senza località", de: "Ohne Ort", fr: "Sans lieu", es: "Sin ubicación" },
  unmatchedBody: {
    sl: "Ti zapisi zbirke nimajo kanonske destinacije — razdalj in ur zanje ni mogoče preveriti:",
    en: "These collection entries have no canonical destination — distances and times cannot be checked for them:",
    it: "Queste voci della collezione non hanno una destinazione canonica — per loro non è possibile verificare distanze e orari:",
    de: "Diese Sammlungseinträge haben kein kanonisches Reiseziel — Distanzen und Zeiten lassen sich für sie nicht prüfen:",
    fr: "Ces entrées de collection n'ont pas de destination canonique — les distances et horaires ne peuvent pas être vérifiés pour elles :",
    es: "Estas entradas de la colección no tienen un destino canónico — no se pueden comprobar distancias ni horarios para ellas:",
  },
  emptyTitle: { sl: "Ni še nobenega potovanja", en: "No journey yet", it: "Ancora nessun viaggio", de: "Noch keine Reise", fr: "Pas encore de voyage", es: "Aún no hay viaje" },
  emptyBody: {
    sl: "Sestavi deterministični načrt na /nacrtuj ali dodaj destinacije v Moja pot — potovanje se bo naredilo samo.",
    en: "Build a deterministic plan at /nacrtuj or add destinations to My trip — the journey will assemble itself.",
    it: "Crea un piano deterministico su /nacrtuj o aggiungi destinazioni a Il mio viaggio — il viaggio si assemblerà da solo.",
    de: "Erstelle einen deterministischen Plan auf /nacrtuj oder füge Reiseziele zu Meine Reise hinzu — die Reise stellt sich von selbst zusammen.",
    fr: "Crée un plan déterministe sur /nacrtuj ou ajoute des destinations à Mon voyage — le voyage s'assemblera tout seul.",
    es: "Crea un plan determinista en /nacrtuj o añade destinos a Mi viaje — el viaje se ensamblará solo.",
  },
  ctaPlan: { sl: "Načrtuj novo", en: "Plan a new one", it: "Pianifica uno nuovo", de: "Einen neuen planen", fr: "En planifier un nouveau", es: "Planifica uno nuevo" },
  pdfBtn: { sl: "Izvozi PDF", en: "Export PDF", it: "Esporta PDF", de: "PDF exportieren", fr: "Exporter en PDF", es: "Exportar PDF" },
  pdfBusy: { sl: "Pripravljam PDF …", en: "Preparing PDF …", it: "Preparo il PDF …", de: "PDF wird vorbereitet …", fr: "Préparation du PDF …", es: "Preparando PDF …" },
  pdfErr: { sl: "PDF izvoz ni uspel — poskusi znova.", en: "PDF export failed — try again.", it: "Esportazione PDF non riuscita — riprova.", de: "PDF-Export fehlgeschlagen — bitte erneut versuchen.", fr: "Échec de l'export PDF — réessaie.", es: "Fallo al exportar PDF — reinténtalo." },
  // QA U4 (2026-10-11): interesi, ki so sestavili načrt (plan.meta.interests),
  // prevedeni v jezik vmesnika — prej kanonski slovenski žetoni v EN UI.
  interestsLabel: { sl: "Interesi", en: "Interests", it: "Interessi", de: "Interessen", fr: "Centres d’intérêt", es: "Intereses" },
  // QA U10 (2026-10-11): poenoten nabor izvozov z /nacrtuj in /pot/[shareId].
  print: { sl: "Natisni", en: "Print", it: "Stampa", de: "Drucken", fr: "Imprimer", es: "Imprimir" },
  icsBtn: { sl: "Koledar (.ics)", en: "Calendar (.ics)", it: "Calendario (.ics)", de: "Kalender (.ics)", fr: "Calendrier (.ics)", es: "Calendario (.ics)" },
  // QA U10: ta pogled NIMA realnih datumov (dai:last-plan jih ne nosi;
  // določijo se na deljeni poti) → buildTripIcs fail-closed vrne null.
  // Iskrena onemogočitev + napotilo; QR koda tu iskreno MANJKA (vsak URL,
  // ki bi ga lahko kodirali, bi bil zavajajoč — /potovanje je napravno-
  // lokalen pogled, /pot/[shareId] pa za to pot ne obstaja).
  icsNoDatesTitle: { sl: "Najprej shrani datume", en: "Save the dates first", it: "Prima salva le date", de: "Zuerst die Daten speichern", fr: "Enregistre d'abord les dates", es: "Primero guarda las fechas" },
  icsNoDates: {
    sl: "Koledar (.ics) potrebuje realne datume, QR koda pa deljeno povezavo poti — shrani pot kot skupinsko pot (gumb zgoraj); datume in QR kodo najdeš na deljeni poti (/pot/…).",
    en: "The calendar (.ics) needs real dates and the QR code needs a shared trip link — save the trip as a shared trip (button above); the dates and the QR code live on the shared trip (/pot/…).",
    it: "Il Calendario (.ics) richiede date reali e il codice QR un link condiviso del viaggio — salva il viaggio come viaggio condiviso (pulsante sopra); date e codice QR si trovano sul viaggio condiviso (/pot/…).",
    de: "Der Kalender (.ics) braucht echte Daten und der QR-Code einen geteilten Reise-Link — speichere die Reise als geteilte Reise (Schaltfläche oben); Daten und QR-Code findest du auf der geteilten Reise (/pot/…).",
    fr: "Le Calendrier (.ics) nécessite de vraies dates et le code QR un lien partagé du voyage — enregistre le voyage comme voyage partagé (bouton ci-dessus) ; les dates et le code QR se trouvent sur le voyage partagé (/pot/…).",
    es: "El Calendario (.ics) necesita fechas reales y el código QR un enlace compartido del viaje — guarda el viaje como viaje compartido (botón arriba); las fechas y el código QR están en el viaje compartido (/pot/…).",
  },
  ctaGo: { sl: "Zaženi na poti", en: "Start on the road", it: "Parti per la strada", de: "Los geht's auf der Straße", fr: "Prends la route", es: "Sal a la carretera" },
  cloudSave: {
    sl: "Shrani kot skupinsko pot",
    en: "Save as a shared trip",
    it: "Salva come viaggio condiviso",
    de: "Als geteilte Reise speichern",
    fr: "Enregistrer comme voyage partagé",
    es: "Guardar como viaje compartido",
  },
  cloudSaveLogin: {
    sl: "Prijavi se in shrani v oblak",
    en: "Sign in and save to the cloud",
    it: "Accedi e salva nel cloud",
    de: "Melde dich an und speichere in der Cloud",
    fr: "Connecte-toi et enregistre dans le cloud",
    es: "Inicia sesión y guarda en la nube",
  },
  cloudSaving: { sl: "Shranjujem …", en: "Saving …", it: "Salvataggio …", de: "Speichern …", fr: "Enregistrement …", es: "Guardando …" },
  cloudPerks: {
    sl: "Oblak odklene: vabila sotopotnikom, skupne ankete, rezervacije in klepet z @AI svetovalcem.",
    en: "The cloud unlocks: invitations for companions, shared polls, reservations and the @AI advisor chat.",
    it: "Il cloud sblocca: inviti ai compagni, sondaggi condivisi, prenotazioni e chat con il consulente @AI.",
    de: "Die Cloud schaltet frei: Einladungen an Mitreisende, gemeinsame Umfragen, Reservierungen und der Chat mit dem @AI-Berater.",
    fr: "Le cloud déverrouille : invitations aux compagnons, sondages partagés, réservations et le chat avec le conseiller @AI.",
    es: "La nube desbloquea: invitaciones para acompañantes, encuestas compartidas, reservas y el chat con el asesor @AI.",
  },
  cloudErr: {
    sl: "Shranjevanje v oblak ni uspelo",
    en: "Saving to the cloud failed",
    it: "Salvataggio nel cloud non riuscito",
    de: "Speichern in der Cloud fehlgeschlagen",
    fr: "Échec de l'enregistrement dans le cloud",
    es: "No se pudo guardar en la nube",
  },
  savedAt: { sl: "Shranjeno", en: "Saved", it: "Salvato", de: "Gespeichert", fr: "Enregistré", es: "Guardado" },
  totalTrip: { sl: "Celotno potovanje", en: "Whole trip", it: "Viaggio completo", de: "Ganze Reise", fr: "Voyage complet", es: "Viaje completo" },
  perPerson: { sl: "na osebo", en: "per person", it: "a persona", de: "pro Person", fr: "par personne", es: "por persona" },
  // POLIR C (2.28.0): print pariteta z /pot/[shareId] (kanon shared-trip-view) —
  // čist podpis SAMO ob tiskanju: kdaj natisnjeno + iskren vir podatkov (ta
  // pogled je napravno-lokalen, zato ni deljene povezave kot v shared nogi).
  printStamp: { sl: "Natisnjeno", en: "Printed", it: "Stampato", de: "Gedruckt", fr: "Imprimé", es: "Impreso" },
  printSrcPlan: {
    sl: "vir: zadnji načrt (lokalna shramba)",
    en: "source: last plan (local storage)",
    it: "fonte: ultimo piano (memoria locale)",
    de: "Quelle: letzter Plan (lokaler Speicher)",
    fr: "source : dernier plan (stockage local)",
    es: "fuente: último plan (almacenamiento local)",
  },
  printSrcDraft: {
    sl: "vir: osnutek Moje pot (časi so predlogi)",
    en: "source: My trip draft (times are proposals)",
    it: "fonte: bozza Il mio viaggio (gli orari sono proposte)",
    de: "Quelle: Entwurf Meine Reise (Zeiten sind Vorschläge)",
    fr: "source : brouillon Mon voyage (les horaires sont des propositions)",
    es: "fuente: borrador de Mi viaje (los horarios son propuestas)",
  },
  // POLIR3 B (2.30.0): zemljevid poti — naslov in legenda kartice (isti
  // ključi kot v shared-trip-view: pot je skupna obema pogledoma).
  mapTitle: { sl: "Zemljevid poti", en: "Trip map", it: "Mappa del viaggio", de: "Reisekarte", fr: "Carte du voyage", es: "Mapa del viaje" },
  mapDesc: {
    sl: "Položaji postankov po dnevih — barva in številka pomenita dan.",
    en: "Stop positions by day — colour and number stand for the day.",
    it: "Posizioni delle tappe per giorno — colore e numero indicano il giorno.",
    de: "Positionen der Stopps nach Tag — Farbe und Nummer stehen für den Tag.",
    fr: "Positions des arrêts par jour — couleur et numéro désignent le jour.",
    es: "Posiciones de las paradas por día — color y número indican el día.",
  },
  // POLIR6 A (2.33.0): IZMERJENE razdalje na „Moja pot" (pariteta
  // /nacrtuj 2.32.0 — besedila DOBESEEDNO iz nacrtuj/view.tsx; vsaka
  // številka nosi razložljiv vir: izmerjeno OSRM ali izrecno ocena;
  // vsota združuje SAMO izmerjene dneve — Roadtrippersova past).
  measuredDay: {
    sl: (km: string, min: number) => `${km} km · ${min} min vožnje — izmerjeno (OSRM/OpenStreetMap)`,
    en: (km: string, min: number) => `${km} km · ${min} min of driving — measured (OSRM/OpenStreetMap)`,
    it: (km: string, min: number) => `${km} km · ${min} min di guida — misurato (OSRM/OpenStreetMap)`,
    de: (km: string, min: number) => `${km} km · ${min} Min. Fahrt — gemessen (OSRM/OpenStreetMap)`,
    fr: (km: string, min: number) => `${km} km · ${min} min de conduite — mesuré (OSRM/OpenStreetMap)`,
    es: (km: string, min: number) => `${km} km · ${min} min de conducción — medido (OSRM/OpenStreetMap)`,
  },
  estimatedDay: {
    sl: (km: number, min: number) => `~ ${km} km · ~ ${min} min — ocena (premočna ×1,3 @ ~60 km/h)`,
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

type Source = "planner" | "my-trip";

interface JourneyData {
  plan: ItineraryPlan;
  source: Source;
  savedAt?: string;
  unmatched: MyTripItem[];
}

export default function JourneyPage() {
  const l = useLocale();
  const lang: PlannerLang = asPickLocale(l);
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const myItems = useMyTripList();
  const [data, setData] = useState<JourneyData | null>(null);
  const [ready, setReady] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Hidracija: localStorage se bere TEKOM mounta (SSR/klient se strinjata).
  useEffect(() => {
    const hydrate = () => {
      const saved: SavedPlan | null = loadLastPlan();
      if (saved && saved.plan.days.length > 0) {
        setData({ plan: saved.plan, source: "planner", savedAt: saved.savedAt, unmatched: [] });
      } else {
        const draft = buildPlanFromMyTrip(myItems, lang);
        if (draft.plan.days.length > 0) {
          setData({ plan: draft.plan, source: "my-trip", unmatched: draft.unmatched });
        } else {
          setData(null);
        }
      }
      setReady(true);
    };
    hydrate();
  }, []);

  // Če ni shranjenega načrta, osnutek sledi živi zbirki.
  useEffect(() => {
    if (!ready || (data?.source ?? "my-trip") !== "my-trip") return;
    const rebuildDraft = () => {
      const draft = buildPlanFromMyTrip(myItems, lang);
      setData(
        draft.plan.days.length > 0
          ? { plan: draft.plan, source: "my-trip", unmatched: draft.unmatched }
          : null
      );
      setDayIndex(0);
    };
    rebuildDraft();
  }, [myItems, ready]);

  const validation: GeoValidation | null = useMemo(
    () => (data ? validatePlanGeo(data.plan, lang) : null),
    [data, lang]
  );

  // POLIR6 A (2.33.0): IZMERJENI dnevi iz odgovora proxyja (OSRM distance/
  // duration) — isti kanon kot /nacrtuj 2.32.0. Stanje je VEZANO NA
  // REFERENCO dni (data.plan.days je stabilna referenca stanja fetcha):
  // regeneracija osnutka (my-trip) da novo referenco → pošteno ponovno
  // vezanje, zato vrstica NIKOLI ne kaže številk tujega vrstnega reda.
  const [measuredState, setMeasuredState] = useState<{
    forDays: TripStop[][];
    stats: MeasuredDay[];
  } | null>(null);
  const days = data?.plan.days ?? null;
  const handleMeasured = useCallback(
    (stats: MeasuredDay[]) => {
      if (days) setMeasuredState({ forDays: days, stats });
    },
    [days]
  );
  const measured = measuredState?.forDays === days ? measuredState.stats : null;

  // Čista presodba povzetka (vrstica trenutnega dneva + skupna vrstica) —
  // SAMO nad izmerjenimi dnevi (Roadtrippersova past: mešana vsota bi
  // tiho lagala; padli dnevi se izrecno preštejejo v opombo).
  const measuredSummary = useMemo(
    () => (measured && days ? summarizeMeasured(days.length, measured) : null),
    [measured, days]
  );

  // Vrstica izmere/ocene TRENUTNEGA dneva (menja se z dnevno navigacijo —
  // ISTA semantika kot /nacrtuj 2.32.0): izmerjen dan → izmerjeno (OSRM);
  // padel dan z oceno → ISTA hevristika kot LegRow (dayEstimate nad dnevi
  // načrta, ki nosijo koordinate); dan brez skoka → BREZ vrstice (iskrena
  // odsotnost). Print-VIDNA in neodvisna od zemljevida (< 2 točki).
  const currentTravelRow = (() => {
    if (!data) return null;
    const row = measuredSummary?.rows[dayIndex];
    if (row?.kind === "measured") {
      return { text: pick(l, L.measuredDay)(fmtKm1(l, row.km), row.min) };
    }
    if (row?.kind === "estimate") {
      const est = dayEstimate(data.plan.days[dayIndex] ?? []);
      if (est) return { text: pick(l, L.estimatedDay)(est.km, est.min) };
    }
    return null;
  })();

  /**
   * SHRANI KOT SKUPINSKO POT (kanon 2.26.0 — popravek P0 iz uporabniškega
   * audita): doslej NI bilo nobene UI poti do oblačne poti (dai:shared-plans
   * se nikoli ni zapisal) — sodelovanje, vabila, ankete, rezervacije in
   * klepet z @AI so bili iz UIja NEDOSEGLJIVI. Zdaj:
   *  1) načrt shrani LOKALNO kot deljeno pot (dai:shared-plans — /pot/[id]
   *     deluje tudi brez prijave, enaka naprava);
   *  2) prijavljenim takoj sinhronizira v oblak (POST /api/trips) — odklene
   *     sodelovanje v živo;
   *  3) preusmeri na /pot/[shareId].
   * Napake so iskrene (besedilo napake iz strežnika, nikoli tiho).
   */
  const saveTripToCloud = async () => {
    if (!data || cloudBusy) return;
    setCloudBusy(true);
    setCloudError(null);
    try {
      const shareId = randomShareIdClient();
      const plan = data.plan;
      const shared: SharedPlan = {
        shareId,
        name: plan.title,
        createdAt: new Date().toISOString(),
        days: plan.days.map((stops, dayIdx) => ({
          day: dayIdx + 1,
          locations: stops.map((s) => ({
            name: s.name,
            ...(s.slug ? { destSlug: s.slug } : {}),
            time: s.time,
          })),
        })),
        totalBudget: plan.totalCost,
      };
      // 1) Lokalno (deljena pot na tej napravi — tudi brez prijave/signala).
      sharedPlans.save(shared);
      // 2) Oblak — samo prijavljenim (sodelovanje, @AI, ankete, rezervacije).
      if (sessionStatus === "authenticated") {
        const r = await fetch("/api/trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan: shared, shareId, title: shared.name }),
        });
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
      }
      // 3) Pot je zdaj deljena — odpri pogled s sodelovanjem.
      router.push(`/pot/${shareId}`);
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : pick(l, L.cloudErr));
    } finally {
      setCloudBusy(false);
    }
  };

  /**
   * IZVOZI PDF (P5): deterministični izvoz trenutnega načrta — jsPDF +
   * podnaboran Liberation Sans (č/š/ž) se naložita ŠELE ob kliku (leni
   * chunk). Isti načrt + isti issuedAt → bitno isti PDF (dokazano s testi).
   */
  const exportPdf = async () => {
    if (!data || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const doc = buildTripPdf(fromItineraryPlan(data.plan, null), l);
      await downloadTripPdf(doc);
    } catch {
      setPdfError(pick(l, L.pdfErr));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />

      {!ready && (
        <div className="mt-8 space-y-4" aria-hidden="true">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      )}

      {ready && !data && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <RouteIcon className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">{pick(l, L.emptyTitle)}</p>
            <p className="max-w-md text-sm text-muted-foreground">{pick(l, L.emptyBody)}</p>
            <Button asChild size="lg" className="min-h-12">
              <Link href="/nacrtuj">
                <Wand2 className="size-5" aria-hidden="true" />
                {pick(l, L.ctaPlan)}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {ready && data && (
        <div className="mt-8">
          {/* Vir + povzetek */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="size-4" aria-hidden="true" />
              {data.source === "planner" ? pick(l, L.sourcePlan) : pick(l, L.sourceDraft)}
              {data.savedAt && (
                <span className="whitespace-nowrap">
                  · {pick(l, L.savedAt)}: {new Date(data.savedAt).toLocaleString(intlDateLocale(l))}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{pick(l, L.stopsWord)(data.plan.days.flat().length)}</Badge>
              <Badge className="gap-1 bg-primary text-primary-foreground">
                {formatMoney(data.plan.totalCost, lang)}
                <span className="font-normal opacity-80">{pick(l, L.perPerson)}</span>
              </Badge>
            </div>
          </div>

          {/* QA U4: interesi, ki so sestavili načrt — preveden prikaz
              (plan.meta.interests so kanonski žetoni motorja; neznan žeton
              → iskreno surova oblika). Osnutek iz Moje poti žetonov nima
              → vrstica čisto izpade (iskrena odsotnost). */}
          {data.plan.meta?.interests?.length ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold">{pick(l, L.interestsLabel)}:</span>
              {data.plan.meta.interests.map((i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {interestDisplay(i, l)}
                </Badge>
              ))}
            </p>
          ) : null}

          {/* Dnevna navigacija (kontrola — se NE tiska, kanon shared-trip-view) */}
          {data.plan.days.length > 1 && (
            <nav className="mt-4 print:hidden" aria-label={pick(l, L.dayNav)}>
              <ul className="flex flex-wrap gap-2">
                {data.plan.days.map((_, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setDayIndex(i)}
                      aria-current={i === dayIndex ? "true" : undefined}
                      className={`min-h-11 min-w-11 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                        i === dayIndex
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-foreground/80 hover:bg-accent"
                      }`}
                    >
                      <span className="sr-only">{pick(l, L.dayNav)}: </span>
                      {pick(l, L.day)(i + 1)}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Časovnica dneva */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>
                  {data.plan.dayTitles?.[dayIndex] ?? pick(l, L.day)(dayIndex + 1)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {pick(l, L.dayTotal)}:{" "}
                  {formatMoney(
                    (data.plan.days[dayIndex] ?? []).reduce((s, x) => s + x.cost, 0),
                    lang
                  )}
                </span>
              </CardTitle>
              {/* POLIR6 A (2.33.0): vrstica izmere/ocene TRENUTNEGA dneva POD
                  glavo dneva (ob dnevni ceni) — pariteta /nacrtuj 2.32.0:
                  vsaka številka nosi vir (izmerjeno OSRM ali izrecno
                  označena ocena). Print-VIDNA — del povzetka dneva (vir
                  resnice je kartica dneva, zemljevid se v natisu izpusti,
                  ta vrstica pa NE). DODATEK k obstoječi kartici: naslov,
                  cena in DayTimeline ostajajo nespremenjeni. */}
              {currentTravelRow && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  <span className="sr-only">{pick(l, L.measuredSrPrefix)}</span>
                  {currentTravelRow.text}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <DayTimeline
                stops={data.plan.days[dayIndex] ?? []}
                lang={lang}
              />
            </CardContent>
          </Card>

          {/* POLIR6 A (2.33.0): SKUPNA IZMERJENA vrstica (vsi dnevi) POD
              dnevno kartico — SAMO nad izmerjenimi dnevi + iskrena opomba
              o padlih (dvojina 1 dan/dni pravilna ×6). Print-VIDNA (kanon
              /nacrtuj — izmera je del povzetka poti, ne zemljevida). */}
          {measuredSummary &&
            measuredSummary.totalKm !== null &&
            measuredSummary.totalMin !== null && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {pick(l, L.measuredTotal)(
                  fmtKm1(l, measuredSummary.totalKm),
                  formatDuration(measuredSummary.totalMin)
                )}
              </p>
            )}
          {measuredSummary &&
            measuredSummary.totalKm !== null &&
            measuredSummary.failedCount > 0 && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {pick(l, L.measuredMissing)(measuredSummary.failedCount)}
              </p>
            )}

          {/* Neujemajoči zapisi (osnutek) */}
          {data.source === "my-trip" && data.unmatched.length > 0 && (
            <Card className="mt-4 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{pick(l, L.unmatchedTitle)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{pick(l, L.unmatchedBody)}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {data.unmatched.map((item) => (
                    <li key={item.refId}>
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {item.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* POLIR3 B (2.30.0): ZEMLJEVID POTI — vsi dnevi načrta na enem
              pogledu (dnevno obarvani številčni markerji + črtkane premočrtne
              povezave; iskreni opombi — premočrtna povezava, postanki brez
              koordinat — sta znotraj komponente PlanMap). Klientanski
              dinamični uvoz (ssr: false, Skeleton med nalaganjem). V natisu
              se zemljevid izpusti (print:hidden): časovnica dneva je vir
              resnice (kanon /nacrtuj). Pogojna izrisava: zemljevid stoji
              SAMO, kadar načrt dejansko nosi vsaj en postanek (prazno
              stanje ostane prazno — brez praznega zemljevida). Brez
              poudarka markerja/klika: ta pogled nima izbirnih vrstic. */}
          {data.plan.days.some((day) => day.length > 0) && (
            <div className="mt-4 print:hidden">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{pick(l, L.mapTitle)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{pick(l, L.mapDesc)}</p>
                </CardHeader>
                <CardContent>
                  <PlanMap days={data.plan.days} onMeasured={handleMeasured} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ISKRENA OPOZORILA */}
          {validation && <WarningsSection validation={validation} />}

          {/* Akcije (gumbi/izvozi — se NE tiska, kanon shared-trip-view) */}
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <Button asChild size="lg" className="min-h-12">
              <Link href="/na-poti?start=1">
                <Footprints className="size-5" aria-hidden="true" />
                {pick(l, L.ctaGo)}
              </Link>
            </Button>
            {sessionStatus === "authenticated" ? (
              <Button
                size="lg"
                variant="secondary"
                className="min-h-12"
                onClick={() => void saveTripToCloud()}
                disabled={cloudBusy}
              >
                {cloudBusy ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <CloudUpload className="size-5" aria-hidden="true" />
                )}
                {cloudBusy ? pick(l, L.cloudSaving) : pick(l, L.cloudSave)}
              </Button>
            ) : (
              <Button asChild size="lg" variant="secondary" className="min-h-12">
                <Link href="/prijava?next=/potovanje">
                  <CloudUpload className="size-5" aria-hidden="true" />
                  {pick(l, L.cloudSaveLogin)}
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="secondary" className="min-h-12">
              <Link href="/nacrtuj">
                <Wand2 className="size-5" aria-hidden="true" />
                {pick(l, L.ctaPlan)}
              </Link>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="min-h-12"
              onClick={() => void exportPdf()}
              disabled={pdfBusy}
            >
              {pdfBusy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="size-5" aria-hidden="true" />
              )}
              {pdfBusy ? pick(l, L.pdfBusy) : pick(l, L.pdfBtn)}
            </Button>
            {/* QA U10: Koledar (.ics) iskreno ONEMOGOČEN — ta pogled nima
                realnih datumov (nosijo jih deljene pote); nikoli izmišljenih
                „približnih“ datumov (buildTripIcs fail-closed). */}
            <Button
              size="lg"
              variant="secondary"
              className="min-h-12"
              disabled
              title={pick(l, L.icsNoDatesTitle)}
              aria-describedby="potovanje-ics-hint"
            >
              <CalendarDays className="size-5" aria-hidden="true" />
              {pick(l, L.icsBtn)}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="min-h-12"
              onClick={() => window.print()}
            >
              <Printer className="size-5" aria-hidden="true" />
              {pick(l, L.print)}
            </Button>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground print:hidden">
            <CloudUpload className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
            {pick(l, L.cloudPerks)}
          </p>
          {/* QA U10: iskreno napotilo ob onemogočenem .ics (+ kje je QR) —
              interaktivno napotilo, se NE tiska. */}
          <p id="potovanje-ics-hint" className="mt-1.5 text-xs leading-relaxed text-muted-foreground print:hidden">
            {pick(l, L.icsNoDates)}
          </p>
          {cloudError && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400 print:hidden">
              {pick(l, L.cloudErr)}: {cloudError}
            </p>
          )}
          {pdfError && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400 print:hidden">
              {pdfError}
            </p>
          )}

          {/* POLIR C (2.28.0): print podpis (viden SAMO ob tiskanju) — zrcalo
              noge shared-trip-view (»Izvoženo z …«): natisnjeno <datum> ·
              iskren vir podatkov · znamka. Na papirju ostanejo samo dnevi,
              postanki in meta (vir, interesi, opozorila, metrike). */}
          <p className="hidden pt-6 text-center text-xs text-muted-foreground print:block">
            {pick(l, L.printStamp)}: {new Date().toLocaleString(intlDateLocale(l))} ·{" "}
            {data.source === "planner" ? pick(l, L.printSrcPlan) : pick(l, L.printSrcDraft)} ·{" "}
            Discover Slovenia AI
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Postanek z akcijo Navigiraj (OSM directions — brez ključev)
// ---------------------------------------------------------------------------

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
                  <JourneyStopRow stop={stop} lang={lang} />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function JourneyStopRow({ stop, lang }: { stop: TripStop; lang: PlannerLang }) {
  const l = useLocale();
  const kindLabel = typeLabel(stop.kind, l);
  const regionTxt = stop.region ? regionLabel(stop.region, l) : "";
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
        {stop.coords && (
          <a
            href={osmDirectionsUrl(stop.coords)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {pick(l, L.navigate)}
            <span className="sr-only">
              : {stop.name} ({stop.coords.lat.toFixed(4)}, {stop.coords.lng.toFixed(4)})
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Sekcija iskrenih opozoril (geo-časovna validacija)
// ---------------------------------------------------------------------------

function WarningsSection({
  validation,
}: {
  validation: GeoValidation;
}) {
  const l = useLocale();
  const worstBadge =
    validation.worst === "error"
      ? { label: pick(l, L.worstError), cls: "bg-destructive text-white" }
      : validation.worst === "warn"
        ? { label: pick(l, L.worstWarn), cls: "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" }
        : { label: pick(l, L.worstOk), cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" };

  return (
    <section className="mt-8" aria-labelledby="opozorila">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="opozorila" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          {pick(l, L.warningsTitle)}
        </h2>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${worstBadge.cls}`}>
          {worstBadge.label}
        </span>
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{pick(l, L.warningsLead)}</p>

      {validation.issues.length === 0 ? (
        <Card className="mt-4 border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-900 dark:text-emerald-200">
            <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
            {pick(l, L.allClear)}
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 space-y-2">
          {validation.issues.map((issue, i) => (
            <li
              key={`${issue.day}-${issue.rule}-${i}`}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                issue.level === "error"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-400/50 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 size-4 shrink-0 ${
                  issue.level === "error" ? "text-destructive" : "text-amber-600"
                }`}
                aria-hidden="true"
              />
              <span>
                <span className="sr-only">
                  {pick(l, L.day)(issue.day)} · {issue.level === "error" ? "ERROR" : "WARN"}:{" "}
                </span>
                <span className="font-semibold">{pick(l, L.day)(issue.day)}: </span>
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Metrike po dnevih */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metricsTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {validation.days.map((m) => (
              <li key={m.day} className="text-sm">
                <p className="font-semibold">{pick(l, L.day)(m.day)}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{pick(l, L.stopsWord)(m.stops)}</span>
                  <span>
                    ~{m.km} {pick(l, L.km)}
                  </span>
                  <span>
                    ~{m.drivingMinutes} {pick(l, L.driveMin)}
                  </span>
                  <span>
                    {m.activityMinutes} {pick(l, L.activityMin)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-3.5 text-primary" aria-hidden="true" />
            {pick(l, L.totalTrip)}: ~{validation.tripKm} km · {pick(l, L.driveEstimate)}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
