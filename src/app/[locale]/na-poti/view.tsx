"use client";

import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  CloudSun,
  ExternalLink,
  Flag,
  Footprints,
  Hourglass,
  Info,
  LocateFixed,
  Loader2,
  MapPin,
  Navigation as NavigationIcon,
  Navigation2,
  PartyPopper,
  Play,
  RefreshCw,
  Route as RouteIcon,
  SkipForward,
  Smartphone,
  Sunrise,
  Trash2,
  Undo2,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { PageHeader } from "@/components/layout/page-header";
import { StopKindIcon } from "@/components/plan/plan-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGeolocation, type UseGeolocation } from "@/hooks/use-geolocation";
import { Link, useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  arrivalCheck,
  bearingDeg,
  cardinalLabel,
  cardinalName,
  etaMinutes,
  geoUri,
  haversineKm,
  isJourneyRouteResponse,
  offRouteCheck,
  osmDirectionsUrlWithOrigin,
  progressAlongRoute,
  roundedPrivacy,
  type GeoPoint,
} from "@/lib/go-gps";
import {
  buildPlanFromMyTrip,
  formatDuration,
  formatMoney,
  osmDirectionsUrl,
  roadKm,
  round5,
  travelMinutes,
  type PlannerLang,
} from "@/lib/itinerary-engine";
import { useMyTripList } from "@/lib/my-trip";
import {
  clearGoTrip,
  loadGoTrip,
  loadLastPlan,
  saveGoTrip,
  type GoPlanRef,
  type GoTripRecord,
} from "@/lib/plan-store";
import { regionLabel, typeLabel } from "@/lib/slovenia-data";
import type { ItineraryPlan, TripStop } from "@/lib/types";
import {
  fetchStopWeather,
  weatherLabel,
  type WeatherResponse,
} from "@/lib/weather";

/**
 * /na-poti — GO MODE „Na poti“: NOW & NEXT UI (rekonstrukcija po izvirniku
 * 1.64.0+). Sopotnik MED potovanjem: trenutni postanek z akcijami, naslednji
 * postanek (ETA iskreno NEZNANO — brez GPS nimamo vira), dnevni napredek,
 * jutranji uvod „ZAČNI DAN“ in zaključno stanje.
 *
 * Issue #1 področje 1 — ŽIVI GPS NAVIGACIJA: kartica „Tvoja lokacija“
 * (razdalja/smer/ETA/napredek do naslednjega postanka), odklon od
 * načrtovane poti (> 3 km) s preračunom prek /api/journey/route ter
 * živi ETA v NEXT kartici. ZASEBNOSTNI KANON (izvirnik): GPS živi SAMO v
 * klientu (0 persistenc); na strežnik gre izključno zaokrožena pozicija
 * (~11 m) ob eksplicitnem preračunu poti.
 *
 * Persistenca: localStorage 'dai:go-trip' { planRef, dayIndex, stopIndex,
 * startedAt, completed[] } (po vzorcu go-persist izvirnika). Deluje nad
 * zadnjim shranjenim načrtom (dai:last-plan) ali osnutkom iz Moje poti.
 * 100 % client-side — hidracija TEKOM mounta (brez mismatch-a).
 */

const L = {
  kicker: { sl: "Pojdi", en: "Go", it: "Vai", de: "Los", fr: "Partir", es: "Ir" },
  title: { sl: "Na poti: kaj je zdaj, kaj je naslednje", en: "On the road: what's now, what's next", it: "In viaggio: cosa c’è adesso, cosa viene dopo", de: "Unterwegs: was ist jetzt, was kommt als Nächstes", fr: "En route : qu’est-ce maintenant, qu’est-ce ensuite", es: "En camino: qué toca ahora, qué viene después" },
  lead: {
    sl: "Sopotnik med potovanjem: trenutni postanek, naslednji korak in dnevni napredek — shranjeno lokalno, deluje tudi brez signala.",
    en: "Your companion while traveling: the current stop, the next step and daily progress — stored locally, works offline too.",
    it: "Il tuo compagno di viaggio: la tappa attuale, il prossimo passo e i progressi giornalieri — salvato localmente, funziona anche offline.",
    de: "Dein Begleiter auf Reisen: der aktuelle Stopp, der nächste Schritt und der Tagesfortschritt — lokal gespeichert, funktioniert auch offline.",
    fr: "Ton compagnon de voyage : l’étape actuelle, la prochaine étape et la progression du jour — stocké localement, fonctionne aussi hors ligne.",
    es: "Tu compañero de viaje: la parada actual, el siguiente paso y el progreso diario — guardado localmente, funciona también sin conexión.",
  },
  now: { sl: "Zdaj", en: "Now", it: "Adesso", de: "Jetzt", fr: "Maintenant", es: "Ahora" },
  next: { sl: "Naslednje", en: "Next", it: "Prossimo", de: "Als Nächstes", fr: "Suivant", es: "Siguiente" },
  nextAfter: { sl: "Nato", en: "Then", it: "Poi", de: "Danach", fr: "Ensuite", es: "Luego" },
  lastStop: { sl: "To je zadnji postanek dneva.", en: "This is the last stop of the day.", it: "Questa è l’ultima tappa della giornata.", de: "Dies ist der letzte Stopp des Tages.", fr: "C’est la dernière étape de la journée.", es: "Esta es la última parada del día." },
  navigate: { sl: "Navigiraj", en: "Navigate", it: "Naviga", de: "Navigieren", fr: "Naviguer", es: "Navegar" },
  // ── P0-G (issue §16): geo: URI + stanje prihoda ──
  geoApp: { sl: "Sistemski zemljevidi", en: "System maps", it: "Mappe di sistema", de: "Systemkarten", fr: "Cartes du système", es: "Mapas del sistema" },
  arrivedBadge: { sl: "PRISPEL", en: "ARRIVED", it: "ARRIVATO", de: "ANGEKOMMEN", fr: "ARRIVÉ", es: "LLEGADO" },
  arrivedHint: {
    sl: "Znotraj ~250 m od cilja po zraku — potrdi, ko si res na kraju.",
    en: "Within ~250 m of the target as the crow flies — confirm once you are actually there.",
    it: "Entro ~250 m dalla meta in linea d’aria — conferma quando sei davvero sul posto.",
    de: "Innerhalb von ~250 m vom Ziel Luftlinie — bestätige, sobald du wirklich dort bist.",
    fr: "À ~250 m de la cible à vol d’oiseau — confirme quand tu y es vraiment.",
    es: "A ~250 m del objetivo en línea recta — confirma cuando estés realmente allí.",
  },
  complete: { sl: "Opravljeno", en: "Done", it: "Fatto", de: "Erledigt", fr: "Terminé", es: "Hecho" },
  skip: { sl: "Preskoči", en: "Skip", it: "Salta", de: "Überspringen", fr: "Passer", es: "Saltar" },
  skipped: { sl: "Preskočeno", en: "Skipped", it: "Saltata", de: "Übersprungen", fr: "Passée", es: "Saltada" },
  skipHint: {
    sl: "Preskočeni postanek ni opravljen — vrneš ga lahko s klikom na vrstico dneva.",
    en: "A skipped stop is not completed — bring it back by tapping its row in the day line.",
    it: "Una tappa saltata non è completata — riportala indietro toccando la sua riga nella lista del giorno.",
    de: "Ein übersprungener Stopp ist nicht abgeschlossen — hol ihn zurück, indem du seine Zeile in der Tagesliste antippst.",
    fr: "Une étape passée n’est pas terminée — ramène-la en touchant sa ligne dans la liste du jour.",
    es: "Una parada saltada no está completada — recupérala tocando su fila en la línea del día.",
  },
  progressTitle: { sl: "Napredek dneva", en: "Day progress", it: "Progressi della giornata", de: "Tagesfortschritt", fr: "Progression du jour", es: "Progreso del día" },
  progressOf: {
    sl: (done: number, total: number) => `${done}/${total} opravljenih`,
    en: (done: number, total: number) => `${done}/${total} completed`,
    it: (done: number, total: number) => `${done}/${total} completate`,
    de: (done: number, total: number) => `${done}/${total} erledigt`,
    fr: (done: number, total: number) => `${done}/${total} effectuées`,
    es: (done: number, total: number) => `${done}/${total} completadas`,
  },
  dayLine: { sl: "Postanki dneva", en: "Stops of the day", it: "Tappe della giornata", de: "Stopps des Tages", fr: "Étapes de la journée", es: "Paradas del día" },
  jumpTo: { sl: "Skoči na postanek", en: "Jump to a stop", it: "Vai a una tappa", de: "Zu einem Stopp springen", fr: "Aller à une étape", es: "Ir a una parada" },
  startDay: { sl: "ZAČNI DAN", en: "START THE DAY", it: "INIZIA LA GIORNATA", de: "TAG STARTEN", fr: "COMMENCER LA JOURNÉE", es: "EMPEZAR EL DÍA" },
  dayStartTitle: { sl: "Dobro jutro, pot je pripravljena", en: "Good morning, the route is ready", it: "Buongiorno, il percorso è pronto", de: "Guten Morgen, die Route ist fertig", fr: "Bonjour, l’itinéraire est prêt", es: "Buenos días, la ruta está lista" },
  dayStartBody: {
    sl: "Prvi postanek danes", en: "First stop today",
    it: "Prima tappa di oggi", de: "Erster Stopp heute", fr: "Première étape aujourd’hui", es: "Primera parada de hoy",
  },
  dayDoneTitle: { sl: "DAN ZAKLJUČEN", en: "DAY COMPLETED", it: "GIORNATA COMPLETATA", de: "TAG ABGESCHLOSSEN", fr: "JOURNÉE TERMINÉE", es: "DÍA COMPLETADO" },
  tripDoneTitle: { sl: "POTOVANJE ZAKLJUČENO", en: "TRIP COMPLETED", it: "VIAGGIO COMPLETATO", de: "REISE ABGESCHLOSSEN", fr: "VOYAGE TERMINÉ", es: "VIAJE COMPLETADO" },
  dayDoneBody: {
    sl: (done: number, total: number, skipped: number) =>
      `Opravljenih ${done} od ${total} postankov${skipped > 0 ? `, preskočenih ${skipped}` : ""}.`,
    en: (done: number, total: number, skipped: number) =>
      `${done} of ${total} stops completed${skipped > 0 ? `, ${skipped} skipped` : ""}.`,
    it: (done: number, total: number, skipped: number) =>
      `${done} di ${total} tappe completate${skipped > 0 ? `, ${skipped} saltate` : ""}.`,
    de: (done: number, total: number, skipped: number) =>
      `${done} von ${total} Stopps erledigt${skipped > 0 ? `, ${skipped} übersprungen` : ""}.`,
    fr: (done: number, total: number, skipped: number) =>
      `${done} étapes sur ${total} effectuées${skipped > 0 ? `, ${skipped} passées` : ""}.`,
    es: (done: number, total: number, skipped: number) =>
      `${done} de ${total} paradas completadas${skipped > 0 ? `, ${skipped} saltadas` : ""}.`,
  },
  nextDayBtn: { sl: (n: number) => `Začni dan ${n}`, en: (n: number) => `Start day ${n}`, it: (n: number) => `Inizia il giorno ${n}`, de: (n: number) => `Tag ${n} starten`, fr: (n: number) => `Commencer le jour ${n}`, es: (n: number) => `Empezar el día ${n}` },
  etaLabel: { sl: "Predviden prihod", en: "Estimated arrival", it: "Arrivo previsto", de: "Voraussichtliche Ankunft", fr: "Arrivée estimée", es: "Llegada estimada" },
  etaUnknown: {
    sl: "NEZNANO — brez GPS in podatka o prometu ne podajamo ure prihoda.",
    en: "UNKNOWN — without GPS or traffic data we state no arrival time.",
    it: "SCONOSCIUTO — senza GPS o dati sul traffico non indichiamo alcun orario di arrivo.",
    de: "UNBEKANNT — ohne GPS- oder Verkehrsdaten nennen wir keine Ankunftszeit.",
    fr: "INCONNU — sans GPS ni données de trafic, nous n’indiquons aucune heure d’arrivée.",
    es: "DESCONOCIDO — sin GPS ni datos de tráfico no indicamos ninguna hora de llegada.",
  },
  plannedTime: { sl: "Načrtovana ura", en: "Planned time", it: "Orario previsto", de: "Geplante Zeit", fr: "Heure prévue", es: "Hora prevista" },
  driveEstimate: { sl: "ocena vožnje do naslednjega", en: "drive estimate to the next stop", it: "stima del tragitto fino alla prossima", de: "Fahrtsschätzung bis zum nächsten Stopp", fr: "estimation du trajet jusqu’à la prochaine", es: "estimación del trayecto hasta la próxima" },
  noCoords: {
    sl: "Koordinate niso znane — navigacija ni na voljo.",
    en: "Coordinates unknown — navigation is not available.",
    it: "Coordinate sconosciute — la navigazione non è disponibile.",
    de: "Koordinaten unbekannt — die Navigation ist nicht verfügbar.",
    fr: "Coordonnées inconnues — la navigation n’est pas disponible.",
    es: "Coordenadas desconocidas — la navegación no está disponible.",
  },
  duration: { sl: "trajanje", en: "duration", it: "durata", de: "Dauer", fr: "durée", es: "duración" },
  cost: { sl: "cena", en: "cost", it: "costo", de: "Preis", fr: "prix", es: "precio" },
  end: { sl: "Zaključi Na poti", en: "End On-the-road", it: "Termina In viaggio", de: "Unterwegs beenden", fr: "Terminer En route", es: "Terminar En camino" },
  endConfirmTitle: { sl: "Zaključim Na poti?", en: "End On-the-road?", it: "Terminare In viaggio?", de: "Unterwegs beenden?", fr: "Terminer En route ?", es: "¿Terminar En camino?" },
  endConfirmDesc: {
    sl: "Napredek dneva pobrišem s te naprave. Načrt ostane shranjen — lahko ga znova zaženeš kadarkoli.",
    en: "I will delete the day's progress from this device. The plan stays saved — you can restart it anytime.",
    it: "Eliminerò i progressi della giornata da questo dispositivo. Il piano resta salvato — puoi riavviarlo quando vuoi.",
    de: "Ich lösche den Tagesfortschritt von diesem Gerät. Der Plan bleibt gespeichert — du kannst ihn jederzeit neu starten.",
    fr: "Je supprimerai la progression du jour de cet appareil. Le plan reste enregistré — tu peux le relancer à tout moment.",
    es: "Borraré el progreso del día de este dispositivo. El plan queda guardado — puedes reiniciarlo cuando quieras.",
  },
  cancel: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Annuler", es: "Cancelar" },
  endAction: { sl: "Zaključi", en: "End", it: "Termina", de: "Beenden", fr: "Terminer", es: "Terminar" },
  startedAt: { sl: "Zagon", en: "Started", it: "Avvio", de: "Gestartet", fr: "Démarré", es: "Iniciado" },
  offline: {
    sl: "Načrt in napredek sta shranjena na tej napravi — delujeta tudi brez signala.",
    en: "The plan and progress are stored on this device — they work offline too.",
    it: "Il piano e i progressi sono salvati su questo dispositivo — funzionano anche offline.",
    de: "Plan und Fortschritt sind auf diesem Gerät gespeichert — sie funktionieren auch offline.",
    fr: "Le plan et la progression sont stockés sur cet appareil — ils fonctionnent aussi hors ligne.",
    es: "El plan y el progreso están guardados en este dispositivo — funcionan también sin conexión.",
  },
  emptyTitle: { sl: "Ni aktivnega potovanja", en: "No active journey", it: "Nessun viaggio attivo", de: "Keine aktive Reise", fr: "Aucun voyage actif", es: "Ningún viaje activo" },
  emptyBody: {
    sl: "Sestavi načrt na /nacrtuj (gumb „Zaženi na poti“ ga naloži sem) ali dodaj destinacije v Moja pot.",
    en: "Build a plan at /nacrtuj (the “Start on the road” button loads it here) or add destinations to My trip.",
    it: "Crea un piano su /nacrtuj (il pulsante «Inizia il viaggio» lo carica qui) oppure aggiungi destinazioni a Il mio viaggio.",
    de: "Erstelle einen Plan auf /nacrtuj (die Schaltfläche „Unterwegs starten“ lädt ihn hier) oder füge Destinationen zu Meine Reise hinzu.",
    fr: "Crée un plan sur /nacrtuj (le bouton « Démarrer sur la route » le charge ici) ou ajoute des destinations à Mon voyage.",
    es: "Crea un plan en /nacrtuj (el botón «Empezar en camino» lo carga aquí) o añade destinos a Mi viaje.",
  },
  emptyCta: { sl: "Načrtuj pot", en: "Plan a route", it: "Pianifica un percorso", de: "Route planen", fr: "Planifier un itinéraire", es: "Planificar una ruta" },
  sourcePlan: { sl: "načrt z /nacrtuj", en: "plan from /nacrtuj", it: "piano da /nacrtuj", de: "Plan von /nacrtuj", fr: "plan de /nacrtuj", es: "plan de /nacrtuj" },
  sourceDraft: { sl: "osnutek iz Moje pot", en: "draft from My trip", it: "bozza da Il mio viaggio", de: "Entwurf aus Meine Reise", fr: "brouillon de Mon voyage", es: "borrador de Mi viaje" },
  day: { sl: (n: number) => `Dan ${n}`, en: (n: number) => `Day ${n}`, it: (n: number) => `Giorno ${n}`, de: (n: number) => `Tag ${n}`, fr: (n: number) => `Jour ${n}`, es: (n: number) => `Día ${n}` },
  stopsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
    it: (n: number) => `${n} ${n === 1 ? "tappa" : "tappe"}`,
    de: (n: number) => `${n} ${n === 1 ? "Stopp" : "Stopps"}`,
    fr: (n: number) => `${n} ${n === 1 ? "étape" : "étapes"}`,
    es: (n: number) => `${n} ${n === 1 ? "parada" : "paradas"}`,
  },
  weatherTitle: { sl: "Vreme na naslednjem postanku", en: "Weather at the next stop", it: "Meteo alla prossima tappa", de: "Wetter am nächsten Stopp", fr: "Météo à la prochaine étape", es: "Tiempo en la próxima parada" },
  weatherUnavailable: {
    sl: "Vreme trenutno ni dosegljivo.",
    en: "Weather is currently unavailable.",
    it: "Il meteo non è al momento disponibile.",
    de: "Das Wetter ist derzeit nicht verfügbar.",
    fr: "La météo est actuellement indisponible.",
    es: "El tiempo no está disponible actualmente.",
  },
  weatherSource: {
    sl: "Vir: Open-Meteo · koordinate naslednjega postanka",
    en: "Source: Open-Meteo · next stop coordinates",
    it: "Fonte: Open-Meteo · coordinate della prossima tappa",
    de: "Quelle: Open-Meteo · Koordinaten des nächsten Stopps",
    fr: "Source : Open-Meteo · coordonnées de la prochaine étape",
    es: "Fuente: Open-Meteo · coordenadas de la próxima parada",
  },
  weatherWind: { sl: "veter", en: "wind", it: "vento", de: "Wind", fr: "vent", es: "viento" },
  weatherPrecip: { sl: "padavine", en: "precipitation", it: "precipitazioni", de: "Niederschlag", fr: "précipitations", es: "precipitaciones" },
  // ── ŽIVI GPS (issue #1 področje 1 — Live GPS navigacija) ──
  gpsTitle: { sl: "Tvoja lokacija", en: "Your location", it: "La tua posizione", de: "Dein Standort", fr: "Ta position", es: "Tu ubicación" },
  gpsHint: {
    sl: "Živi GPS: razdalja, smer in ocena prihoda do naslednjega postanka.",
    en: "Live GPS: distance, direction and arrival estimate to the next stop.",
    it: "GPS in tempo reale: distanza, direzione e stima di arrivo alla prossima tappa.",
    de: "Live-GPS: Entfernung, Richtung und Ankunftsschätzung zum nächsten Stopp.",
    fr: "GPS en direct : distance, direction et estimation d’arrivée jusqu’à la prochaine étape.",
    es: "GPS en vivo: distancia, dirección y estimación de llegada a la próxima parada.",
  },
  gpsEnable: { sl: "Vklopi sledenje", en: "Turn on tracking", it: "Attiva il tracciamento", de: "Tracking aktivieren", fr: "Activer le suivi", es: "Activar el seguimiento" },
  gpsDisable: { sl: "Izklopi sledenje", en: "Turn off tracking", it: "Disattiva il tracciamento", de: "Tracking deaktivieren", fr: "Désactiver le suivi", es: "Desactivar el seguimiento" },
  gpsPrompt: { sl: "Nastavljam prvo fiksacijo …", en: "Getting a first fix …", it: "Ricerca del primo fix …", de: "Ersten Fix wird ermittelt …", fr: "Recherche du premier point …", es: "Obteniendo la primera fijación …" },
  gpsActive: { sl: "GPS aktiven", en: "GPS active", it: "GPS attivo", de: "GPS aktiv", fr: "GPS actif", es: "GPS activo" },
  gpsAccuracy: {
    sl: (m: number) => `natančnost ±${Math.round(m)} m`,
    en: (m: number) => `accuracy ±${Math.round(m)} m`,
    it: (m: number) => `precisione ±${Math.round(m)} m`,
    de: (m: number) => `Genauigkeit ±${Math.round(m)} m`,
    fr: (m: number) => `précision ±${Math.round(m)} m`,
    es: (m: number) => `precisión ±${Math.round(m)} m`,
  },
  gpsDenied: {
    sl: "Dovoljenje za lokacijo je zavrnjeno — omogoči ga v nastavitvah brskalnika (ikona pred naslovno vrstico) in poskusi znova.",
    en: "Location permission denied — enable it in the browser settings (icon before the address bar) and try again.",
    it: "Permesso di geolocalizzazione negato — attivalo nelle impostazioni del browser (icona prima della barra degli indirizzi) e riprova.",
    de: "Standortberechtigung verweigert — aktiviere sie in den Browser-Einstellungen (Symbol vor der Adressleiste) und versuche es erneut.",
    fr: "Autorisation de localisation refusée — active-la dans les réglages du navigateur (icône avant la barre d’adresse) et réessaie.",
    es: "Permiso de ubicación denegado — actívalo en los ajustes del navegador (icono antes de la barra de direcciones) y reintenta.",
  },
  gpsError: {
    sl: "GPS napaka — pomik na prosto nebo ali ponoven poskus lahko pomaga.",
    en: "GPS error — moving out into the open or retrying may help.",
    it: "Errore GPS — spostarti allo scoperto o riprovare può aiutare.",
    de: "GPS-Fehler — ins Freie gehen oder ein erneuter Versuch kann helfen.",
    fr: "Erreur GPS — sortir à découvert ou réessayer peut aider.",
    es: "Error de GPS — salir al aire libre o reintentar puede ayudar.",
  },
  gpsUnsupported: {
    sl: "Ta naprava ali brskalnik ne podpira Geolocation API.",
    en: "This device or browser does not support the Geolocation API.",
    it: "Questo dispositivo o browser non supporta l’API Geolocation.",
    de: "Dieses Gerät oder dieser Browser unterstützt die Geolocation-API nicht.",
    fr: "Cet appareil ou ce navigateur ne prend pas en charge l’API Geolocation.",
    es: "Este dispositivo o navegador no admite la API Geolocation.",
  },
  gpsRetry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
  gpsToward: { sl: "proti", en: "toward", it: "verso", de: "Richtung", fr: "vers", es: "hacia" },
  gpsAsCrowFlies: { sl: "v zraku", en: "as the crow flies", it: "in linea d’aria", de: "Luftlinie", fr: "à vol d’oiseau", es: "en línea recta" },
  gpsEtaLabel: { sl: "Ocena vožnje", en: "Drive estimate", it: "Stima del tragitto", de: "Fahrtsschätzung", fr: "Estimation du trajet", es: "Estimación del trayecto" },
  gpsEtaHint: {
    sl: "ocena pri ~55 km/h — brez podatka o prometu",
    en: "estimate at ~55 km/h — no traffic data",
    it: "stima a ~55 km/h — nessun dato sul traffico",
    de: "Schätzung bei ~55 km/h — keine Verkehrsdaten",
    fr: "estimation à ~55 km/h — pas de données de trafic",
    es: "estimación a ~55 km/h — sin datos de tráfico",
  },
  gpsDirectionSr: {
    sl: (label: string, name: string) => `smer: ${label} (${name})`,
    en: (label: string, name: string) => `direction: ${label} (${name})`,
    it: (label: string, name: string) => `direzione: ${label} (${name})`,
    de: (label: string, name: string) => `Richtung: ${label} (${name})`,
    fr: (label: string, name: string) => `direction : ${label} (${name})`,
    es: (label: string, name: string) => `dirección: ${label} (${name})`,
  },
  gpsProgress: { sl: "Pot do naslednjega postanka", en: "Route to the next stop", it: "Percorso fino alla prossima tappa", de: "Route zum nächsten Stopp", fr: "Itinéraire jusqu’à la prochaine étape", es: "Ruta hasta la próxima parada" },
  gpsPrivacy: {
    sl: "Zasebnost: položaj živi samo v tem brskalniku; ob preračunu poti strežnik prejme le zaokroženo točko (~11 m).",
    en: "Privacy: your position lives only in this browser; on a route recalculation the server receives only a rounded point (~11 m).",
    it: "Privacy: la tua posizione vive solo in questo browser; al ricalcolo del percorso il server riceve solo un punto arrotondato (~11 m).",
    de: "Datenschutz: deine Position lebt nur in diesem Browser; bei einer Routen-Neuberechnung erhält der Server nur einen gerundeten Punkt (~11 m).",
    fr: "Confidentialité : ta position ne vit que dans ce navigateur ; lors d’un recalcul d’itinéraire, le serveur ne reçoit qu’un point arrondi (~11 m).",
    es: "Privacidad: tu posición vive solo en este navegador; al recalcular la ruta el servidor recibe solo un punto redondeado (~11 m).",
  },
  etaLive: {
    sl: (clock: string, min: number, km: string) =>
      `~${clock} · ~${min} min · ${km} km v zraku · ocena pri ~55 km/h (brez prometa)`,
    en: (clock: string, min: number, km: string) =>
      `~${clock} · ~${min} min · ${km} km as the crow flies · estimate at ~55 km/h (no traffic)`,
    it: (clock: string, min: number, km: string) =>
      `~${clock} · ~${min} min · ${km} km in linea d’aria · stima a ~55 km/h (senza traffico)`,
    de: (clock: string, min: number, km: string) =>
      `~${clock} · ~${min} min · ${km} km Luftlinie · Schätzung bei ~55 km/h (ohne Verkehr)`,
    fr: (clock: string, min: number, km: string) =>
      `~${clock} · ~${min} min · ${km} km à vol d’oiseau · estimation à ~55 km/h (sans trafic)`,
    es: (clock: string, min: number, km: string) =>
      `~${clock} · ~${min} min · ${km} km en línea recta · estimación a ~55 km/h (sin tráfico)`,
  },
  offRouteTitle: { sl: "Odklon od načrtovane poti", en: "Off the planned route", it: "Fuori dal percorso pianificato", de: "Abseits der geplanten Route", fr: "Hors de l’itinéraire prévu", es: "Fuera de la ruta prevista" },
  offRouteBody: {
    sl: (km: string) =>
      `Od načrtovane poti do naslednjega postanka te loči ~${km} km (več kot 3 km).`,
    en: (km: string) =>
      `You are ~${km} km (over 3 km) from the planned route to the next stop.`,
    it: (km: string) =>
      `Sei a ~${km} km (oltre 3 km) dal percorso pianificato verso la prossima tappa.`,
    de: (km: string) =>
      `Du bist ~${km} km (über 3 km) von der geplanten Route zum nächsten Stopp entfernt.`,
    fr: (km: string) =>
      `Tu es à ~${km} km (plus de 3 km) de l’itinéraire prévu vers la prochaine étape.`,
    es: (km: string) =>
      `Estás a ~${km} km (más de 3 km) de la ruta prevista hacia la próxima parada.`,
  },
  offRouteStraight: {
    sl: "Merjeno proti premici do cilja — brez realne geometrije poti.",
    en: "Measured against the straight line to the target — no real route geometry.",
    it: "Misurato sulla linea retta verso la meta — nessuna geometria reale del percorso.",
    de: "Gemessen an der geraden Linie zum Ziel — ohne echte Routengeometrie.",
    fr: "Mesuré par rapport à la ligne droite vers la cible — sans géométrie réelle d’itinéraire.",
    es: "Medido respecto a la línea recta al objetivo — sin geometría real de ruta.",
  },
  recalc: { sl: "Preračunaj pot", en: "Recalculate route", it: "Ricalcola il percorso", de: "Route neu berechnen", fr: "Recalculer l’itinéraire", es: "Recalcular la ruta" },
  recalcBusy: { sl: "Preračunavam …", en: "Recalculating …", it: "Ricalcolo …", de: "Neuberechnung …", fr: "Recalcul …", es: "Recalculando …" },
  recalcFailed: {
    sl: "Preračun trenutno ni uspel — poskusi znova.",
    en: "Recalculation failed for now — try again.",
    it: "Il ricalcolo per ora non è riuscito — riprova.",
    de: "Die Neuberechnung ist vorerst fehlgeschlagen — versuche es erneut.",
    fr: "Le recalcul a échoué pour l’instant — réessaie.",
    es: "El recálculo falló por ahora — reintenta.",
  },
  recalcResult: { sl: "Preračunana pot", en: "Recalculated route", it: "Percorso ricalcolato", de: "Neu berechnete Route", fr: "Itinéraire recalculé", es: "Ruta recalculada" },
  recalcSourceOsrm: { sl: "OSRM — realna cestna pot", en: "OSRM — real road route", it: "OSRM — percorso stradale reale", de: "OSRM — echte Straßenroute", fr: "OSRM — itinéraire routier réel", es: "OSRM — ruta real por carretera" },
  recalcSourceHeuristic: {
    sl: "ocena (premočna ×1,3 pri ~55 km/h)",
    en: "estimate (straight line ×1.3 at ~55 km/h)",
    it: "stima (linea retta ×1,3 a ~55 km/h)",
    de: "Schätzung (Luftlinie ×1,3 bei ~55 km/h)",
    fr: "estimation (ligne droite ×1,3 à ~55 km/h)",
    es: "estimación (línea recta ×1,3 a ~55 km/h)",
  },
  recalcNoSlug: {
    sl: "Preračun ni mogoč — naslednji postanek ni iz kanonskega nabora destinacij.",
    en: "Recalculation unavailable — the next stop is not from the canonical destination set.",
    it: "Ricalcolo non disponibile — la prossima tappa non proviene dall’insieme canonico delle destinazioni.",
    de: "Neuberechnung nicht verfügbar — der nächste Stopp stammt nicht aus dem kanonischen Ziel-Set.",
    fr: "Recalcul indisponible — la prochaine étape ne provient pas de l’ensemble canonique de destinations.",
    es: "Recálculo no disponible — la próxima parada no proviene del conjunto canónico de destinos.",
  },
} as const;

export default function GoModePage() {
  const l = useLocale();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />
      <Suspense fallback={<GoSkeleton />}>
        <GoModeApp />
      </Suspense>
    </div>
  );
}

function GoSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-hidden="true">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

interface Resolved {
  plan: ItineraryPlan;
  source: GoPlanRef;
}

function GoModeApp() {
  const l = useLocale();
  const lang: PlannerLang = l === "en" ? "en" : "sl";
  // Locale-zavedajoči router (iz @/i18n/navigation) — /en prefix se ohrani.
  const router = useRouter();
  const searchParams = useSearchParams();
  const myItems = useMyTripList();

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [ready, setReady] = useState(false);
  const [go, setGo] = useState<GoTripRecord | null>(null);

  const resolve = (): Resolved | null => {
    const saved = loadLastPlan();
    if (saved && saved.plan.days.length > 0) return { plan: saved.plan, source: "last-plan" };
    const draft = buildPlanFromMyTrip(myItems, lang);
    if (draft.plan.days.length > 0) return { plan: draft.plan, source: "my-trip" };
    return null;
  };

  // Hidracija: localStorage se bere TEKOM mounta (SSR/klient se strinjata).
  useEffect(() => {
    const hydrate = () => {
      setResolved(resolve());
      setGo(loadGoTrip());
      setReady(true);
    };
    hydrate();
  }, []);

  // ?start=1 → SVEŽ zagon nad trenutno razrešenim načrtom (iz /nacrtuj).
  // Parameter se PORABI (router.replace brez ?start) — osvežitev strani
  // NE pobriše napredka (pogoj bi se ob reloadu ponovno sprožil).
  useEffect(() => {
    if (!ready || !resolved || searchParams.get("start") !== "1") return;
    const startFresh = () => {
      const record: GoTripRecord = {
        planRef: resolved.source,
        dayIndex: 0,
        stopIndex: 0,
        startedAt: new Date().toISOString(),
        completed: [],
      };
      saveGoTrip(record);
      setGo(record);
    };
    startFresh();
    router.replace("/na-poti", { scroll: false });
  }, [ready, resolved, searchParams, router]);

  const day = resolved && go ? (resolved.plan.days[go.dayIndex] ?? []) : [];
  const current: TripStop | null = go && go.stopIndex < day.length ? day[go.stopIndex] : null;
  const next: TripStop | null = go && go.stopIndex + 1 < day.length ? day[go.stopIndex + 1] : null;
  const dayComplete = !!go && go.stopIndex >= day.length;
  const isLastDay = !resolved || !go || go.dayIndex >= resolved.plan.days.length - 1;

  const doneInDay = go ? day.filter((s) => go.completed.includes(s.id)).length : 0;
  const skippedInDay = go
    ? day.filter((s, i) => i < go.stopIndex && !go.completed.includes(s.id)).length
    : 0;
  const progress = day.length > 0 ? Math.round((doneInDay / day.length) * 100) : 0;

  const persist = (patch: Partial<{ dayIndex: number; stopIndex: number; completed: string[] }>) => {
    if (!go || !resolved) return;
    const record: GoTripRecord = {
      planRef: resolved.source,
      dayIndex: patch.dayIndex ?? go.dayIndex,
      stopIndex: patch.stopIndex ?? go.stopIndex,
      startedAt: go.startedAt,
      completed: patch.completed ?? go.completed,
    };
    saveGoTrip(record);
    setGo(record);
  };

  const startDay = (dayIdx: number, fresh: boolean) => {
    if (!resolved) return;
    const record: GoTripRecord = {
      planRef: resolved.source,
      dayIndex: dayIdx,
      stopIndex: 0,
      startedAt: new Date().toISOString(),
      completed: fresh || dayIdx === 0 ? [] : (go?.completed ?? []),
    };
    saveGoTrip(record);
    setGo(record);
  };

  const endGo = () => {
    clearGoTrip();
    setGo(null);
  };

  // ── ŽIVI GPS (issue #1 področje 1) ─────────────────────────────
  // ZASEBNOSTNI KANON (izvirnik): GPS živi SAMO v klientu — 0 persistenc
  // (nikoli localStorage, nikoli analytics). Na strežnik gre IZKLJUČNO
  // zaokrožena pozicija (4 decimale, ~11 m) ob eksplicitnem preračunu
  // poti (glej GpsNavCard → roundedPrivacy).
  const geo = useGeolocation();

  // Živi ETA do naslednjega postanka: SAMO ob dejavni fiksaciji + znanem
  // cilju; brez GPS ostaja izrecno NEZNANO (nikoli izmišljeno).
  const liveEta = useMemo(() => {
    if (geo.status !== "watching" || !geo.position || !next?.coords) return null;
    const km = haversineKm(geo.position, next.coords);
    const min = etaMinutes(km);
    const arrival = new Date(Date.now() + min * 60_000);
    return {
      km,
      min,
      clock: arrival.toLocaleTimeString(lang === "en" ? "en-GB" : "sl-SI", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [geo.status, geo.position, next, lang]);

  // ── PRIHOD (P0-G, issue §16 arrival state) ──────────────────────
  // Geofence ~250 m okoli TRENUTNEGA postanka — namig, ne dokaz
  // (iskreno razkrito v UI; potrditev ostane uporabnikova).
  const arrivedNow = useMemo(() => {
    if (geo.status !== "watching" || !geo.position || !current?.coords) return null;
    return arrivalCheck(geo.position, current.coords);
  }, [geo.status, geo.position, current]);

  return (
    <div className="mt-8">
      {!ready && <GoSkeleton />}

      {ready && !resolved && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Footprints className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">{pick(l, L.emptyTitle)}</p>
            <p className="max-w-md text-sm text-muted-foreground">{pick(l, L.emptyBody)}</p>
            <Button asChild size="lg" className="min-h-12">
              <Link href="/nacrtuj">
                <RouteIcon className="size-5" aria-hidden="true" />
                {pick(l, L.emptyCta)}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {ready && resolved && (
        <>
          {/* Vir + offline opomba */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1">
              <Info className="size-3.5" aria-hidden="true" />
              {resolved.source === "last-plan" ? pick(l, L.sourcePlan) : pick(l, L.sourceDraft)}
              {go ? ` · ${L.day[lang](go.dayIndex + 1)}` : ""}
            </Badge>
            <p className="text-xs text-muted-foreground">{pick(l, L.offline)}</p>
          </div>

          {/* JUTRANJI UVOD — pred zagonom */}
          {!go && (
            <Card className="mt-4 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-primary/5">
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                  <Sunrise className="size-6 text-primary" aria-hidden="true" />
                  {pick(l, L.dayStartTitle)}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pick(l, L.dayStartBody)}:{" "}
                  <span className="font-semibold text-foreground">
                    {resolved.plan.days[0]?.[0]?.name ?? "—"}
                  </span>{" "}
                  ({resolved.plan.days[0]?.[0]?.time ?? "—"}) ·{" "}
                  {L.stopsWord[lang](resolved.plan.days[0]?.length ?? 0)} ·{" "}
                  {formatMoney(
                    (resolved.plan.days[0] ?? []).reduce((s, x) => s + x.cost, 0),
                    lang
                  )}
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="mt-5 min-h-12 text-base"
                  onClick={() => startDay(0, true)}
                >
                  <Play className="size-5" aria-hidden="true" />
                  {pick(l, L.startDay)} {L.day[lang](1)}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* GO MODE AKTIVEN */}
          {go && (
            <>
              {/* NOW kartica */}
              {current ? (
                <Card className="mt-4 border-primary/40 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {L.now[lang]}
                        </span>
                        <span className="sr-only">: </span>
                        <span className="text-base font-bold">{current.name}</span>
                        {/* P0-G: geofence prihoda — namig, ne dokaz */}
                        {arrivedNow?.arrived && (
                          <Badge className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CircleCheck className="size-3.5" aria-hidden="true" />
                            {pick(l, L.arrivedBadge)}
                          </Badge>
                        )}
                      </span>
                      <span className="text-2xl font-bold tabular-nums text-primary">
                        {current.time ?? "—"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <StopKindIcon kind={current.kind} className="size-4" />
                        {typeLabel(current.kind, lang)}
                      </span>
                      <span>
                        <span className="sr-only">{pick(l, L.duration)}: </span>
                        {formatDuration(current.durationMin, lang)}
                      </span>
                      <span>
                        <span className="sr-only">{pick(l, L.cost)}: </span>
                        {formatMoney(current.cost, lang)}
                      </span>
                      {current.region && <span>{regionLabel(current.region, lang)}</span>}
                    </p>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {current.coords ? (
                        <Button asChild type="button" size="lg" className="min-h-12">
                          <a
                            href={osmDirectionsUrl(current.coords)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <NavigationIcon className="size-5" aria-hidden="true" />
                            {pick(l, L.navigate)}
                            <ExternalLink className="size-4" aria-hidden="true" />
                          </a>
                        </Button>
                      ) : (
                        <Button type="button" size="lg" variant="outline" className="min-h-12" disabled>
                          <NavigationIcon className="size-5" aria-hidden="true" />
                          {pick(l, L.navigate)}
                        </Button>
                      )}
                      {/* P0-G (issue §16): geo: URI — sistemski izbirnik
                          zemljevidov na mobilni napravi (OSM ostane glavni
                          na namizju). */}
                      {current.coords && (
                        <Button asChild type="button" size="lg" variant="outline" className="min-h-12">
                          <a href={geoUri(current.coords)}>
                            <Smartphone className="size-5" aria-hidden="true" />
                            {pick(l, L.geoApp)}
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="lg"
                        variant={arrivedNow?.arrived ? "default" : "secondary"}
                        className="min-h-12"
                        onClick={() =>
                          persist({
                            completed: [...go.completed, current.id],
                            stopIndex: go.stopIndex + 1,
                          })
                        }
                      >
                        <Check className="size-5" aria-hidden="true" />
                        {pick(l, L.complete)}
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        className="min-h-12"
                        onClick={() => persist({ stopIndex: go.stopIndex + 1 })}
                      >
                        <SkipForward className="size-5" aria-hidden="true" />
                        {pick(l, L.skip)}
                      </Button>
                    </div>
                    {/* P0-G: iskrena opomba geofence prihoda (~250 m) */}
                    {arrivedNow?.arrived && (
                      <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" role="status">
                        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {pick(l, L.arrivedHint)}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {pick(l, L.startedAt)}:{" "}
                      {new Date(go.startedAt).toLocaleString(lang === "en" ? "en-GB" : "sl-SI")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                /* ZAKLJUČNO STANJE DNEVA / POTOVANJA */
                <Card
                  className={`mt-4 ${
                    isLastDay
                      ? "border-emerald-400/60 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                      : "border-primary/30"
                  }`}
                >
                  <CardContent className="p-6">
                    <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                      {isLastDay ? (
                        <>
                          <PartyPopper className="size-6 text-emerald-600" aria-hidden="true" />
                          {pick(l, L.tripDoneTitle)}
                        </>
                      ) : (
                        <>
                          <Flag className="size-6 text-primary" aria-hidden="true" />
                          {pick(l, L.dayDoneTitle)} — {L.day[lang](go.dayIndex + 1)}
                        </>
                      )}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {L.dayDoneBody[lang](doneInDay, day.length, skippedInDay)}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {!isLastDay && (
                        <Button
                          type="button"
                          size="lg"
                          className="min-h-12"
                          onClick={() => startDay(go.dayIndex + 1, false)}
                        >
                          <Play className="size-5" aria-hidden="true" />
                          {L.nextDayBtn[lang](go.dayIndex + 2)}
                        </Button>
                      )}
                      <Button asChild type="button" size="lg" variant="secondary" className="min-h-12">
                        <Link href="/potovanje">
                          <RouteIcon className="size-5" aria-hidden="true" />
                          {resolved.source === "last-plan"
                            ? pick(l, { sl: "Nazaj na potovanje", en: "Back to the journey", it: "Torna al viaggio", de: "Zurück zur Reise", fr: "Retour au voyage", es: "Volver al viaje" })
                            : pick(l, { sl: "Odpri potovanje", en: "Open the journey", it: "Apri il viaggio", de: "Reise öffnen", fr: "Ouvrir le voyage", es: "Abrir el viaje" })}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* TVOJA LOKACIJA — živi GPS (issue #1 področje 1):
                  razdalja/smer/ETA/napredek do naslednjega postanka,
                  odklon s preračunom; pod NOW kot trak nad NEXT. */}
              {current && (
                <GpsNavCard
                  geo={geo}
                  current={current}
                  next={next}
                  l={l}
                  lang={lang}
                />
              )}

              {/* NEXT kartica */}
              {current && (
                <Card className="mt-4">
                  <CardContent className="p-5">
                    {next ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
                            <ChevronRight className="size-4" aria-hidden="true" />
                            {L.next[lang]}
                          </span>
                          <span className="text-lg font-bold tabular-nums">{next.time ?? "—"}</span>
                        </div>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="font-semibold">{next.name}</span>
                          <Badge variant="outline" className="text-[11px]">
                            {typeLabel(next.kind, lang)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(next.durationMin, lang)} · {formatMoney(next.cost, lang)}
                          </span>
                        </p>
                        {current.coords && next.coords ? (
                          <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                            <RouteIcon className="size-3.5" aria-hidden="true" />
                            ~{round5(roadKm(current.coords, next.coords))} km · ~
                            {travelMinutes(current.coords, next.coords)} min ·{" "}
                            {pick(l, L.driveEstimate)}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">{pick(l, L.noCoords)}</p>
                        )}
                        {/* ETA: živa vrednost SAMO ob dejavni GPS fiksaciji
                            (issue #1) — sicer ostaja izrecno NEZNANO. */}
                        {liveEta ? (
                          <p
                            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
                            aria-live="polite"
                          >
                            <span className="font-semibold">
                              {pick(l, L.etaLabel)}:{" "}
                            </span>
                            <span className="tabular-nums text-primary">
                              {L.etaLive[lang](
                                liveEta.clock,
                                liveEta.min,
                                liveEta.km.toFixed(1)
                              )}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold">
                              {pick(l, L.etaLabel)}:{" "}
                              <span className="font-normal text-muted-foreground">
                                {pick(l, L.etaUnknown)}
                              </span>
                            </span>
                          </p>
                        )}
                        {/* Navigiraj do naslednjega postanka — zunanji handoff
                            na OSM (kanon osmDirectionsUrl); origin = živi
                            GPS, ko je na voljo (uporabnikov izrecen klik).
                            P0-G: geo: URI zraven — sistemski izbirnik
                            zemljevidov na mobilni napravi. */}
                        {next.coords && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              asChild
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                            >
                              <a
                                href={
                                  geo.status === "watching" && geo.position
                                    ? osmDirectionsUrlWithOrigin(geo.position, next.coords)
                                    : osmDirectionsUrl(next.coords)
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <NavigationIcon className="size-4" aria-hidden="true" />
                                {pick(l, L.navigate)}
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                              </a>
                            </Button>
                            <Button
                              asChild
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                            >
                              <a href={geoUri(next.coords)}>
                                <Smartphone className="size-4" aria-hidden="true" />
                                {pick(l, L.geoApp)}
                              </a>
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Hourglass className="size-4" aria-hidden="true" />
                        {pick(l, L.lastStop)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* VREME NA NASLEDNJEM POSTANKU — zasebnostni kanon izvirnika:
                  koordinate POSTANKA načrta, NIKOLI uporabnikov GPS; brez
                  koordinat je kartica skrita (iskrena odsotnost). */}
              {next && next.coords && (
                <StopWeatherCard
                  key={`${next.coords.lat},${next.coords.lng}`}
                  lat={next.coords.lat}
                  lng={next.coords.lng}
                  stopName={next.name}
                  l={l}
                  lang={lang}
                />
              )}

              {/* DNEVNI NAPREDEK */}
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <CheckCheck className="size-4 text-primary" aria-hidden="true" />
                      {pick(l, L.progressTitle)} — {L.day[lang](go.dayIndex + 1)}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {L.progressOf[lang](doneInDay, day.length)} · {progress} %
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={progress} aria-label={`${progress} %`} />
                  {/* Vrstica dneva: stanja postankov + skok (tudi obnova preskočenih) */}
                  <ol className="mt-4 space-y-1.5" aria-label={pick(l, L.dayLine)}>
                    {day.map((stop, i) => {
                      const done = go.completed.includes(stop.id);
                      const isCurrent = i === go.stopIndex;
                      const isPast = i < go.stopIndex;
                      const state = done
                        ? "done"
                        : isCurrent
                          ? "current"
                          : isPast
                            ? "skipped"
                            : "upcoming";
                      return (
                        <li key={stop.id}>
                          <button
                            type="button"
                            onClick={() => persist({ stopIndex: i })}
                            aria-current={isCurrent ? "true" : undefined}
                            title={pick(l, L.jumpTo)}
                            className={`flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                              state === "current"
                                ? "border-primary bg-primary/10"
                                : state === "done"
                                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                                  : state === "skipped"
                                    ? "border-dashed border-muted-foreground/40 bg-muted/30 opacity-70"
                                    : "bg-card hover:bg-accent"
                            }`}
                          >
                            {state === "done" ? (
                              <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            ) : state === "current" ? (
                              <Play className="size-4 shrink-0 text-primary" aria-hidden="true" />
                            ) : state === "skipped" ? (
                              <Undo2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            ) : (
                              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              <span className="tabular-nums text-muted-foreground">
                                {stop.time ?? "—"}
                              </span>{" "}
                              {stop.name}
                            </span>
                            {state === "skipped" && (
                              <Badge variant="outline" className="gap-1 text-[10px]">
                                <Ban className="size-3" aria-hidden="true" />
                                {pick(l, L.skipped)}
                              </Badge>
                            )}
                            {state === "current" && (
                              <Badge className="bg-primary text-[10px] text-primary-foreground">
                                {L.now[lang]}
                              </Badge>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-3 text-xs text-muted-foreground">{pick(l, L.skipHint)}</p>
                </CardContent>
              </Card>

              {/* KONEC NA POTI */}
              <div className="mt-6">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" className="min-h-12">
                      <Trash2 className="size-4" aria-hidden="true" />
                      {pick(l, L.end)}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{pick(l, L.endConfirmTitle)}</AlertDialogTitle>
                      <AlertDialogDescription>{pick(l, L.endConfirmDesc)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="min-h-11">
                        {pick(l, L.cancel)}
                      </AlertDialogCancel>
                      <AlertDialogAction className="min-h-11" onClick={endGo}>
                        {pick(l, L.endAction)}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Vreme na naslednjem postanku (Task 51-a) — ZASEBNOSTNI kanon izvirnika
 * (go-weather.ts): poizvedba gre po koordinatah NASLEDNJEGA POSTANKA načrta,
 * NIKOLI po uporabnikovi GPS lezi (razkrito v napisu vira). Stanja:
 * skeleton med nalaganjem, iskrena napaka ob nedosegljivem servisu (brez
 * izmišljenih podatkov), uspeh → temperatura (1 dec.), WMO oznaka, veter,
 * padavine (samo če > 0 mm). En sam fetch; prekinitev ob odklopu.
 */
function StopWeatherCard({
  lat,
  lng,
  stopName,
  l,
  lang,
}: {
  lat: number;
  lng: number;
  stopName: string;
  l: string;
  lang: PlannerLang;
}) {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    // Stanje se ponastavi z remountom (glej key pri uporabi) — tukaj samo
    // asinhrono posodabljanje po odzivu (brez sinhronega setState v efektu).
    fetchStopWeather(lat, lng, controller.signal).then(
      (w) => {
        if (cancelled) return;
        if (w) setWeather(w);
        else setFailed(true);
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lat, lng]);

  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
            <CloudSun className="size-4" aria-hidden="true" />
            {pick(l, L.weatherTitle)}
          </span>
          {weather && (
            <span className="text-lg font-bold tabular-nums text-primary">
              {weather.current.temperatureC.toFixed(1)} °C
            </span>
          )}
        </div>

        {weather ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">{stopName}</span>
            <span>{weatherLabel(weather.current.weatherCode, lang)}</span>
            <span>
              <span className="sr-only">{pick(l, L.weatherWind)}: </span>
              {weather.current.windKmh.toFixed(1)} km/h
            </span>
            {weather.current.precipitationMm > 0 && (
              <span>
                <span className="sr-only">{pick(l, L.weatherPrecip)}: </span>
                {weather.current.precipitationMm.toFixed(1)} mm
              </span>
            )}
          </p>
        ) : failed ? (
          <p className="mt-2 text-sm text-muted-foreground">{pick(l, L.weatherUnavailable)}</p>
        ) : (
          <div className="mt-3 space-y-2" aria-hidden="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">{pick(l, L.weatherSource)}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Tvoja lokacija — živi GPS trak Go Mode (issue #1 področje 1,
 * rekonstrukcija po kanonu izvirnika: GPS nadzor pod NOW/NEXT tokom,
 * iskreni statusi, DistanceChip — razkritje „v zraku“, ETA hint
 * „ocena iz premočne razdalje ×1,3 pri ~55 km/h“).
 *
 * ZASEBNOSTNI KANON (izvirnik, izveden tukaj):
 *  - položaj živi SAMO v klientu (state hooka) — nikoli localStorage,
 *    nikoli analytics, 0 persistenc;
 *  - na strežnik gre IZKLJUČNO zaokrožena pozicija (roundedPrivacy,
 *    4 decimale ≈ 11 m) in samo ob eksplicitnem preračunu poti;
 *  - gumb „Navigiraj“ (NEXT kartica) je zunanji handoff na OSM —
 *    uporabnikov izrecen klik, enako kot vsak navigacijski gumb.
 *
 * Iskrenost: brez GPS ostaja ETA NEZNANO; razdalja je premočna
 * („v zraku“); odklon brez geometrije poti se meri le proti premici
 * do cilja (razkrito v opozorilu); preračun pošteno oznani vir
 * (OSRM — realna cestna pot / ocena).
 */
function GpsNavCard({
  geo,
  current,
  next,
  l,
  lang,
}: {
  geo: UseGeolocation;
  current: TripStop | null;
  next: TripStop | null;
  l: string;
  lang: PlannerLang;
}) {
  const reduceMotion = useReducedMotion();

  // ── Preračun poti (ob odklonu) ─────────────────────────────────
  // Rezultat velja za točno tega naslednjega postanka; ob premiku
  // (Opravi/Preskoči/skok po vrstici dneva) zastara in se NE uporablja.
  const [reroute, setReroute] = useState<{
    targetId: string;
    km: number;
    min: number;
    source: "osrm" | "heuristic";
    geometry: GeoPoint[];
  } | null>(null);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcFailed, setRecalcFailed] = useState(false);

  const activeReroute =
    reroute && next && reroute.targetId === next.id ? reroute : null;

  const watching = geo.status === "watching";
  const position = watching ? geo.position : null;

  // ── Žive vrednosti do naslednjega postanka ─────────────────────
  const live = useMemo(() => {
    if (!position || !next?.coords) return null;
    const kmStraight = haversineKm(position, next.coords);
    return {
      kmStraight,
      bearing: bearingDeg(position, next.coords),
      etaMin: etaMinutes(kmStraight),
      progress:
        current?.coords
          ? progressAlongRoute(position, current.coords, next.coords)
          : null,
    };
  }, [position, next, current]);

  // ── Odklon od načrtovane poti (iskrena baza, razkrito) ────────
  const offRoute = useMemo(() => {
    if (!position || !next?.coords) return null;
    if (activeReroute && activeReroute.geometry.length >= 2) {
      // Po preračunu je referenca NOVA geometrija od tu do cilja
      // (realna OSRM pot ali odkrita hevristična premica).
      return offRouteCheck(position, next.coords, activeReroute.geometry);
    }
    if (current?.coords) {
      // Pred preračunom je edina referenca premica [trenutni → naslednji]
      // (razkrito v opozorilu). Varovalka proti lažnemu alarmu ob prihodu
      // na prvi postanek dneva: opozorilo samo, ko je uporabnik bliže
      // NASLEDNJEMU postanku kot trenutnemu (prihod NI odklon).
      if (
        haversineKm(position, next.coords) <
        haversineKm(position, current.coords)
      ) {
        return offRouteCheck(position, next.coords, [
          current.coords,
          next.coords,
        ]);
      }
      return null;
    }
    return null; // brez koordinat trenutnega postanka — iskrena odsotnost
  }, [position, next, current, activeReroute]);

  const recalc = async () => {
    if (!watching || !geo.position || !next?.coords || !next.slug) return;
    setRecalcBusy(true);
    setRecalcFailed(false);
    try {
      // ZASEBNOST: strežnik dobi IZKLJUČNO zaokroženo točko (~11 m).
      const res = await fetch("/api/journey/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: roundedPrivacy(geo.position),
          to: next.slug,
        }),
      });
      if (!res.ok) throw new Error("reroute request failed");
      const data: unknown = await res.json();
      if (!isJourneyRouteResponse(data) || !data.reroute) {
        throw new Error("reroute response shape");
      }
      const leg = data.legs[0];
      if (!leg) throw new Error("reroute no leg");
      setReroute({
        targetId: next.id,
        km: data.totalKm,
        min: data.totalMin,
        source: leg.source,
        geometry: leg.geometry.map(([lat, lng]) => ({ lat, lng })),
      });
    } catch {
      setRecalcFailed(true); // iskrena napaka — nikoli izmišljenih rezultatov
    } finally {
      setRecalcBusy(false);
    }
  };

  return (
    <Card className="mt-4 border-primary/30">
      <CardContent className="p-5">
        {/* Naslov + izklop sledenja (dotik ≥ 44 px) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {geo.status === "prompt" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed
                className={`size-4 ${
                  watching ? "text-emerald-600" : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
            )}
            {pick(l, L.gpsTitle)}
          </span>
          {watching && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={geo.stop}
            >
              {pick(l, L.gpsDisable)}
            </Button>
          )}
        </div>

        {/* Stanja GPS (spremembe objavljene — aria-live) */}
        <div className="mt-3 space-y-3" aria-live="polite">
          {/* IDLE: predlog vklopa */}
          {geo.status === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">{pick(l, L.gpsHint)}</p>
              <Button type="button" size="lg" className="min-h-12" onClick={geo.start}>
                <NavigationIcon className="size-5" aria-hidden="true" />
                {pick(l, L.gpsEnable)}
              </Button>
            </>
          )}

          {geo.status === "prompt" && (
            <p className="text-sm text-muted-foreground">{pick(l, L.gpsPrompt)}</p>
          )}

          {geo.status === "denied" && (
            <>
              <p className="text-sm text-muted-foreground">{pick(l, L.gpsDenied)}</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={geo.start}
              >
                <NavigationIcon className="size-4" aria-hidden="true" />
                {pick(l, L.gpsRetry)}
              </Button>
            </>
          )}

          {geo.status === "error" && (
            <>
              <p className="text-sm text-muted-foreground">{pick(l, L.gpsError)}</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={geo.start}
              >
                <NavigationIcon className="size-4" aria-hidden="true" />
                {pick(l, L.gpsRetry)}
              </Button>
            </>
          )}

          {geo.status === "unsupported" && (
            <p className="text-sm text-muted-foreground">{pick(l, L.gpsUnsupported)}</p>
          )}

          {/* WATCHING: žive vrednosti (velike številke — ozek telefon) */}
          {watching && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                {pick(l, L.gpsActive)}
                {position?.accuracyM != null &&
                  ` · ${L.gpsAccuracy[lang](position.accuracyM)}`}
              </p>

              {live ? (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-3xl font-bold tabular-nums text-primary">
                      {live.kmStraight.toFixed(1)} km
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {pick(l, L.gpsAsCrowFlies)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                      <Navigation2
                        className="size-5 text-primary transition-transform"
                        style={{ transform: `rotate(${live.bearing}deg)` }}
                        aria-hidden="true"
                      />
                      <span className="sr-only">
                        {L.gpsDirectionSr[lang](
                          cardinalLabel(live.bearing, lang),
                          cardinalName(live.bearing, lang)
                        )}
                        :{" "}
                      </span>
                      {pick(l, L.gpsToward)} {cardinalLabel(live.bearing, lang)}
                    </span>
                  </p>

                  <p className="text-sm">
                    <span className="font-semibold">{pick(l, L.gpsEtaLabel)}: </span>
                    <span className="tabular-nums">~{live.etaMin} min</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      ({pick(l, L.gpsEtaHint)})
                    </span>
                  </p>

                  {live.progress !== null && (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{pick(l, L.gpsProgress)}</span>
                        <span className="tabular-nums">{live.progress} %</span>
                      </div>
                      <Progress
                        value={live.progress}
                        aria-label={`${pick(l, L.gpsProgress)}: ${live.progress} %`}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{pick(l, L.noCoords)}</p>
              )}
            </motion.div>
          )}
        </div>

        {/* OPOZORILO ODKLONA (> 3 km) + PRERAČUN POTI */}
        <AnimatePresence>
          {offRoute?.offRoute && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
              role="alert"
              className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/60"
            >
              <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {pick(l, L.offRouteTitle)} (~{offRoute.deviationKm.toFixed(1)} km)
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                {L.offRouteBody[lang](offRoute.deviationKm.toFixed(1))}
                {!activeReroute && ` ${pick(l, L.offRouteStraight)}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {next?.slug ? (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11"
                    onClick={recalc}
                    disabled={recalcBusy}
                  >
                    {recalcBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden="true" />
                    )}
                    {recalcBusy ? pick(l, L.recalcBusy) : pick(l, L.recalc)}
                  </Button>
                ) : (
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {pick(l, L.recalcNoSlug)}
                  </p>
                )}
              </div>
              {recalcFailed && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {pick(l, L.recalcFailed)}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rezultat preračuna (pošteno oznani vir) */}
        {activeReroute && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <RouteIcon className="size-4 text-primary" aria-hidden="true" />
            <span className="font-semibold">{pick(l, L.recalcResult)}:</span>
            <span className="tabular-nums">
              ~{activeReroute.km.toFixed(1)} km · ~{activeReroute.min} min
            </span>
            <span className="text-xs text-muted-foreground">
              (
              {activeReroute.source === "osrm"
                ? pick(l, L.recalcSourceOsrm)
                : pick(l, L.recalcSourceHeuristic)}
              )
            </span>
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">{pick(l, L.gpsPrivacy)}</p>
      </CardContent>
    </Card>
  );
}
