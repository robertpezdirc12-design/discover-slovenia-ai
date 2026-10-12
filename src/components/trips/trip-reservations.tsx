"use client";

// ============================================================================
// TRIP RESERVATIONS — rekonstrukcija Issue #4 §4 (val 3) iz PRISTNE izvorne
// kode (read_1790957761726), mostovno prirejena modelu 48-a + S1 UTRDITEV
// 51-c: rezervacijske VRSTICE NA POTI (postanek + dan + stanje + opomba).
// ============================================================================
// ISKRENOST (kanon izvirnika, ohranjen in okrepljen z 51-c):
//  · zamisel (IDEA) je izrecno označena — nikoli kar „potrjeno";
//  · POTRJEVANJE je vedno UPORABNIŠKA ATESTACIJA: modal „Potrdi rezervacijo"
//    zahteva številko rezervacije + ceno IZ POTRDILA PONUDNIKA (source:
//    USER) — izrecno „ni naša integracija"; nikoli „providerjeva potrditev
//    prek naše integracije" (vijolični žeton, ne smaragdno „provider");
//  · potrjena vrstica pokaže številko rezervacije + ceno + izvor
//    (source: USER) — razkritje izvora je del zapisa;
//  · preklicana vrstica je DOKONČNA (terminalno stanje življenjskega
//    cikla — brez povratkov v zamisel);
//  · poskus provider kanala (source: "PROVIDER") na strežniku propade
//    zaprto (503) — kanal v peskovniku ne obstaja; napaka se izpiše;
//  · PARTNER kanal (v2.6.0, vzorec MindTrip): REALNA rezervacija PRI
//    partnerju (Booking.com, GetYourGuide, Kiwi, Rentalcars, Omio) prek
//    vodene povezave /api/affiliate/go — rezervacija se zaključi pri
//    partnerju (status PENDING), potrditev je uporabnikova atestacija s
//    številko iz partnerjevega potrdila; sprememba/odpoved DEJANSKO
//    tečeta pri partnerju (iskrena povezava), tu vodimo samo stanje;
//  · vsaka napaka API-ja se izpiše (brez tihih padcev).
//
// Mutacije (POST/PATCH/DELETE) so EDITOR+ — vlogo je izračunal strežnik,
// komponenta samo pošteno skrije obrazec, če pravice ni (canEdit prop).
// Nove površine (modal + razkritje izvora) so dvojezične (L={sl,en}+pick);
// ostala besedila ostajajo SL-only kot v ostalih /pot komponentah izvirnika.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TicketCheck,
  Plus,
  Loader2,
  CircleAlert,
  CircleCheck,
  Ban,
  Trash2,
  PenLine,
  BadgeCheck,
  FlaskConical,
  Handshake,
  Hourglass,
  Plane,
  CalendarDays,
  Users,
  ChevronDown,
  ExternalLink,
  Navigation,
  Route as RouteIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { osmDirectionsUrl } from "@/lib/itinerary-engine";
import { getDestination } from "@/lib/slovenia-data";
import { asPickLocale, pick } from "@/lib/i18n-pick";
import type { SharedPlan } from "@/lib/shared-plan";
import {
  noteTextOf,
  parseAttestationNote,
  statusLabel,
} from "@/lib/journey/booking";
import {
  RESERVATION_CHANNEL_LABELS,
  isValidBookingDate,
  parseDemoNote,
  parsePartnerNote,
  reservationChannelOf,
  searchDemoOffers,
  searchPartnerOffers,
  type DemoOffer,
  type PartnerOffer,
} from "@/lib/journey/booking-provider";

interface ReservationRow {
  id: string;
  dayIndex: number;
  stopSlug: string | null;
  stopName: string;
  status: string; // IDEA | CONFIRMED | MODIFIED | CANCELLED (mostovni nabor)
  note: string | null;
  createdBy: string;
  createdAt: string;
}

/** Cilj potrditvenega modala (51-c). */
type ConfirmTarget =
  | { kind: "create" } // nov potrjen vnos iz obrazca → POST + atestacija
  | { kind: "confirm"; row: ReservationRow } // IDEA → CONFIRMED (PATCH)
  | { kind: "update"; row: ReservationRow }; // CONFIRMED/MODIFIED → MODIFIED (PATCH)

/** Zavihek modala „Išči ponudbo" (issue #1: strogo ločena kanala). */
type SearchTab = "partner" | "demo";

// Dvojezične oznake novih površin (SL je resnica, EN je prevod — kanon L).
const L = {
  statusIdea: { sl: "Zamisel — ni še potrjena", en: "Idea — not confirmed yet", it: "Idea — non ancora confermata", de: "Idee — noch nicht bestätigt", fr: "Idée — pas encore confirmée", es: "Idea — aún sin confirmar" },
  statusConfirmed: { sl: "Potrjeno (uporabniški vnos)", en: "Confirmed (user entry)", it: "Confermata (inserimento utente)", de: "Bestätigt (Benutzereintrag)", fr: "Confirmée (saisie utilisateur)", es: "Confirmada (entrada de usuario)" },
  statusModified: { sl: "Spremenjeno (uporabniški vnos)", en: "Modified (user entry)", it: "Modificata (inserimento utente)", de: "Geändert (Benutzereintrag)", fr: "Modifiée (saisie utilisateur)", es: "Modificada (entrada de usuario)" },
  statusCancelled: { sl: "Preklicano", en: "Cancelled", it: "Cancellata", de: "Storniert", fr: "Annulée", es: "Cancelada" },
  confirmReservation: { sl: "Potrdi rezervacijo", en: "Confirm reservation", it: "Conferma la prenotazione", de: "Reservierung bestätigen", fr: "Confirmer la réservation", es: "Confirmar la reserva" },
  updateProof: { sl: "Posodobi potrdilo", en: "Update proof", it: "Aggiorna la prova", de: "Nachweis aktualisieren", fr: "Mettre à jour la preuve", es: "Actualizar la prueba" },
  cancelReservation: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Annuler", es: "Cancelar" },
  saveIdea: { sl: "Shrani kot zamisel", en: "Save as idea", it: "Salva come idea", de: "Als Idee speichern", fr: "Enregistrer comme idée", es: "Guardar como idea" },
  confirmWithProof: {
    sl: "Potrdi s potrdilom ponudnika …",
    en: "Confirm with provider proof …",
    it: "Conferma con la prova del fornitore …",
    de: "Mit Anbieternachweis bestätigen …",
    fr: "Confirmer avec la preuve du prestataire …",
    es: "Confirmar con la prueba del proveedor …",
  },
  close: { sl: "Zapri", en: "Close", it: "Chiudi", de: "Schließen", fr: "Fermer", es: "Cerrar" },
  modalTitleConfirm: { sl: "Potrdi rezervacijo", en: "Confirm reservation", it: "Conferma la prenotazione", de: "Reservierung bestätigen", fr: "Confirmer la réservation", es: "Confirmar la reserva" },
  modalTitleUpdate: { sl: "Posodobi potrdilo rezervacije", en: "Update reservation proof", it: "Aggiorna la prova della prenotazione", de: "Reservierungsnachweis aktualisieren", fr: "Mettre à jour la preuve de réservation", es: "Actualizar la prueba de la reserva" },
  modalHonesty: {
    sl: "To je tvoj vnos iz potrdila ponudnika — ni naša integracija. Podatki se shranijo kot uporabniška atestacija (source: USER).",
    en: "This is your entry from the provider's confirmation — not our integration. The data is saved as a user attestation (source: USER).",
    it: "Questo è il tuo inserimento dalla conferma del fornitore — non la nostra integrazione. I dati si salvano come attestazione utente (source: USER).",
    de: "Dies ist dein Eintrag aus der Bestätigung des Anbieters — nicht unsere Integration. Die Daten werden als Benutzer-Attestierung gespeichert (source: USER).",
    fr: "Ceci est ta saisie issue de la confirmation du prestataire — pas notre intégration. Les données sont enregistrées comme attestation utilisateur (source: USER).",
    es: "Esta es tu entrada de la confirmación del proveedor — no nuestra integración. Los datos se guardan como atestación de usuario (source: USER).",
  },
  forStop: { sl: "Postanek", en: "Stop", it: "Fermata", de: "Stopp", fr: "Arrêt", es: "Parada" },
  bookingIdLabel: {
    sl: "Številka rezervacije (potrdilo ponudnika)",
    en: "Booking number (provider confirmation)",
    it: "Numero di prenotazione (conferma del fornitore)",
    de: "Buchungsnummer (Anbieterbestätigung)",
    fr: "Numéro de réservation (confirmation du prestataire)",
    es: "Número de reserva (confirmación del proveedor)",
  },
  bookingIdPlaceholder: { sl: "npr. BLED-2026-114", en: "e.g. BLED-2026-114", it: "es. BLED-2026-114", de: "z. B. BLED-2026-114", fr: "ex. BLED-2026-114", es: "p. ej. BLED-2026-114" },
  priceLabel: { sl: "Cena (EUR)", en: "Price (EUR)", it: "Prezzo (EUR)", de: "Preis (EUR)", fr: "Prix (EUR)", es: "Precio (EUR)" },
  pricePlaceholder: { sl: "npr. 49,50", en: "e.g. 49.50", it: "es. 49.50", de: "z. B. 49.50", fr: "ex. 49.50", es: "p. ej. 49.50" },
  noteLabel: { sl: "Opomba", en: "Note", it: "Nota", de: "Notiz", fr: "Note", es: "Nota" },
  submitConfirm: { sl: "Shrani kot potrjeno", en: "Save as confirmed", it: "Salva come confermata", de: "Als bestätigt speichern", fr: "Enregistrer comme confirmée", es: "Guardar como confirmada" },
  submitUpdate: { sl: "Shrani spremembo", en: "Save change", it: "Salva la modifica", de: "Änderung speichern", fr: "Enregistrer la modification", es: "Guardar el cambio" },
  proofLine: { sl: "Potrdilo", en: "Proof", it: "Prova", de: "Nachweis", fr: "Preuve", es: "Prueba" },
  errBookingId: {
    sl: "Vpiši številko rezervacije iz potrdila ponudnika.",
    en: "Enter the booking number from the provider's confirmation.",
    it: "Inserisci il numero di prenotazione dalla conferma del fornitore.",
    de: "Gib die Buchungsnummer aus der Bestätigung des Anbieters ein.",
    fr: "Saisis le numéro de réservation de la confirmation du prestataire.",
    es: "Introduce el número de reserva de la confirmación del proveedor.",
  },
  errPrice: {
    sl: "Vpiši ceno iz potrdila ponudnika (število, večje od 0).",
    en: "Enter the price from the provider's confirmation (a number greater than 0).",
    it: "Inserisci il prezzo dalla conferma del fornitore (un numero maggiore di 0).",
    de: "Gib den Preis aus der Bestätigung des Anbieters ein (eine Zahl größer als 0).",
    fr: "Saisis le prix de la confirmation du prestataire (un nombre supérieur à 0).",
    es: "Introduce el precio de la confirmación del proveedor (un número mayor que 0).",
  },
  errStop: {
    sl: "Izberi postanek s seznama ali vpiši ime (vsaj 2 znaka).",
    en: "Pick a stop from the list or enter a name (at least 2 characters).",
    it: "Scegli una fermata dall'elenco o inserisci un nome (almeno 2 caratteri).",
    de: "Wähle einen Stopp aus der Liste oder gib einen Namen ein (mindestens 2 Zeichen).",
    fr: "Choisis un arrêt dans la liste ou saisis un nom (au moins 2 caractères).",
    es: "Elige una parada de la lista o introduce un nombre (al menos 2 caracteres).",
  },
} as const;

// ── Demo simulator (issue #1 področje 2 — REAL BOOKING VERIGA) ─────────────
// Iskanje ponudbe → izbor → rezervacija → potrditev, IZRECNO označeno kot
// SIMULIRANO (kanal demo je strogo ločen od realnega ponudnika, ki v
// peskovniku ni aktiven — fail-closed 503 na strežniku).
const DEMO_L = {
  bookDemo: { sl: "Rezerviraj (demo)", en: "Book (demo)", it: "Prenota (demo)", de: "Buchen (Demo)", fr: "Réserver (démo)", es: "Reservar (demo)" },
  modalTitle: { sl: "Išči ponudbo — demo simulator", en: "Search an offer — demo simulator", it: "Cerca un'offerta — simulatore demo", de: "Angebot suchen — Demo-Simulator", fr: "Rechercher une offre — simulateur démo", es: "Buscar una oferta — simulador demo" },
  modalDesc: {
    sl: "Izberi dan, postanek in ponudbo iz našega kanonskega nabora — simulator takoj izstavi demo potrditev.",
    en: "Pick a day, stop and an offer from our canonical set — the simulator issues a demo confirmation instantly.",
    it: "Scegli giorno, fermata e un'offerta dal nostro insieme canonico — il simulatore emette subito una conferma demo.",
    de: "Wähle Tag, Stopp und ein Angebot aus unserem kanonischen Set — der Simulator stellt sofort eine Demo-Bestätigung aus.",
    fr: "Choisis un jour, un arrêt et une offre de notre ensemble canonique — le simulateur émet instantanément une confirmation démo.",
    es: "Elige día, parada y una oferta de nuestro conjunto canónico — el simulador emite al instante una confirmación demo.",
  },
  honesty: {
    sl: "DEMO SIMULATOR — rezervacija je simulirana, ni realna potrditev ponudnika.",
    en: "DEMO SIMULATOR — the booking is simulated, not a real provider confirmation.",
    it: "SIMULATORE DEMO — la prenotazione è simulata, non una conferma reale del fornitore.",
    de: "DEMO-SIMULATOR — die Buchung ist simuliert, keine echte Anbieterbestätigung.",
    fr: "SIMULATEUR DÉMO — la réservation est simulée, pas une vraie confirmation du prestataire.",
    es: "SIMULADOR DEMO — la reserva es simulada, no una confirmación real del proveedor.",
  },
  realNote: {
    sl: "Realnega ponudniškega kanala ni mogoče uporabiti (ni poverilnic) — nikoli ne lažemo.",
    en: "The real provider channel cannot be used (no credentials) — we never lie.",
    it: "Il canale reale del fornitore non è utilizzabile (nessuna credenziale) — non mentiamo mai.",
    de: "Der echte Anbieterkanal kann nicht genutzt werden (keine Zugangsdaten) — wir lügen nie.",
    fr: "Le canal réel du prestataire ne peut pas être utilisé (aucun identifiant) — nous ne mentons jamais.",
    es: "El canal real del proveedor no se puede usar (sin credenciales) — nunca mentimos.",
  },
  day: { sl: "Dan", en: "Day", it: "Giorno", de: "Tag", fr: "Jour", es: "Día" },
  stop: { sl: "Postanek", en: "Stop", it: "Fermata", de: "Stopp", fr: "Arrêt", es: "Parada" },
  customStopLabel: { sl: "Ime postanka (ročni vnos)", en: "Stop name (manual entry)", it: "Nome della fermata (inserimento manuale)", de: "Stoppname (manueller Eintrag)", fr: "Nom de l'arrêt (saisie manuelle)", es: "Nombre de la parada (entrada manual)" },
  offerLabel: { sl: "Ponudba", en: "Offer", it: "Offerta", de: "Angebot", fr: "Offre", es: "Oferta" },
  perPerson: { sl: "/osebo", en: "/person", it: "/persona", de: "/Person", fr: "/personne", es: "/persona" },
  matchExact: { sl: "ta postanek", en: "this stop", it: "questa fermata", de: "dieser Stopp", fr: "cet arrêt", es: "esta parada" },
  matchRegion: { sl: "ista regija", en: "same region", it: "stessa regione", de: "gleiche Region", fr: "même région", es: "misma región" },
  matchSuggested: { sl: "predlog", en: "suggested", it: "suggerita", de: "vorgeschlagen", fr: "suggéré", es: "sugerida" },
  offerEmpty: { sl: "Ni ponudb — izberi drug postanek", en: "No offers — pick another stop", it: "Nessuna offerta — scegli un'altra fermata", de: "Keine Angebote — wähle einen anderen Stopp", fr: "Aucune offre — choisis un autre arrêt", es: "Sin ofertas — elige otra parada" },
  dateLabel: { sl: "Datum", en: "Date", it: "Data", de: "Datum", fr: "Date", es: "Fecha" },
  peopleLabel: { sl: "Število ljudi (1–12)", en: "People (1–12)", it: "Persone (1–12)", de: "Personen (1–12)", fr: "Personnes (1–12)", es: "Personas (1–12)" },
  nameLabel: { sl: "Ime na rezervaciji (neobvezno)", en: "Name on the booking (optional)", it: "Nome sulla prenotazione (facoltativo)", de: "Name auf der Buchung (optional)", fr: "Nom sur la réservation (facultatif)", es: "Nombre en la reserva (opcional)" },
  submit: { sl: "Rezerviraj (demo)", en: "Book (demo)", it: "Prenota (demo)", de: "Buchen (Demo)", fr: "Réserver (démo)", es: "Reservar (demo)" },
  successTitle: { sl: "Demo rezervacija potrjena", en: "Demo booking confirmed", it: "Prenotazione demo confermata", de: "Demo-Buchung bestätigt", fr: "Réservation démo confirmée", es: "Reserva demo confirmada" },
  successBody: {
    sl: (id: string) => `Številka ${id} je SIMULIRANA potrditev demo simulatorja — ni je mogoče unovčiti pri ponudniku.`,
    en: (id: string) => `Number ${id} is a SIMULATED confirmation of the demo simulator — it cannot be redeemed with a provider.`,
    it: (id: string) => `Il numero ${id} è una conferma SIMULATA del simulatore demo — non è riscattabile presso un fornitore.`,
    de: (id: string) => `Die Nummer ${id} ist eine SIMULIERTE Bestätigung des Demo-Simulators — sie kann bei keinem Anbieter eingelöst werden.`,
    fr: (id: string) => `Le numéro ${id} est une confirmation SIMULÉE du simulateur démo — elle ne peut pas être échangée chez un prestataire.`,
    es: (id: string) => `El número ${id} es una confirmación SIMULADA del simulador demo — no se puede canjear con un proveedor.`,
  },
  peopleWord: {
    sl: (n: number) => `${n} ${n === 1 ? "oseba" : n === 2 ? "osebi" : n === 3 || n === 4 ? "osebe" : "oseb"}`,
    en: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    it: (n: number) => `${n} ${n === 1 ? "persona" : "persone"}`,
    de: (n: number) => `${n} ${n === 1 ? "Person" : "Personen"}`,
    fr: (n: number) => `${n} ${n === 1 ? "personne" : "personnes"}`,
    es: (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`,
  },
  editTitle: { sl: "Spremeni demo rezervacijo", en: "Modify demo booking", it: "Modifica la prenotazione demo", de: "Demo-Buchung ändern", fr: "Modifier la réservation démo", es: "Modificar la reserva demo" },
  editDesc: {
    sl: "Spremeni datum, število ljudi ali ime — prehod teče skozi življenjski cikel rezervacije.",
    en: "Change the date, people or name — the change goes through the booking lifecycle.",
    it: "Cambia data, persone o nome — la modifica passa per il ciclo di vita della prenotazione.",
    de: "Ändere Datum, Personen oder Namen — die Änderung durchläuft den Buchungslebenszyklus.",
    fr: "Change la date, les personnes ou le nom — la modification passe par le cycle de vie de la réservation.",
    es: "Cambia la fecha, las personas o el nombre — el cambio pasa por el ciclo de vida de la reserva.",
  },
  editSubmit: { sl: "Shrani spremembo (demo)", en: "Save change (demo)", it: "Salva la modifica (demo)", de: "Änderung speichern (Demo)", fr: "Enregistrer la modification (démo)", es: "Guardar el cambio (demo)" },
  modify: { sl: "Spremeni", en: "Modify", it: "Modifica", de: "Ändern", fr: "Modifier", es: "Modificar" },
  cancelDemo: { sl: "Odpovej", en: "Cancel booking", it: "Annulla la prenotazione", de: "Buchung stornieren", fr: "Annuler la réservation", es: "Cancelar la reserva" },
  demoProof: { sl: "Demo potrditev", en: "Demo confirmation", it: "Conferma demo", de: "Demo-Bestätigung", fr: "Confirmation démo", es: "Confirmación demo" },
  channelWord: { sl: "kanal", en: "channel", it: "canale", de: "Kanal", fr: "canal", es: "canal" },
  errOffer: { sl: "Izberi ponudbo iz iskanja.", en: "Pick an offer from the search.", it: "Scegli un'offerta dalla ricerca.", de: "Wähle ein Angebot aus der Suche.", fr: "Choisis une offre dans la recherche.", es: "Elige una oferta de la búsqueda." },
  errDate: { sl: "Vpiši veljaven datum (YYYY-MM-DD).", en: "Enter a valid date (YYYY-MM-DD).", it: "Inserisci una data valida (AAAA-MM-GG).", de: "Gib ein gültiges Datum ein (JJJJ-MM-TT).", fr: "Saisis une date valide (AAAA-MM-JJ).", es: "Introduce una fecha válida (AAAA-MM-DD)." },
  errPeople: {
    sl: "Število ljudi mora biti celo število med 1 in 12.",
    en: "People must be a whole number between 1 and 12.",
    it: "Le persone devono essere un numero intero tra 1 e 12.",
    de: "Personen müssen eine ganze Zahl zwischen 1 und 12 sein.",
    fr: "Les personnes doivent être un nombre entier entre 1 et 12.",
    es: "Las personas deben ser un número entero entre 1 y 12.",
  },
} as const;

// ── Partner kanal (issue #1 dokončanje, v2.6.0 — vzorec MindTrip) ────────────
// REALNA rezervacija PRI partnerju prek vodene povezave /api/affiliate/go:
// iskanje → kartice ponudb → „Odpri pri partnerju" → „Sem rezerviral —
// dodaj na pot" (PENDING) → atestacija s partnerjevim potrdilom
// (CONFIRMED). Demo simulator in partner kanal sta STROGO ločena.
const PARTNER_L = {
  bookPartner: { sl: "Rezerviraj pri partnerju", en: "Book with a partner", it: "Prenota con un partner", de: "Bei einem Partner buchen", fr: "Réserver chez un partenaire", es: "Reservar con un socio" },
  tabPartner: { sl: "Pri partnerju", en: "With a partner", it: "Con un partner", de: "Bei einem Partner", fr: "Chez un partenaire", es: "Con un socio" },
  tabDemo: { sl: "Demo simulator", en: "Demo simulator", it: "Simulatore demo", de: "Demo-Simulator", fr: "Simulateur démo", es: "Simulador demo" },
  modalTitle: { sl: "Išči ponudbo", en: "Search an offer", it: "Cerca un'offerta", de: "Angebot suchen", fr: "Rechercher une offre", es: "Buscar una oferta" },
  modalDesc: {
    sl: "Dva jasno ločena kanala: realna rezervacija pri partnerju ali demo simulator — nikoli pomešano.",
    en: "Two clearly separated channels: a real booking with a partner or the demo simulator — never mixed.",
    it: "Due canali chiaramente separati: una prenotazione reale con un partner o il simulatore demo — mai mescolati.",
    de: "Zwei klar getrennte Kanäle: eine echte Buchung bei einem Partner oder der Demo-Simulator — nie vermischt.",
    fr: "Deux canaux clairement séparés : une vraie réservation chez un partenaire ou le simulateur démo — jamais mélangés.",
    es: "Dos canales claramente separados: una reserva real con un socio o el simulador demo — nunca mezclados.",
  },
  honesty: {
    sl: "Rezervacija se zaključi pri partnerju (odpre se njihova stran). Če rezerviraš prek naše povezave, portal podpiramo z ocenjeno provizijo partnerja (pogodbena).",
    en: "The booking is completed with the partner (their site opens). If you book through our link, you support the portal with the partner's estimated commission (contractual).",
    it: "La prenotazione si conclude con il partner (si apre il loro sito). Se prenoti tramite il nostro link, sostieni il portale con la provvigione stimata del partner (contrattuale).",
    de: "Die Buchung wird beim Partner abgeschlossen (seine Seite öffnet sich). Buchst du über unseren Link, unterstützt du das Portal mit der geschätzten Provision des Partners (vertraglich).",
    fr: "La réservation se finalise chez le partenaire (leur site s'ouvre). Si tu réserves via notre lien, tu soutiens le portail avec la commission estimée du partenaire (contractuelle).",
    es: "La reserva se completa con el socio (se abre su sitio). Si reservas a través de nuestro enlace, apoyas el portal con la comisión estimada del socio (contractual).",
  },
  day: { sl: "Dan", en: "Day", it: "Giorno", de: "Tag", fr: "Jour", es: "Día" },
  stop: { sl: "Postanek", en: "Stop", it: "Fermata", de: "Stopp", fr: "Arrêt", es: "Parada" },
  customStopLabel: { sl: "Ime postanka (ročni vnos)", en: "Stop name (manual entry)", it: "Nome della fermata (inserimento manuale)", de: "Stoppname (manueller Eintrag)", fr: "Nom de l'arrêt (saisie manuelle)", es: "Nombre de la parada (entrada manual)" },
  offersLabel: { sl: "Ponudbe partnerjev", en: "Partner offers", it: "Offerte dei partner", de: "Partnerangebote", fr: "Offres des partenaires", es: "Ofertas de socios" },
  offerEmpty: { sl: "Ni ponudb — izberi drug postanek", en: "No offers — pick another stop", it: "Nessuna offerta — scegli un'altra fermata", de: "Keine Angebote — wähle einen anderen Stopp", fr: "Aucune offre — choisis un autre arrêt", es: "Sin ofertas — elige otra parada" },
  commission: {
    // P0-F: null = ocena neznana do pogodbe (novi partnerji) — iskreno,
    // ne izmišljujemo odstotka, ki partnerjevi pogodbi še ni znan.
    sl: (pct: number | null) =>
      pct == null ? "provizija neznana (po pogodbi)" : `ocena ${pct} %, pogodbena`,
    en: (pct: number | null) =>
      pct == null ? "commission unknown (per contract)" : `estimate ${pct} %, contractual`,
    it: (pct: number | null) =>
      pct == null ? "provvigione sconosciuta (da contratto)" : `stima ${pct} %, contrattuale`,
    de: (pct: number | null) =>
      pct == null ? "Provision unbekannt (laut Vertrag)" : `Schätzung ${pct} %, vertraglich`,
    fr: (pct: number | null) =>
      pct == null ? "commission inconnue (selon le contrat)" : `estimation ${pct} %, contractuelle`,
    es: (pct: number | null) =>
      pct == null ? "comisión desconocida (según contrato)" : `estimación ${pct} %, contractual`,
  },
  airportLabel: { sl: "Letališče regije", en: "Region airport", it: "Aeroporto della regione", de: "Flughafen der Region", fr: "Aéroport de la région", es: "Aeropuerto de la región" },
  customSearchNote: {
    sl: "splošno iskanje pri partnerju (brez destinacije)",
    en: "general search with the partner (no destination)",
    it: "ricerca generale con il partner (senza destinazione)",
    de: "allgemeine Suche beim Partner (ohne Ziel)",
    fr: "recherche générale chez le partenaire (sans destination)",
    es: "búsqueda general con el socio (sin destino)",
  },
  openAtPartner: { sl: "Odpri pri partnerju", en: "Open with the partner", it: "Apri con il partner", de: "Beim Partner öffnen", fr: "Ouvrir chez le partenaire", es: "Abrir con el socio" },
  bookedFormTitle: { sl: "Sem rezerviral — dodaj na pot", en: "I have booked — add to my trip", it: "Ho prenotato — aggiungi al mio viaggio", de: "Ich habe gebucht — zu meiner Reise hinzufügen", fr: "J'ai réservé — ajouter à mon voyage", es: "Ya reservé — añadir a mi viaje" },
  pickPartnerHint: {
    sl: "Najprej izberi partnerja zgoraj — povezava te odpelje na njegovo stran.",
    en: "First pick a partner above — the link takes you to their site.",
    it: "Prima scegli un partner qui sopra — il link ti porta sul loro sito.",
    de: "Wähle zuerst oben einen Partner — der Link führt dich zu seiner Seite.",
    fr: "Choisis d'abord un partenaire ci-dessus — le lien t'amène sur leur site.",
    es: "Primero elige un socio arriba — el enlace te lleva a su sitio.",
  },
  dateLabel: { sl: "Datum", en: "Date", it: "Data", de: "Datum", fr: "Date", es: "Fecha" },
  peopleLabel: { sl: "Število ljudi (1–12)", en: "People (1–12)", it: "Persone (1–12)", de: "Personen (1–12)", fr: "Personnes (1–12)", es: "Personas (1–12)" },
  nameLabel: { sl: "Ime na rezervaciji (neobvezno)", en: "Name on the booking (optional)", it: "Nome sulla prenotazione (facoltativo)", de: "Name auf der Buchung (optional)", fr: "Nom sur la réservation (facultatif)", es: "Nombre en la reserva (opcional)" },
  formNote: {
    sl: "Rezervacijo in plačilo zaključiš pri partnerju; tu vodimo stanje, dokler ne vpišeš številke iz njegovega potrdila.",
    en: "You complete the booking and payment with the partner; here we track the status until you enter the number from their confirmation.",
    it: "Prenotazione e pagamento le completi con il partner; qui seguiamo lo stato finché non inserisci il numero dalla loro conferma.",
    de: "Buchung und Zahlung schließt du beim Partner ab; hier verfolgen wir den Status, bis du die Nummer aus seiner Bestätigung eingibst.",
    fr: "Tu termines la réservation et le paiement chez le partenaire ; ici, nous suivons le statut jusqu'à ce que tu saisisses le numéro de leur confirmation.",
    es: "La reserva y el pago los completas con el socio; aquí seguimos el estado hasta que introduzcas el número de su confirmación.",
  },
  submit: { sl: "Dodaj na pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
  successTitle: { sl: "Zapis dodan na pot", en: "Record added to your trip", it: "Record aggiunto al tuo viaggio", de: "Eintrag zu deiner Reise hinzugefügt", fr: "Entrée ajoutée à ton voyage", es: "Registro añadido a tu viaje" },
  pendingBadge: {
    sl: "ČAKA POTRDITEV — partner bo poslal potrdilo; številko vnesi, ko pride.",
    en: "AWAITING CONFIRMATION — the partner will send a confirmation; enter its number when it arrives.",
    it: "IN ATTESA DI CONFERMA — il partner invierà una conferma; inseriscine il numero quando arriva.",
    de: "BESTÄTIGUNG AUSSTEHEND — der Partner sendet eine Bestätigung; gib ihre Nummer ein, sobald sie ankommt.",
    fr: "EN ATTENTE DE CONFIRMATION — le partenaire enverra une confirmation ; saisis son numéro dès qu'elle arrive.",
    es: "PENDIENTE DE CONFIRMACIÓN — el socio enviará una confirmación; introduce su número cuando llegue.",
  },
  errOffer: { sl: "Izberi partnerja iz seznama ponudb.", en: "Pick a partner from the offer list.", it: "Scegli un partner dall'elenco offerte.", de: "Wähle einen Partner aus der Angebotsliste.", fr: "Choisis un partenaire dans la liste des offres.", es: "Elige un socio de la lista de ofertas." },
  errDate: { sl: "Vpiši veljaven datum (YYYY-MM-DD).", en: "Enter a valid date (YYYY-MM-DD).", it: "Inserisci una data valida (AAAA-MM-GG).", de: "Gib ein gültiges Datum ein (JJJJ-MM-TT).", fr: "Saisis une date valide (AAAA-MM-JJ).", es: "Introduce una fecha válida (AAAA-MM-DD)." },
  errPeople: {
    sl: "Število ljudi mora biti celo število med 1 in 12.",
    en: "People must be a whole number between 1 and 12.",
    it: "Le persone devono essere un numero intero tra 1 e 12.",
    de: "Personen müssen eine ganze Zahl zwischen 1 und 12 sein.",
    fr: "Les personnes doivent être un nombre entier entre 1 et 12.",
    es: "Las personas deben ser un número entero entre 1 y 12.",
  },
  // Vrstice seznama (partner zapis iz note)
  rowStatusPending: { sl: "Čaka potrditev partnerja", en: "Awaiting partner confirmation", it: "In attesa di conferma del partner", de: "Warten auf Partnerbestätigung", fr: "En attente de confirmation du partenaire", es: "Esperando confirmación del socio" },
  rowStatusConfirmed: { sl: "Potrjena (partner)", en: "Confirmed (partner)", it: "Confermata (partner)", de: "Bestätigt (Partner)", fr: "Confirmée (partenaire)", es: "Confirmada (socio)" },
  rowStatusModified: { sl: "Spremenjena (partner)", en: "Modified (partner)", it: "Modificata (partner)", de: "Geändert (Partner)", fr: "Modifiée (partenaire)", es: "Modificada (socio)" },
  rowStatusCancelled: { sl: "Preklicana", en: "Cancelled", it: "Cancellata", de: "Storniert", fr: "Annulée", es: "Cancelada" },
  manageAtPartner: { sl: "Upravljaj pri partnerju", en: "Manage with the partner", it: "Gestisci con il partner", de: "Beim Partner verwalten", fr: "Gérer chez le partenaire", es: "Gestionar con el socio" },
  enterProof: { sl: "Vnesi potrdilo partnerja", en: "Enter the partner confirmation", it: "Inserisci la conferma del partner", de: "Partnerbestätigung eingeben", fr: "Saisir la confirmation du partenaire", es: "Introducir la confirmación del socio" },
  modify: { sl: "Spremeni", en: "Modify", it: "Modifica", de: "Ändern", fr: "Modifier", es: "Modificar" },
  cancel: { sl: "Odpovej", en: "Cancel booking", it: "Annulla la prenotazione", de: "Buchung stornieren", fr: "Annuler la réservation", es: "Cancelar la reserva" },
  rowHint: {
    sl: "Dejansko spremembo ali preklic opraviš pri partnerju — tu označujemo stanje na poti.",
    en: "The actual change or cancellation is made with the partner — here we only track the status on your trip.",
    it: "La modifica o cancellazione effettiva si fa con il partner — qui segnamo solo lo stato sul tuo viaggio.",
    de: "Die eigentliche Änderung oder Stornierung erfolgt beim Partner — hier verfolgen wir nur den Status auf deiner Reise.",
    fr: "La modification ou l'annulation réelle se fait chez le partenaire — ici, nous suivons seulement le statut sur ton voyage.",
    es: "El cambio o la cancelación real se hace con el socio — aquí solo seguimos el estado en tu viaje.",
  },
  confirmTitle: { sl: "Vnesi potrdilo partnerja", en: "Enter the partner confirmation", it: "Inserisci la conferma del partner", de: "Partnerbestätigung eingeben", fr: "Saisir la confirmation du partenaire", es: "Introducir la confirmación del socio" },
  confirmDesc: {
    sl: "Prepiši številko rezervacije in ceno iz potrdila, ki ga je poslal partner — shranita se kot tvoja atestacija.",
    en: "Copy the booking number and price from the confirmation the partner sent you — they are saved as your attestation.",
    it: "Trascrivi il numero di prenotazione e il prezzo dalla conferma che ti ha inviato il partner — si salvano come tua attestazione.",
    de: "Übernimm Buchungsnummer und Preis aus der Bestätigung, die dir der Partner geschickt hat — sie werden als deine Attestierung gespeichert.",
    fr: "Recopie le numéro de réservation et le prix de la confirmation que le partenaire t'a envoyée — ils sont enregistrés comme ton attestation.",
    es: "Copia el número de reserva y el precio de la confirmación que te envió el socio — se guardan como tu atestación.",
  },
  bookingIdLabel: {
    sl: "Številka rezervacije (potrdilo partnerja)",
    en: "Booking number (partner confirmation)",
    it: "Numero di prenotazione (conferma del partner)",
    de: "Buchungsnummer (Partnerbestätigung)",
    fr: "Numéro de réservation (confirmation du partenaire)",
    es: "Número de reserva (confirmación del socio)",
  },
  bookingIdPlaceholder: { sl: "npr. 4529-8871", en: "e.g. 4529-8871", it: "es. 4529-8871", de: "z. B. 4529-8871", fr: "ex. 4529-8871", es: "p. ej. 4529-8871" },
  priceLabel: { sl: "Cena (EUR)", en: "Price (EUR)", it: "Prezzo (EUR)", de: "Preis (EUR)", fr: "Prix (EUR)", es: "Precio (EUR)" },
  pricePlaceholder: { sl: "npr. 89,90", en: "e.g. 89.90", it: "es. 89.90", de: "z. B. 89.90", fr: "ex. 89.90", es: "p. ej. 89.90" },
  errBookingId: {
    sl: "Vpiši številko rezervacije iz partnerjevega potrdila.",
    en: "Enter the booking number from the partner's confirmation.",
    it: "Inserisci il numero di prenotazione dalla conferma del partner.",
    de: "Gib die Buchungsnummer aus der Bestätigung des Partners ein.",
    fr: "Saisis le numéro de réservation de la confirmation du partenaire.",
    es: "Introduce el número de reserva de la confirmación del socio.",
  },
  errPrice: {
    sl: "Vpiši ceno iz partnerjevega potrdila (število, večje od 0).",
    en: "Enter the price from the partner's confirmation (a number greater than 0).",
    it: "Inserisci il prezzo dalla conferma del partner (un numero maggiore di 0).",
    de: "Gib den Preis aus der Bestätigung des Partners ein (eine Zahl größer als 0).",
    fr: "Saisis le prix de la confirmation du partenaire (un nombre supérieur à 0).",
    es: "Introduce el precio de la confirmación del socio (un número mayor que 0).",
  },
  submitConfirm: { sl: "Shrani kot potrjeno", en: "Save as confirmed", it: "Salva come confermata", de: "Als bestätigt speichern", fr: "Enregistrer comme confirmée", es: "Guardar como confirmada" },
  editTitle: { sl: "Spremeni partner rezervacijo", en: "Modify partner booking", it: "Modifica la prenotazione del partner", de: "Partnerbuchung ändern", fr: "Modifier la réservation du partenaire", es: "Modificar la reserva del socio" },
  editDesc: {
    sl: "Spremeni datum, število ljudi ali ime. Dejansko spremembo opraviš pri partnerju — tu vodimo stanje na poti.",
    en: "Change the date, people or name. The actual change is made with the partner — here we track the status on your trip.",
    it: "Cambia data, persone o nome. La modifica effettiva si fa con il partner — qui seguiamo lo stato sul tuo viaggio.",
    de: "Ändere Datum, Personen oder Namen. Die eigentliche Änderung erfolgt beim Partner — hier verfolgen wir den Status auf deiner Reise.",
    fr: "Change la date, les personnes ou le nom. La modification réelle se fait chez le partenaire — ici, nous suivons le statut sur ton voyage.",
    es: "Cambia la fecha, las personas o el nombre. El cambio real se hace con el socio — aquí seguimos el estado en tu viaje.",
  },
  editSubmit: { sl: "Shrani spremembo", en: "Save change", it: "Salva la modifica", de: "Änderung speichern", fr: "Enregistrer la modification", es: "Guardar el cambio" },
} as const;

/** Kanalne značke vrstic (issue #1: demo/uporabniška/realna/partner — razkritje ob statusu). */
const CHANNEL_BADGES: Record<
  "demo" | "user" | "real" | "partner",
  { label: { sl: string; en: string }; cls: string }
> = {
  demo: {
    label: RESERVATION_CHANNEL_LABELS.demo,
    // Demo jakost = ORANŽNA (nikoli zelena — simulator ni ponudnik).
    cls: "border-orange-500/50 text-orange-700 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  },
  user: {
    label: RESERVATION_CHANNEL_LABELS.user,
    // Uporabniška atestacija = VIJOLIČNA (kanon 51-c).
    cls: "border-violet-500/50 text-violet-700 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  },
  real: {
    label: RESERVATION_CHANNEL_LABELS.real,
    // Realni kanal bi bil smaragno „provider potrjen" — v peskovniku se
    // NIKOLI ne izriše (fail-closed 503 na strežniku).
    cls: "border-primary/50 text-primary bg-primary/5",
  },
  partner: {
    label: RESERVATION_CHANNEL_LABELS.partner,
    // Partner kanal (2.6.0) = SMARAGDNA jakost: rezervacija je REALNA in
    // živi pri partnerju (provizijsko razkrito) — nikoli indigo/modra.
    cls: "border-emerald-500/50 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
};

/**
 * Statusni žetoni (mostovni nabor pote). Uporabniško potrjena/spremenjena
 * vrstica je VIJOLIČNA — nikoli smaragdna „provider potrjeno" (kanon
 * izvirnika: izvor je vedno razkrit).
 */
const STATUS_BADGES: Record<
  string,
  { label: { sl: string; en: string; it: string; de: string; fr: string; es: string }; cls: string }
> = {
  IDEA: {
    label: { sl: L.statusIdea.sl, en: L.statusIdea.en, it: L.statusIdea.it, de: L.statusIdea.de, fr: L.statusIdea.fr, es: L.statusIdea.es },
    cls: "border-amber-500/50 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700",
  },
  CONFIRMED: {
    label: { sl: L.statusConfirmed.sl, en: L.statusConfirmed.en, it: L.statusConfirmed.it, de: L.statusConfirmed.de, fr: L.statusConfirmed.fr, es: L.statusConfirmed.es },
    cls: "border-violet-500/50 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-700",
  },
  MODIFIED: {
    label: { sl: L.statusModified.sl, en: L.statusModified.en, it: L.statusModified.it, de: L.statusModified.de, fr: L.statusModified.fr, es: L.statusModified.es },
    cls: "border-violet-500/50 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-700",
  },
  CANCELLED: {
    label: { sl: L.statusCancelled.sl, en: L.statusCancelled.en, it: L.statusCancelled.it, de: L.statusCancelled.de, fr: L.statusCancelled.fr, es: L.statusCancelled.es },
    cls: "border-border text-muted-foreground",
  },
};

/**
 * Statusni žetoni PARTNER vrstic (2.6.0 — življenjski cikel pri
 * partnerju): PENDING amber (čaka partnerja), CONFIRMED smaragdno
 * (uporabniška atestacija s partnerjevim potrdilom), MODIFIED vijolično,
 * CANCELLED rdeče (terminalno).
 */
const PARTNER_STATUS_BADGES: Record<
  string,
  { label: { sl: string; en: string; it: string; de: string; fr: string; es: string }; cls: string }
> = {
  PENDING: {
    label: { sl: PARTNER_L.rowStatusPending.sl, en: PARTNER_L.rowStatusPending.en, it: PARTNER_L.rowStatusPending.it, de: PARTNER_L.rowStatusPending.de, fr: PARTNER_L.rowStatusPending.fr, es: PARTNER_L.rowStatusPending.es },
    cls: "border-amber-500/50 text-amber-700 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  },
  CONFIRMED: {
    label: { sl: PARTNER_L.rowStatusConfirmed.sl, en: PARTNER_L.rowStatusConfirmed.en, it: PARTNER_L.rowStatusConfirmed.it, de: PARTNER_L.rowStatusConfirmed.de, fr: PARTNER_L.rowStatusConfirmed.fr, es: PARTNER_L.rowStatusConfirmed.es },
    cls: "border-emerald-500/50 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  MODIFIED: {
    label: { sl: PARTNER_L.rowStatusModified.sl, en: PARTNER_L.rowStatusModified.en, it: PARTNER_L.rowStatusModified.it, de: PARTNER_L.rowStatusModified.de, fr: PARTNER_L.rowStatusModified.fr, es: PARTNER_L.rowStatusModified.es },
    cls: "border-violet-500/50 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-700",
  },
  CANCELLED: {
    label: { sl: PARTNER_L.rowStatusCancelled.sl, en: PARTNER_L.rowStatusCancelled.en, it: PARTNER_L.rowStatusCancelled.it, de: PARTNER_L.rowStatusCancelled.de, fr: PARTNER_L.rowStatusCancelled.fr, es: PARTNER_L.rowStatusCancelled.es },
    cls: "border-red-500/50 text-red-700 bg-red-50 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300",
  },
};

const CUSTOM_STOP = "__custom__";

// ── MOST REZERVACIJA → NAVIGACIJA (issue #1 področje 5) ───────────────────────
// Vsaka vrstica z ZNANIM destSlug dobi most v navigacijski flow: primarna
// akcija odpri zunanjo navigacijo (OSM) do koordinat destinacije, sekundarna
// pa aplikacijski flow „Na poti" (živi GPS, ETA, napredek). Brez znanega
// sluga/koordinat gumba NI — do neznane lokacije ne navigiramo (iskrenost).
const NAV_L = {
  navigate: { sl: "Navigiraj", en: "Navigate", it: "Naviga", de: "Navigieren", fr: "Naviguer", es: "Navegar" },
  navigateTo: {
    sl: (name: string) => `Navigiraj do ${name}`,
    en: (name: string) => `Navigate to ${name}`,
    it: (name: string) => `Naviga verso ${name}`,
    de: (name: string) => `Navigiere zu ${name}`,
    fr: (name: string) => `Naviguer vers ${name}`,
    es: (name: string) => `Navegar a ${name}`,
  },
  navOptions: {
    sl: "Več možnosti navigacije",
    en: "More navigation options",
    it: "Altre opzioni di navigazione",
    de: "Weitere Navigationsoptionen",
    fr: "Plus d'options de navigation",
    es: "Más opciones de navegación",
  },
  openInGoMode: { sl: "Odpri v Na poti", en: "Open in On the way", it: "Apri in In viaggio", de: "In Unterwegs öffnen", fr: "Ouvrir dans En route", es: "Abrir en En camino" },
  goModeHint: {
    sl: "Navigacijski potek aplikacije z živim GPS in ETA",
    en: "The app's navigation flow with live GPS and ETA",
    it: "Il flusso di navigazione dell'app con GPS dal vivo ed ETA",
    de: "Der Navigationsfluss der App mit Live-GPS und ETA",
    fr: "Le flux de navigation de l'app avec GPS en direct et ETA",
    es: "El flujo de navegación de la app con GPS en vivo y ETA",
  },
} as const;

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Znesek v EUR (sl-SI / en-IE oblika) — izključno za prikaz atestacije. */
function formatPriceEUR(
  value: number,
  lang: "sl" | "en" | "it" | "de" | "fr" | "es"
): string {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-IE" : "sl-SI", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  } catch {
    return `${value.toFixed(2)} €`;
  }
}

export function TripReservations({
  shareId,
  plan,
  canEdit,
}: {
  shareId: string;
  plan: SharedPlan;
  canEdit: boolean;
}) {
  const l = useLocale();
  const lang: "sl" | "en" | "it" | "de" | "fr" | "es" = asPickLocale(l);

  const [rows, setRows] = useState<ReservationRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Obrazec
  const [dayValue, setDayValue] = useState<string>("1");
  const [stopValue, setStopValue] = useState<string>("");
  const [customStop, setCustomStop] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Modal „Potrdi rezervacijo" (51-c — uporabniška atestacija)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmBookingId, setConfirmBookingId] = useState("");
  const [confirmPrice, setConfirmPrice] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  // ── Demo simulator (issue #1 področje 2): modal „Išči ponudbo" ──────
  const { data: session } = useSession();
  const myUserId = session?.user?.id ?? null;

  // Modal „Išči ponudbo" (issue #1): zgornja izbira KANALA — partner
  // (REALNO, smaragdno) ali demo simulator (oranžno); strogo ločeno.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<SearchTab>("partner");
  const [demoDay, setDemoDay] = useState("1");
  const [demoStop, setDemoStop] = useState("");
  const [demoCustomStop, setDemoCustomStop] = useState("");
  const [demoOfferId, setDemoOfferId] = useState("");
  const [demoDate, setDemoDate] = useState("");
  const [demoPeople, setDemoPeople] = useState("2");
  const [demoName, setDemoName] = useState("");
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoDone, setDemoDone] = useState<{
    providerBookingId: string;
    price: number;
    stopName: string;
    people: number;
    date: string;
  } | null>(null);

  // Demo „Spremeni" modal (PATCH modify — življenjski cikel)
  const [demoEdit, setDemoEdit] = useState<ReservationRow | null>(null);
  const [demoEditDate, setDemoEditDate] = useState("");
  const [demoEditPeople, setDemoEditPeople] = useState("");
  const [demoEditName, setDemoEditName] = useState("");
  const [demoEditError, setDemoEditError] = useState<string | null>(null);

  // ── Partner kanal (issue #1 dokončanje, v2.6.0): zavihek „PRI PARTNERJU" ──
  // Izbira dneva + postanka je ločena od demo stanj (čisto, brez prepletov).
  const [ptDay, setPtDay] = useState("1");
  const [ptStop, setPtStop] = useState("");
  const [ptCustomStop, setPtCustomStop] = useState("");
  const [ptProvider, setPtProvider] = useState("");
  const [ptDate, setPtDate] = useState("");
  const [ptPeople, setPtPeople] = useState("2");
  const [ptName, setPtName] = useState("");
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [partnerDone, setPartnerDone] = useState<{
    providerName: string;
    stopName: string;
    date: string;
    people: number;
    goPath: string | null;
  } | null>(null);

  // Partner „Vnesi potrdilo" (PENDING → CONFIRMED — uporabnikova
  // atestacija s številko/ceno iz partnerjevega potrdila).
  const [partnerConfirm, setPartnerConfirm] = useState<ReservationRow | null>(null);
  const [partnerConfirmId, setPartnerConfirmId] = useState("");
  const [partnerConfirmPrice, setPartnerConfirmPrice] = useState("");
  const [partnerConfirmError, setPartnerConfirmError] = useState<string | null>(null);

  // Partner „Spremeni" (PATCH modify — indikativno; dejanska sprememba
  // teče PRI partnerju, tu vodimo stanje).
  const [partnerEdit, setPartnerEdit] = useState<ReservationRow | null>(null);
  const [partnerEditDate, setPartnerEditDate] = useState("");
  const [partnerEditPeople, setPartnerEditPeople] = useState("");
  const [partnerEditName, setPartnerEditName] = useState("");
  const [partnerEditError, setPartnerEditError] = useState<string | null>(null);

  const days = plan.days ?? [];
  const dayNumber = Math.min(Number(dayValue) || 1, Math.max(days.length, 1));
  const selectedDay = days.find((d) => d.day === dayNumber) ?? days[0];
  const stops = selectedDay?.locations ?? [];

  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/reservations`,
        { cache: "no-store" }
      );
      if (r.status === 404) {
        setRows([]);
        return;
      }
      if (!r.ok) {
        setLoadError(`Napaka ${r.status}`);
        return;
      }
      const data = (await r.json()) as { reservations?: ReservationRow[] };
      setRows(data.reservations ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(errText(e));
    }
  }, [shareId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ob spremenjenem dnevu ponastavi izbiro postanka.
  useEffect(() => {
    setStopValue(stops.length > 0 ? String(0) : CUSTOM_STOP);
  }, [dayValue, shareId, stops.length]);

  // Demo izpeljave: dan → postanek → slug destinacije (čisto iskanje).
  const demoDayNumber = Math.min(Number(demoDay) || 1, Math.max(days.length, 1));
  const demoSelectedDay = days.find((d) => d.day === demoDayNumber) ?? days[0];
  const demoStops = demoSelectedDay?.locations ?? [];
  const demoPeopleNum = Math.min(
    Math.max(Math.round(Number(demoPeople) || 0), 1),
    12
  );
  const demoStopSlug =
    demoStop === CUSTOM_STOP
      ? null
      : demoStops[Number(demoStop)]?.destSlug ?? null;
  const demoOffers = useMemo<DemoOffer[]>(
    () => searchDemoOffers(demoStopSlug, demoPeopleNum),
    [demoStopSlug, demoPeopleNum]
  );
  const selectedDemoOffer =
    demoOffers.find((o) => o.offerId === demoOfferId) ?? null;

  // Ob spremenjenem dnevu/odpiranju ponastavi izbiro demo postanka.
  useEffect(() => {
    setDemoStop(demoStops.length > 0 ? String(0) : CUSTOM_STOP);
  }, [demoDay, demoStops.length]);

  // Ponudba izven seznama (spremenjen postanek) → pošteno izberi prvo.
  useEffect(() => {
    if (demoOffers.length > 0 && !demoOffers.some((o) => o.offerId === demoOfferId)) {
      setDemoOfferId(demoOffers[0].offerId);
    }
  }, [demoOffers, demoOfferId]);

  // Partner izpeljave: dan → postanek → slug destinacije → REALNE ponudbe
  // partnerjev (searchPartnerOffers — do 5, z vodenimi povezavami).
  const ptDayNumber = Math.min(Number(ptDay) || 1, Math.max(days.length, 1));
  const ptSelectedDay = days.find((d) => d.day === ptDayNumber) ?? days[0];
  const ptStops = ptSelectedDay?.locations ?? [];
  const ptStopSlug =
    ptStop === CUSTOM_STOP
      ? null
      : ptStops[Number(ptStop)]?.destSlug ?? null;
  const ptOffers = useMemo<PartnerOffer[]>(
    () => searchPartnerOffers(ptStopSlug),
    [ptStopSlug]
  );
  const selectedPtOffer =
    ptOffers.find((o) => o.providerId === ptProvider) ?? null;

  // Ob spremenjenem dnevu ponastavi izbiro partner postanka.
  useEffect(() => {
    setPtStop(ptStops.length > 0 ? String(0) : CUSTOM_STOP);
  }, [ptDay, ptStops.length]);

  const closeSearchModal = useCallback(() => {
    setSearchOpen(false);
    setDemoError(null);
    setDemoDone(null);
    setPartnerError(null);
    setPartnerDone(null);
  }, []);

  /**
   * Odpri modal „Išči ponudbo" s čistim stanjem na izbranem zavihku
   * (partner = REALNA rezervacija pri partnerju; demo = simulator).
   */
  const openSearchModal = useCallback((tab: SearchTab) => {
    setDemoDay("1");
    setDemoCustomStop("");
    setDemoOfferId("");
    setDemoDate("");
    setDemoPeople("2");
    setDemoName("");
    setDemoError(null);
    setDemoDone(null);
    setPtDay("1");
    setPtCustomStop("");
    setPtProvider("");
    setPtDate("");
    setPtPeople("2");
    setPtName("");
    setPartnerError(null);
    setPartnerDone(null);
    setSearchTab(tab);
    setSearchOpen(true);
  }, []);

  /** POST /api/journey/bookings — demo rezervacija (server kuje DSA-DEMO-XXXX). */
  const submitDemoBooking = useCallback(async () => {
    const offer = demoOffers.find((o) => o.offerId === demoOfferId) ?? null;
    if (!offer) {
      setDemoError(pick(l, DEMO_L.errOffer));
      return;
    }
    if (!isValidBookingDate(demoDate)) {
      setDemoError(pick(l, DEMO_L.errDate));
      return;
    }
    const people = Math.round(Number(demoPeople));
    if (!Number.isInteger(people) || people < 1 || people > 12) {
      setDemoError(pick(l, DEMO_L.errPeople));
      return;
    }
    const customStopName =
      demoStop === CUSTOM_STOP
        ? demoCustomStop.trim()
        : demoStops[Number(demoStop)]?.name ?? "";
    const stopName = customStopName.length >= 2
      ? customStopName
      : `${offer.title.sl} (${offer.destinationName})`;
    const stopSlug =
      demoStop === CUSTOM_STOP ? null : demoStops[Number(demoStop)]?.destSlug ?? null;

    setBusy(true);
    setDemoError(null);
    try {
      const r = await fetch("/api/journey/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shareId,
          dayIndex: demoDayNumber,
          stopSlug,
          stopName,
          offerId: offer.offerId,
          date: demoDate,
          people,
          name: demoName.trim() || null,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        providerBookingId?: string;
        price?: number;
        reservation?: { stopName?: string };
      } | null;
      if (!r.ok || !data?.success) {
        // Iskrena napaka strežnika (401/403/404/503 „realni kanal ni aktiven").
        setDemoError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setDemoDone({
        providerBookingId: data.providerBookingId ?? "",
        price: typeof data.price === "number" ? data.price : offer.totalPrice,
        stopName: data.reservation?.stopName ?? stopName,
        people,
        date: demoDate,
      });
      setActionError(null);
      await load();
    } catch (e) {
      setDemoError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [shareId, l, demoOffers, demoOfferId, demoDate, demoPeople, demoStop, demoCustomStop, demoStops, demoName, demoDayNumber, load]);

  /** PATCH action:"cancel" — preklic DEMO rezervacije (CANCELLED terminalen). */
  const cancelDemoReservation = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch("/api/journey/bookings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reservationId: id, action: "cancel" }),
        });
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        await load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  /** Odpri modal „Spremeni demo rezervacijo" (predhodno polnjenje iz note). */
  const openDemoEdit = useCallback((row: ReservationRow) => {
    const record = parseDemoNote(row.note);
    setDemoEdit(row);
    setDemoEditDate(record?.date ?? "");
    setDemoEditPeople(record ? String(record.people) : "");
    setDemoEditName(record?.name ?? "");
    setDemoEditError(null);
  }, []);

  /** PATCH action:"modify" — sprememba DEMO rezervacije (CONFIRMED→MODIFIED). */
  const submitDemoModify = useCallback(async () => {
    if (!demoEdit) return;
    if (!isValidBookingDate(demoEditDate)) {
      setDemoEditError(pick(l, DEMO_L.errDate));
      return;
    }
    const people = Math.round(Number(demoEditPeople));
    if (!Number.isInteger(people) || people < 1 || people > 12) {
      setDemoEditError(pick(l, DEMO_L.errPeople));
      return;
    }
    setBusy(true);
    setDemoEditError(null);
    try {
      const r = await fetch("/api/journey/bookings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationId: demoEdit.id,
          action: "modify",
          date: demoEditDate,
          people,
          name: demoEditName.trim() || null,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setDemoEditError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setDemoEdit(null);
      setActionError(null);
      await load();
    } catch (e) {
      setDemoEditError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [demoEdit, demoEditDate, demoEditPeople, demoEditName, l, load]);

  /**
   * POST /api/journey/bookings (channel:"partner") — zapis na pot s
   * stanjem PENDING: rezervacija in plačilo se DEJANSKO zaključita pri
   * partnerju (vodena povezava); tu vodimo stanje do njegovega potrdila.
   * Številke/cene klient POZITIVNO ne pošilja (kujeta se izključno ob
   * potrditvi prek PATCH confirm).
   */
  const submitPartnerBooking = useCallback(async () => {
    const offer = selectedPtOffer;
    if (!offer) {
      setPartnerError(pick(l, PARTNER_L.errOffer));
      return;
    }
    if (!isValidBookingDate(ptDate)) {
      setPartnerError(pick(l, PARTNER_L.errDate));
      return;
    }
    const people = Math.round(Number(ptPeople));
    if (!Number.isInteger(people) || people < 1 || people > 12) {
      setPartnerError(pick(l, PARTNER_L.errPeople));
      return;
    }
    // Ime postanka: seznam ali ročni vnos (≥ 2 znaka); sicer pusti
    // strežniku, da zgradi iskreno privzeto oznako iz ponudbe partnerja.
    const customStopName =
      ptStop === CUSTOM_STOP
        ? ptCustomStop.trim()
        : ptStops[Number(ptStop)]?.name ?? "";
    const stopName = customStopName.length >= 2 ? customStopName : null;
    const stopSlug =
      ptStop === CUSTOM_STOP ? null : ptStops[Number(ptStop)]?.destSlug ?? null;

    setBusy(true);
    setPartnerError(null);
    try {
      const r = await fetch("/api/journey/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shareId,
          channel: "partner",
          provider: offer.providerId,
          destinationSlug: offer.destinationSlug || "",
          dayIndex: ptDayNumber,
          stopSlug,
          stopName,
          date: ptDate,
          people,
          name: ptName.trim() || null,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        providerName?: string;
        goPath?: string;
        reservation?: { stopName?: string };
      } | null;
      if (!r.ok || !data?.success) {
        // Iskrena napaka strežnika (400 validacija / 401 / 403 / 404 / 429).
        setPartnerError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setPartnerDone({
        providerName: data.providerName ?? offer.providerName,
        stopName: data.reservation?.stopName ?? (stopName ?? offer.providerName),
        people,
        date: ptDate,
        goPath: typeof data.goPath === "string" ? data.goPath : null,
      });
      setActionError(null);
      await load();
    } catch (e) {
      setPartnerError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [shareId, l, selectedPtOffer, ptDate, ptPeople, ptStop, ptCustomStop, ptStops, ptName, ptDayNumber, load]);

  /**
   * PATCH action:"cancel" — partner rezervacija (DEJANSKI preklic teče
   * pri partnerju; tu iskreno označimo stanje CANCELLED).
   */
  const cancelPartnerReservation = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch("/api/journey/bookings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reservationId: id, action: "cancel" }),
        });
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        await load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  /** Odpri modal „Vnesi potrdilo partnerja" (PENDING → CONFIRMED). */
  const openPartnerConfirm = useCallback((row: ReservationRow) => {
    setPartnerConfirm(row);
    setPartnerConfirmId("");
    setPartnerConfirmPrice("");
    setPartnerConfirmError(null);
  }, []);

  /**
   * PATCH action:"confirm" — uporabniška atestacija s partnerjevim
   * potrdilom (številka + cena sta OBVEZNI in pozitivni).
   */
  const submitPartnerConfirm = useCallback(async () => {
    if (!partnerConfirm) return;
    const ref = partnerConfirmId.trim();
    if (ref.length < 1) {
      setPartnerConfirmError(pick(l, PARTNER_L.errBookingId));
      return;
    }
    const price = Number(partnerConfirmPrice.trim().replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      setPartnerConfirmError(pick(l, PARTNER_L.errPrice));
      return;
    }
    setBusy(true);
    setPartnerConfirmError(null);
    try {
      const r = await fetch("/api/journey/bookings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationId: partnerConfirm.id,
          action: "confirm",
          providerBookingId: ref,
          confirmedPrice: price,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setPartnerConfirmError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setPartnerConfirm(null);
      setActionError(null);
      await load();
    } catch (e) {
      setPartnerConfirmError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [partnerConfirm, partnerConfirmId, partnerConfirmPrice, l, load]);

  /** Odpri modal „Spremeni partner rezervacijo" (polnjenje iz note). */
  const openPartnerEdit = useCallback((row: ReservationRow) => {
    const record = parsePartnerNote(row.note);
    setPartnerEdit(row);
    setPartnerEditDate(record?.date ?? "");
    setPartnerEditPeople(record ? String(record.people) : "");
    setPartnerEditName(record?.name ?? "");
    setPartnerEditError(null);
  }, []);

  /**
   * PATCH action:"modify" — indikativna sprememba (datum/ljudje/ime);
   * DEJANSKA sprememba teče pri partnerju (iskrena povezava v vrstici).
   */
  const submitPartnerModify = useCallback(async () => {
    if (!partnerEdit) return;
    if (!isValidBookingDate(partnerEditDate)) {
      setPartnerEditError(pick(l, PARTNER_L.errDate));
      return;
    }
    const people = Math.round(Number(partnerEditPeople));
    if (!Number.isInteger(people) || people < 1 || people > 12) {
      setPartnerEditError(pick(l, PARTNER_L.errPeople));
      return;
    }
    setBusy(true);
    setPartnerEditError(null);
    try {
      const r = await fetch("/api/journey/bookings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationId: partnerEdit.id,
          action: "modify",
          date: partnerEditDate,
          people,
          name: partnerEditName.trim() || null,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setPartnerEditError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setPartnerEdit(null);
      setActionError(null);
      await load();
    } catch (e) {
      setPartnerEditError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [partnerEdit, partnerEditDate, partnerEditPeople, partnerEditName, l, load]);

  /** Reši postanek obrazca (seznam ali ročni vnos) — null, če ni veljaven. */
  const resolveStop = useCallback((): { stopName: string; stopSlug: string | null } | null => {
    const stopName =
      stopValue === CUSTOM_STOP
        ? customStop.trim()
        : stops[Number(stopValue)]?.name ?? "";
    if (stopName.length < 2) return null;
    return {
      stopName,
      stopSlug:
        stopValue === CUSTOM_STOP
          ? null
          : stops[Number(stopValue)]?.destSlug ?? null,
    };
  }, [stopValue, customStop, stops]);

  /** Shrani vrstico kot ZAMISEL (status IDEA — brez atestacije). */
  const saveIdeaReservation = useCallback(async () => {
    const resolved = resolveStop();
    if (!resolved) {
      setActionError("Izberi postanek s seznama ali vpiši ime (vsaj 2 znaka).");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/reservations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dayIndex: dayNumber,
            stopSlug: resolved.stopSlug,
            stopName: resolved.stopName,
            status: "IDEA",
            note: note.trim() || null,
          }),
        }
      );
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setActionError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setFormOpen(false);
      setCustomStop("");
      setNote("");
      setActionError(null);
      await load();
    } catch (e) {
      setActionError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [shareId, dayNumber, note, resolveStop, load]);

  /** Odpre modal s predhodnim polnjenjem (iz vrstice ali obrazca). */
  const openConfirmModal = useCallback(
    (target: ConfirmTarget) => {
      setConfirmTarget(target);
      setModalError(null);
      if (target.kind === "create") {
        setConfirmBookingId("");
        setConfirmPrice("");
        setConfirmNote(note.trim());
      } else {
        const att = parseAttestationNote(target.row.note);
        setConfirmBookingId(att?.providerBookingId ?? "");
        setConfirmPrice(att ? String(att.confirmedPrice) : "");
        setConfirmNote(noteTextOf(target.row.note) ?? "");
      }
    },
    [note]
  );

  const closeConfirmModal = useCallback(() => {
    setConfirmTarget(null);
    setModalError(null);
  }, []);

  /**
   * Oddaja uporabniške atestacije: POST (nov potrjen vnos) ali PATCH
   * (IDEA → CONFIRMED / CONFIRMED-MODIFIED → MODIFIED). Napaka strežnika
   * (400 atestacija / 503 provider kanal) se izpiše iskreno v modalu.
   */
  const submitConfirmation = useCallback(async () => {
    if (!confirmTarget) return;
    const bookingId = confirmBookingId.trim();
    if (bookingId.length < 1) {
      setModalError(pick(l, L.errBookingId));
      return;
    }
    const price = Number(confirmPrice.trim().replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      setModalError(pick(l, L.errPrice));
      return;
    }
    let payload: Record<string, unknown>;
    if (confirmTarget.kind === "create") {
      const resolved = resolveStop();
      if (!resolved) {
        setModalError(pick(l, L.errStop));
        return;
      }
      payload = {
        dayIndex: dayNumber,
        stopSlug: resolved.stopSlug,
        stopName: resolved.stopName,
        status: "CONFIRMED",
        source: "USER",
        providerBookingId: bookingId,
        confirmedPrice: price,
        note: confirmNote.trim() || null,
      };
    } else {
      payload = {
        id: confirmTarget.row.id,
        status: confirmTarget.kind === "update" ? "MODIFIED" : "CONFIRMED",
        source: "USER",
        providerBookingId: bookingId,
        confirmedPrice: price,
        note: confirmNote.trim() || null,
      };
    }
    setBusy(true);
    setModalError(null);
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/reservations`,
        {
          method: confirmTarget.kind === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        // Iskrena napaka strežnika (npr. 503 „Provider kanal ni aktiven").
        setModalError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      if (confirmTarget.kind === "create") {
        setFormOpen(false);
        setCustomStop("");
        setNote("");
      }
      setConfirmTarget(null);
      setActionError(null);
      await load();
    } catch (e) {
      setModalError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [confirmTarget, confirmBookingId, confirmPrice, confirmNote, shareId, dayNumber, resolveStop, load, l]);

  /** Preklic (CANCELLED — terminalen, brez povratkov). */
  const cancelReservation = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/reservations`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, status: "CANCELLED" }),
          }
        );
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        await load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [shareId, load]
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/reservations`,
          {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id }),
          }
        );
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        await load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [shareId, load]
  );

  const modalStopName =
    confirmTarget === null
      ? ""
      : confirmTarget.kind === "create"
        ? (resolveStop()?.stopName ?? "")
        : confirmTarget.row.stopName;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TicketCheck className="size-5 text-primary" aria-hidden="true" />
          Rezervacije
          {rows && rows.length > 0 ? (
            <Badge variant="secondary" className="ml-1 font-normal">
              {rows.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}
        {actionError ? (
          <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {actionError}
          </p>
        ) : null}

        {/* ── Seznam rezervacij ─────────────────────────────────────── */}
        {rows === null ? (
          <p role="status" className="text-sm text-muted-foreground">
            Nalagam rezervacije …
          </p>
        ) : rows.length > 0 ? (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {rows.map((b) => {
              // Kanal zapisa (issue #1): demo simulator / partner /
              // uporabniška atestacija / realni ponudnik — razkritje ob
              // statusnem žetonu.
              const channel = reservationChannelOf(b.note);
              const channelBadge = channel ? CHANNEL_BADGES[channel] : null;
              const demoRecord = channel === "demo" ? parseDemoNote(b.note) : null;
              // Partner zapis (2.6.0): rezervacija ŽIVI pri partnerju —
              // vrstica nosi ponudnika, stanje in (ob atestaciji)
              // številko + ceno iz njegovega potrdila.
              const partnerRecord = channel === "partner" ? parsePartnerNote(b.note) : null;
              // Statusne žetone partner vrstice nosi partner nabor
              // (PENDING amber / CONFIRMED smaragdno / …).
              const badge = partnerRecord
                ? PARTNER_STATUS_BADGES[b.status] ?? null
                : STATUS_BADGES[b.status] ?? null;
              // Neznan status → iskrena oznaka kanonske knjižnice (brez
              // izmišljenega prevoda).
              const badgeLabel = badge ? pick(l, badge.label) : statusLabel(b.status, lang);
              const attestation = parseAttestationNote(b.note);
              // Partner zapis nima proste opombe — noteTextOf bi za PENDING
              // (brez številke) vrnil surov JSON; iskreno ne izpišemo nič.
              const noteText = partnerRecord ? null : noteTextOf(b.note);
              // Demo rezervacijo spreminja SAMO njen lastnik (strežnik
              // preverja createdBy; UI le pošteno skrije tuje akcije).
              const demoMine = channel === "demo" && b.createdBy === myUserId;
              // Partner akcije (PATCH) prav tako samo za lastnika zapisa.
              const partnerMine = channel === "partner" && b.createdBy === myUserId;
              // VODENA povezava „Upravljaj pri partnerju" — dest parameter
              // SAMO če je destinationSlug znan (custom postanek brez njega).
              const partnerManageUrl = partnerRecord
                ? partnerRecord.destinationSlug
                  ? `/api/affiliate/go?provider=${encodeURIComponent(partnerRecord.provider)}&dest=${encodeURIComponent(partnerRecord.destinationSlug)}`
                  : `/api/affiliate/go?provider=${encodeURIComponent(partnerRecord.provider)}`
                : null;
              // MOST v navigacijo (issue #1 področje 5): postanek z znanim
              // destSlug → destinacija s koordinatami; ročni vnosi (brez
              // sluga) ostanejo brez navigacije — do neznane lokacije ne
              // ponujamo poti (iskrenost).
              const navDest = b.stopSlug ? getDestination(b.stopSlug) : null;
              return (
                <li key={b.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Dan {b.dayIndex}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold break-words">
                      {b.stopName}
                    </span>
                    <Badge variant="outline" className={badge?.cls ?? "border-border"}>
                      {badgeLabel}
                    </Badge>
                    {channelBadge ? (
                      <Badge
                        variant="outline"
                        className={`gap-1 ${channelBadge.cls}`}
                        title={`${pick(l, DEMO_L.channelWord)}: ${channel}`}
                      >
                        {channel === "demo" ? (
                          <FlaskConical className="size-3" aria-hidden="true" />
                        ) : channel === "partner" ? (
                          <Handshake className="size-3" aria-hidden="true" />
                        ) : null}
                        {channel === "partner" && partnerRecord
                          ? `${partnerRecord.providerName} · ${pick(l, channelBadge.label)}`
                          : pick(l, channelBadge.label)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {/* PARTNER razkritje: ponudnik + datum/ljudje/ime + */}
                    {/* številka iz partnerjevega potrdila (font-mono) + */}
                    {/* atestirana cena — rezervacija živi pri partnerju. */}
                    {partnerRecord ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-foreground/80">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Handshake
                            className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-hidden="true"
                          />
                          {partnerRecord.providerName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {pick(l, DEMO_L.peopleWord)(partnerRecord.people)} · {partnerRecord.date}
                          {partnerRecord.name ? ` · ${partnerRecord.name}` : ""}
                        </span>
                        {partnerRecord.providerBookingId ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[11px]">
                              {partnerRecord.providerBookingId}
                            </span>
                          </>
                        ) : null}
                        {partnerRecord.confirmedPrice != null ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{formatPriceEUR(partnerRecord.confirmedPrice, lang)}</span>
                          </>
                        ) : null}
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          kanal: partner (provizijsko)
                        </span>
                      </div>
                    ) : demoRecord ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-foreground/80">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <FlaskConical
                            className="size-3.5 shrink-0 text-orange-600 dark:text-orange-400"
                            aria-hidden="true"
                          />
                          {pick(l, DEMO_L.demoProof)}: {demoRecord.providerBookingId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatPriceEUR(demoRecord.price, lang)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {pick(l, DEMO_L.peopleWord)(demoRecord.people)} · {demoRecord.date}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          kanal: demo (simulator)
                        </span>
                      </div>
                    ) : attestation ? (
                      /* Razkritje izvora: št. rezervacije + cena + source — */
                      /* vedno uporabniška atestacija, nikoli provider kanal. */
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-foreground/80">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <BadgeCheck className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                          {pick(l, L.proofLine)}: {attestation.providerBookingId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatPriceEUR(attestation.confirmedPrice, lang)}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          source: {attestation.source}
                        </span>
                      </div>
                    ) : null}
                    {noteText ? <div className="whitespace-pre-line">Opomba: {noteText}</div> : null}
                    <div>
                      Vpisano {new Date(b.createdAt).toLocaleDateString("sl-SI")}
                    </div>
                  </div>

                  {/* ── MOST REZERVACIJA → NAVIGACIJA (issue #1 §5) ──────────
                      Na voljo VSEM (tudi ne-urednikom) — navigacija ni
                      mutacija. Primarno: zunanja navigacija do koordinat
                      destinacije (OSM, nov zavihek, rel=noopener). */}
                  {navDest ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-11 gap-1.5 border-primary/40 font-semibold text-primary"
                      >
                        <a
                          href={osmDirectionsUrl(navDest.coords)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={pick(l, NAV_L.navigateTo)(b.stopName)}
                          title={pick(l, NAV_L.navigateTo)(b.stopName)}
                        >
                          <Navigation className="size-4" aria-hidden="true" />
                          {pick(l, NAV_L.navigate)}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                      {/* Sekundarno: aplikacijski navigacijski flow (Na poti —
                          živi GPS, ETA, napredek po poti). */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-11 gap-1 px-3"
                            aria-label={pick(l, NAV_L.navOptions)}
                          >
                            <RouteIcon className="size-4" aria-hidden="true" />
                            <ChevronDown className="size-3.5" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem asChild>
                            <Link
                              href="/na-poti"
                              title={pick(l, NAV_L.goModeHint)}
                              className="gap-2"
                            >
                              <RouteIcon className="size-4" aria-hidden="true" />
                              {pick(l, NAV_L.openInGoMode)}
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}

                  {/* ── PARTNER: vodena povezava „Upravljaj pri partnerju" ──
                      Na voljo na VSAKI partner vrstici (tudi ne-urednikom
                      — povezava ni mutacija): DEJANSKA sprememba/preklic
                      rezervacije teče pri partnerju (rel sponsored
                      noopener; klik se šteje prek /api/affiliate/go). */}
                  {partnerRecord && partnerManageUrl ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-11 gap-1.5 border-emerald-600/50 font-semibold text-emerald-700 hover:text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                      >
                        <a
                          href={partnerManageUrl}
                          target="_blank"
                          rel="nofollow sponsored noopener"
                          aria-label={`${pick(l, PARTNER_L.manageAtPartner)}: ${partnerRecord.providerName}`}
                          title={`${pick(l, PARTNER_L.manageAtPartner)}: ${partnerRecord.providerName}`}
                        >
                          <Handshake className="size-4" aria-hidden="true" />
                          {pick(l, PARTNER_L.manageAtPartner)}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                    </div>
                  ) : null}
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {/* ── Demo akcije (PATCH /api/journey/bookings) ── */}
                      {demoMine ? (
                        <>
                          {b.status === "CONFIRMED" || b.status === "MODIFIED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDemoEdit(b)}
                              disabled={busy}
                              className="min-h-11 gap-1.5"
                            >
                              <PenLine className="size-4" aria-hidden="true" />
                              {pick(l, DEMO_L.modify)}
                            </Button>
                          ) : null}
                          {b.status !== "CANCELLED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void cancelDemoReservation(b.id)}
                              disabled={busy}
                              className="min-h-11 gap-1.5"
                            >
                              <Ban className="size-4" aria-hidden="true" />
                              {pick(l, DEMO_L.cancelDemo)}
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {/* ── Partner akcije (PATCH /api/journey/bookings,
                          kanal partner — življenjski cikel pri partnerju) ── */}
                      {partnerMine ? (
                        <>
                          {b.status === "PENDING" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPartnerConfirm(b)}
                              disabled={busy}
                              className="min-h-11 gap-1.5 border-amber-500/50 font-semibold text-amber-700 hover:text-amber-800 dark:border-amber-700 dark:text-amber-300"
                            >
                              <Hourglass className="size-4" aria-hidden="true" />
                              {pick(l, PARTNER_L.enterProof)}
                            </Button>
                          ) : null}
                          {b.status === "PENDING" ||
                          b.status === "CONFIRMED" ||
                          b.status === "MODIFIED" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPartnerEdit(b)}
                                disabled={busy}
                                className="min-h-11 gap-1.5"
                              >
                                <PenLine className="size-4" aria-hidden="true" />
                                {pick(l, PARTNER_L.modify)}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void cancelPartnerReservation(b.id)}
                                disabled={busy}
                                className="min-h-11 gap-1.5"
                              >
                                <Ban className="size-4" aria-hidden="true" />
                                {pick(l, PARTNER_L.cancel)}
                              </Button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      {/* ── S1 atestacijske akcije (kanon 51-c ostaja) ── */}
                      {!demoRecord && !partnerRecord && b.status === "IDEA" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirmModal({ kind: "confirm", row: b })}
                          disabled={busy}
                          className="min-h-11 gap-1.5"
                        >
                          <CircleCheck className="size-4" aria-hidden="true" />
                          {pick(l, L.confirmReservation)}
                        </Button>
                      ) : null}
                      {!demoRecord && !partnerRecord && (b.status === "CONFIRMED" || b.status === "MODIFIED") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirmModal({ kind: "update", row: b })}
                          disabled={busy}
                          className="min-h-11 gap-1.5"
                        >
                          <PenLine className="size-4" aria-hidden="true" />
                          {pick(l, L.updateProof)}
                        </Button>
                      ) : null}
                      {!demoRecord && !partnerRecord && b.status !== "CANCELLED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void cancelReservation(b.id)}
                          disabled={busy}
                          className="min-h-11 gap-1.5"
                        >
                          <Ban className="size-4" aria-hidden="true" />
                          {pick(l, L.cancelReservation)}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void remove(b.id)}
                        disabled={busy}
                        aria-label={`Odstrani rezervacijo: ${b.stopName}`}
                        className="min-h-11 gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Odstrani
                      </Button>
                    </div>
                  ) : null}
                  {/* Partner opomba k akcijam: DEJANSKA sprememba/preklic
                      tečeta pri partnerju — tu označujemo stanje poti. */}
                  {canEdit && partnerMine && b.status !== "CANCELLED" ? (
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      {pick(l, PARTNER_L.rowHint)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Še ni rezervacij.{" "}
            {canEdit
              ? "Dodaj zamisel ali potrjen vnos za posamezen postanek pote."
              : "Uredniki poti jih lahko dodajo."}
          </p>
        )}

        {/* ── Obrazec: dodaj rezervacijo ───────────────────────────── */}
        {canEdit ? (
          formOpen ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Vpiši dogovor s ponudnikom za posamezen postanek pote.
                Zapis je tvoj vnos (izrecno označen) — nikoli ponudnikova
                potrditev prek naše integracije.
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="res-day">Dan</Label>
                  <Select value={String(dayNumber)} onValueChange={setDayValue}>
                    <SelectTrigger id="res-day" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((d) => (
                        <SelectItem key={d.day} value={String(d.day)}>
                          Dan {d.day}
                          {d.title ? ` — ${d.title}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-stop">Postanek</Label>
                  <Select value={stopValue} onValueChange={setStopValue}>
                    <SelectTrigger id="res-stop" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stops.map((s, i) => (
                        <SelectItem key={`${s.name}-${i}`} value={String(i)}>
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_STOP}>
                        Drugo (ročni vnos)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {stopValue === CUSTOM_STOP ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="res-custom-stop">Ime postanka / ponudnika *</Label>
                    <Input
                      id="res-custom-stop"
                      value={customStop}
                      maxLength={200}
                      onChange={(e) => setCustomStop(e.target.value)}
                      placeholder="npr. Gostilna Pri Lovcu"
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="res-note">Opomba</Label>
                  <Input
                    id="res-note"
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="npr. rezervirana miza za 4 ob 19:00, odpoved do 24 h prej"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => openConfirmModal({ kind: "create" })}
                  disabled={busy}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CircleCheck className="size-4" aria-hidden="true" />
                  )}
                  {pick(l, L.confirmWithProof)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void saveIdeaReservation()}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {pick(l, L.saveIdea)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFormOpen(false);
                    setActionError(null);
                  }}
                  disabled={busy}
                >
                  Prekliči
                </Button>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                „{pick(l, L.confirmWithProof).replace(" …", "")}" zahteva številko
                rezervacije in ceno iz potrdila ponudnika — shranita se kot tvoja
                atestacija (source: USER), nikoli kot naša integracija s ponudnikom.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormOpen(true)}
                className="min-h-11 gap-1.5"
              >
                <Plus className="size-4" aria-hidden="true" />
                Dodaj rezervacijo
              </Button>
              {/* Partner kanal (issue #1, v2.6.0 — vzorec MindTrip):
                  REALNA rezervacija pri partnerju; modal „Išči ponudbo"
                  odpre na zavihku PRI PARTNERJU (smaragdno, provizijsko
                  razkrito). */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSearchModal("partner")}
                className="min-h-11 gap-1.5 border-emerald-600/50 text-emerald-700 hover:text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
              >
                <Handshake className="size-4" aria-hidden="true" />
                {pick(l, PARTNER_L.bookPartner)}
              </Button>
              {/* Demo simulator (issue #1): celotna veriga iskanje → izbor →
                  rezervacija → potrditev — IZRECNO označena kot demo. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSearchModal("demo")}
                className="min-h-11 gap-1.5 border-orange-500/50 text-orange-700 hover:text-orange-800 dark:border-orange-700 dark:text-orange-300"
              >
                <FlaskConical className="size-4" aria-hidden="true" />
                {pick(l, DEMO_L.bookDemo)}
              </Button>
            </div>
          )
        ) : null}

        {/* ── Modal: Potrdi rezervacijo (uporabniška atestacija, 51-c) ── */}
        <Dialog
          open={confirmTarget !== null}
          onOpenChange={(open) => {
            if (!open) closeConfirmModal();
          }}
        >
          {/* POLIR11: največja višina 90 dvh + notranje drsenje — atestacija z
              opombo doseže 100 % uporabne višine @320 (0 rezerve) → odrezano
              dno brez drsenja (shadcn-ui/ui #16); dvh po §3 raziskave. */}
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TicketCheck className="size-5 text-primary" aria-hidden="true" />
                {confirmTarget?.kind === "update"
                  ? pick(l, L.modalTitleUpdate)
                  : pick(l, L.modalTitleConfirm)}
              </DialogTitle>
              <DialogDescription>{pick(l, L.modalHonesty)}</DialogDescription>
            </DialogHeader>

            {modalStopName ? (
              <p className="text-xs text-muted-foreground">
                {pick(l, L.forStop)}:{" "}
                <span className="font-medium text-foreground">{modalStopName}</span>
              </p>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="res-confirm-booking-id">
                  {pick(l, L.bookingIdLabel)}{" "}
                  <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="res-confirm-booking-id"
                  value={confirmBookingId}
                  maxLength={200}
                  onChange={(e) => setConfirmBookingId(e.target.value)}
                  placeholder={pick(l, L.bookingIdPlaceholder)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-confirm-price">
                  {pick(l, L.priceLabel)}{" "}
                  <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="res-confirm-price"
                  inputMode="decimal"
                  value={confirmPrice}
                  onChange={(e) => setConfirmPrice(e.target.value)}
                  placeholder={pick(l, L.pricePlaceholder)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-confirm-note">{pick(l, L.noteLabel)}</Label>
                <Input
                  id="res-confirm-note"
                  value={confirmNote}
                  maxLength={500}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="npr. rezervirana miza za 4 ob 19:00, odpoved do 24 h prej"
                />
              </div>
              {modalError ? (
                <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {modalError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={closeConfirmModal} disabled={busy}>
                {pick(l, L.close)}
              </Button>
              <Button
                size="sm"
                onClick={() => void submitConfirmation()}
                disabled={busy}
                className="gap-1.5 whitespace-normal text-left"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CircleCheck className="size-4" aria-hidden="true" />
                )}
                {confirmTarget?.kind === "update"
                  ? pick(l, L.submitUpdate)
                  : pick(l, L.submitConfirm)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Modal: Išči ponudbo — PRI PARTNERJU / DEMO SIMULATOR ──────
            (issue #1: ZGORNJA izbira kanala — strogo ločena kanala).
            Partner = REALNA rezervacija pri partnerju (smaragdno,
            provizijsko razkrito); demo = simulator (oranžno, simulirano). */}
        <Dialog
          open={searchOpen}
          onOpenChange={(open) => {
            if (!open) closeSearchModal();
          }}
        >
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TicketCheck className="size-5 text-primary" aria-hidden="true" />
                {pick(l, PARTNER_L.modalTitle)}
              </DialogTitle>
              <DialogDescription>{pick(l, PARTNER_L.modalDesc)}</DialogDescription>
            </DialogHeader>

            <Tabs
              value={searchTab}
              onValueChange={(v) => setSearchTab(v === "demo" ? "demo" : "partner")}
            >
              <TabsList className="grid h-auto w-full grid-cols-2">
                <TabsTrigger
                  value="partner"
                  className="min-h-11 gap-1.5 px-3 uppercase tracking-wide data-[state=active]:border-emerald-600/50 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800 dark:data-[state=active]:border-emerald-700 dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-300"
                >
                  <Handshake className="size-4" aria-hidden="true" />
                  {pick(l, PARTNER_L.tabPartner)}
                </TabsTrigger>
                <TabsTrigger
                  value="demo"
                  className="min-h-11 gap-1.5 px-3 uppercase tracking-wide data-[state=active]:border-orange-600/50 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-800 dark:data-[state=active]:border-orange-700 dark:data-[state=active]:bg-orange-950/40 dark:data-[state=active]:text-orange-300"
                >
                  <FlaskConical className="size-4" aria-hidden="true" />
                  {pick(l, PARTNER_L.tabDemo)}
                </TabsTrigger>
              </TabsList>

              {/* ── Zavihek PRI PARTNERJU (REALNO — rezervacija se zaključi ──
                  pri partnerju prek vodene povezave, provizijsko razkrito) ── */}
              <TabsContent value="partner" className="mt-3 space-y-3">
                {/* IZRECNO razkritje (vzorec MindTrip): provizija je OCENA
                    (pogodbena) — nikoli obljuba. */}
                <p
                  role="note"
                  className="flex items-start gap-2 rounded-md border border-emerald-600/50 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <Handshake className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {pick(l, PARTNER_L.honesty)}
                </p>

                {partnerDone ? (
                  <div className="space-y-3" role="status">
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
                      <Hourglass
                        className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-amber-800 dark:text-amber-300">
                          {pick(l, PARTNER_L.successTitle)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {partnerDone.providerName}
                          </span>{" "}
                          · {partnerDone.stopName} ·{" "}
                          {pick(l, DEMO_L.peopleWord)(partnerDone.people)} · {partnerDone.date}
                        </p>
                        <p className="text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-300">
                          {pick(l, PARTNER_L.pendingBadge)}
                        </p>
                      </div>
                    </div>
                    {partnerDone.goPath ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-11 gap-1.5 border-emerald-600/50 text-emerald-700 hover:text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                      >
                        <a
                          href={partnerDone.goPath}
                          target="_blank"
                          rel="nofollow sponsored noopener"
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          {pick(l, PARTNER_L.manageAtPartner)}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="pt-day">{pick(l, PARTNER_L.day)}</Label>
                        <Select value={String(ptDayNumber)} onValueChange={setPtDay}>
                          <SelectTrigger id="pt-day" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {days.map((d) => (
                              <SelectItem key={`pt-day-${d.day}`} value={String(d.day)}>
                                Dan {d.day}
                                {d.title ? ` — ${d.title}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pt-stop">{pick(l, PARTNER_L.stop)}</Label>
                        <Select value={ptStop} onValueChange={setPtStop}>
                          <SelectTrigger id="pt-stop" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ptStops.map((s, i) => (
                              <SelectItem key={`pt-stop-${s.name}-${i}`} value={String(i)}>
                                {s.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_STOP}>Drugo (ročni vnos)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {ptStop === CUSTOM_STOP ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="pt-custom-stop">{pick(l, PARTNER_L.customStopLabel)}</Label>
                        <Input
                          id="pt-custom-stop"
                          value={ptCustomStop}
                          maxLength={200}
                          onChange={(e) => setPtCustomStop(e.target.value)}
                          placeholder="npr. Gostilna Pri Lovcu"
                        />
                      </div>
                    ) : null}

                    {/* REALNE ponudbe partnerjev (P0-F: 9 ponudb / 6
                        kategorij na postanek) — vodene povezave
                        /api/affiliate/go (klik se šteje). Seznam ima svoj
                        ozek scroll (pravilo UI: max-h-96 + scrollbar-slim),
                        da obrazec spodaj ostane v dosegu. */}
                    <div className="space-y-1.5">
                      <Label>{pick(l, PARTNER_L.offersLabel)}</Label>
                      {ptOffers.length > 0 ? (
                        <ul className="scrollbar-slim max-h-96 space-y-2 overflow-y-auto pr-1">
                          {ptOffers.map((offer) => {
                            const selected = offer.providerId === ptProvider;
                            return (
                              <li
                                key={offer.providerId}
                                className={`rounded-lg border p-3 transition-colors ${
                                  selected
                                    ? "border-emerald-600/60 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30"
                                    : ""
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setPtProvider(offer.providerId)}
                                  aria-pressed={selected}
                                  className="flex w-full items-start gap-2 text-left"
                                >
                                  {selected ? (
                                    <CircleCheck
                                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <span
                                      className="mt-1 size-4 shrink-0 rounded-full border border-current opacity-40"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <span className="text-sm font-semibold">
                                        {offer.providerName}
                                      </span>
                                      <Badge variant="secondary" className="font-normal">
                                        {pick(l, offer.categoryLabel)}
                                      </Badge>
                                    </span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      {pick(l, PARTNER_L.commission)(offer.commissionPct)}
                                      {offer.category === "flights" && offer.airport ? (
                                        <span className="ml-2 inline-flex items-center gap-1">
                                          <Plane className="size-3" aria-hidden="true" />
                                          {pick(l, PARTNER_L.airportLabel)}:{" "}
                                          {offer.airport.name} ({offer.airport.code})
                                        </span>
                                      ) : null}
                                    </span>
                                    {offer.match === "custom" || !offer.destinationSlug ? (
                                      <span className="mt-0.5 block text-xs italic text-muted-foreground">
                                        {pick(l, PARTNER_L.customSearchNote)}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                                <div className="mt-2">
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="min-h-11 gap-1.5"
                                  >
                                    <a
                                      href={offer.goPath}
                                      target="_blank"
                                      rel="nofollow sponsored noopener"
                                      aria-label={`${pick(l, PARTNER_L.openAtPartner)}: ${offer.providerName}`}
                                      title={`${pick(l, PARTNER_L.openAtPartner)}: ${offer.providerName}`}
                                    >
                                      {pick(l, PARTNER_L.openAtPartner)}
                                      <ExternalLink className="size-3.5" aria-hidden="true" />
                                    </a>
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {pick(l, PARTNER_L.offerEmpty)}
                        </p>
                      )}
                    </div>

                    {/* Obrazec „Sem rezerviral — dodaj na pot" (POST partner
                        → PENDING; številko/ceno prinese uporabnik ŠELE ob
                        potrditvi — PATCH confirm, nikoli ob ustvarjanju). */}
                    <div className="space-y-2.5 rounded-lg border p-3">
                      <p className="text-sm font-semibold">
                        {pick(l, PARTNER_L.bookedFormTitle)}
                      </p>
                      {selectedPtOffer ? (
                        <p className="text-xs text-muted-foreground">
                          {selectedPtOffer.providerName} ·{" "}
                          {pick(l, selectedPtOffer.categoryLabel)}
                          {selectedPtOffer.destinationSlug
                            ? ` · ${selectedPtOffer.destinationName}`
                            : ` · ${pick(l, PARTNER_L.customSearchNote)}`}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {pick(l, PARTNER_L.pickPartnerHint)}
                        </p>
                      )}
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="pt-date" className="flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" aria-hidden="true" />
                            {pick(l, PARTNER_L.dateLabel)} *
                          </Label>
                          <Input
                            id="pt-date"
                            type="date"
                            value={ptDate}
                            onChange={(e) => setPtDate(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pt-people" className="flex items-center gap-1.5">
                            <Users className="size-3.5" aria-hidden="true" />
                            {pick(l, PARTNER_L.peopleLabel)} *
                          </Label>
                          <Input
                            id="pt-people"
                            inputMode="numeric"
                            value={ptPeople}
                            onChange={(e) => setPtPeople(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pt-name">{pick(l, PARTNER_L.nameLabel)}</Label>
                          <Input
                            id="pt-name"
                            value={ptName}
                            maxLength={120}
                            onChange={(e) => setPtName(e.target.value)}
                            placeholder={session?.user?.name ?? ""}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      {partnerError ? (
                        <p
                          className="flex items-start gap-1.5 text-xs text-destructive"
                          role="alert"
                        >
                          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          {partnerError}
                        </p>
                      ) : null}
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {pick(l, PARTNER_L.formNote)}
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Zavihek DEMO SIMULATOR (obstoječa demo funkcionalnost ──
                  NEspremenjena: iskanje → izbor → POST → DSA-DEMO-XXXX →
                  Spremeni/Odpovej; izrecno oranžno). ── */}
              <TabsContent value="demo" className="mt-3 space-y-3">
                {/* IZRECNA pasica — oranžna jakost, NIKOLI zelena */}
                <p
                  role="note"
                  className="flex items-start gap-2 rounded-md border border-orange-500/50 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                >
                  <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {pick(l, DEMO_L.honesty)}
                </p>
                <p className="text-xs text-muted-foreground">{pick(l, DEMO_L.modalDesc)}</p>

                {demoDone ? (
                  <div className="space-y-3" role="status">
                    <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-50/60 p-3 dark:border-orange-700/60 dark:bg-orange-950/30">
                      <CircleCheck
                        className="mt-0.5 size-5 shrink-0 text-orange-600 dark:text-orange-400"
                        aria-hidden="true"
                      />
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold">{pick(l, DEMO_L.successTitle)}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {demoDone.stopName}
                          </span>{" "}
                          · {formatPriceEUR(demoDone.price, lang)} ·{" "}
                          {pick(l, DEMO_L.peopleWord)(demoDone.people)} · {demoDone.date}
                        </p>
                        <p className="font-mono text-xs">{demoDone.providerBookingId}</p>
                        <p className="text-xs text-muted-foreground">
                          {pick(l, DEMO_L.successBody)(demoDone.providerBookingId)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {pick(l, DEMO_L.realNote)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-day">{pick(l, DEMO_L.day)}</Label>
                        <Select value={String(demoDayNumber)} onValueChange={setDemoDay}>
                          <SelectTrigger id="demo-day" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {days.map((d) => (
                              <SelectItem key={d.day} value={String(d.day)}>
                                Dan {d.day}
                                {d.title ? ` — ${d.title}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-stop">{pick(l, DEMO_L.stop)}</Label>
                        <Select value={demoStop} onValueChange={setDemoStop}>
                          <SelectTrigger id="demo-stop" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {demoStops.map((s, i) => (
                              <SelectItem key={`demo-${s.name}-${i}`} value={String(i)}>
                                {s.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_STOP}>
                              Drugo (ročni vnos)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {demoStop === CUSTOM_STOP ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-custom-stop">{pick(l, DEMO_L.customStopLabel)}</Label>
                        <Input
                          id="demo-custom-stop"
                          value={demoCustomStop}
                          maxLength={200}
                          onChange={(e) => setDemoCustomStop(e.target.value)}
                          placeholder="npr. Gostilna Pri Lovcu"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor="demo-offer">{pick(l, DEMO_L.offerLabel)}</Label>
                      {demoOffers.length > 0 ? (
                        <Select value={demoOfferId} onValueChange={setDemoOfferId}>
                          <SelectTrigger id="demo-offer" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {demoOffers.map((o) => (
                              <SelectItem key={o.offerId} value={o.offerId}>
                                {pick(l, o.title)} ({o.destinationName}) —{" "}
                                {formatPriceEUR(o.pricePerPerson, lang)}
                                {pick(l, DEMO_L.perPerson)} ·{" "}
                                {o.match === "exact"
                                  ? pick(l, DEMO_L.matchExact)
                                  : o.match === "region"
                                    ? pick(l, DEMO_L.matchRegion)
                                    : pick(l, DEMO_L.matchSuggested)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {pick(l, DEMO_L.offerEmpty)}
                        </p>
                      )}
                      {selectedDemoOffer ? (
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {pick(l, selectedDemoOffer.title)} ·{" "}
                          {formatPriceEUR(selectedDemoOffer.pricePerPerson, lang)}
                          {pick(l, DEMO_L.perPerson)} →{" "}
                          <span className="font-medium text-foreground">
                            {formatPriceEUR(selectedDemoOffer.totalPrice, lang)}
                          </span>{" "}
                          ({pick(l, DEMO_L.peopleWord)(demoPeopleNum)})
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-date" className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                          {pick(l, DEMO_L.dateLabel)} *
                        </Label>
                        <Input
                          id="demo-date"
                          type="date"
                          value={demoDate}
                          onChange={(e) => setDemoDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-people" className="flex items-center gap-1.5">
                          <Users className="size-3.5" aria-hidden="true" />
                          {pick(l, DEMO_L.peopleLabel)} *
                        </Label>
                        <Input
                          id="demo-people"
                          inputMode="numeric"
                          value={demoPeople}
                          onChange={(e) => setDemoPeople(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="demo-name">{pick(l, DEMO_L.nameLabel)}</Label>
                        <Input
                          id="demo-name"
                          value={demoName}
                          maxLength={120}
                          onChange={(e) => setDemoName(e.target.value)}
                          placeholder={session?.user?.name ?? ""}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    {demoError ? (
                      <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {demoError}
                      </p>
                    ) : null}
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {pick(l, DEMO_L.realNote)}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={closeSearchModal} disabled={busy}>
                {pick(l, L.close)}
              </Button>
              {searchTab === "partner" && !partnerDone ? (
                <Button
                  size="sm"
                  onClick={() => void submitPartnerBooking()}
                  disabled={busy || !selectedPtOffer}
                  className="gap-1.5 border-emerald-600/50 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-700 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-600"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Handshake className="size-4" aria-hidden="true" />
                  )}
                  {pick(l, PARTNER_L.submit)}
                </Button>
              ) : null}
              {searchTab === "demo" && !demoDone ? (
                <Button
                  size="sm"
                  onClick={() => void submitDemoBooking()}
                  disabled={busy || demoOffers.length === 0}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FlaskConical className="size-4" aria-hidden="true" />
                  )}
                  {pick(l, DEMO_L.submit)}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Modal: Spremeni demo rezervacijo (PATCH modify) ─────────── */}
        <Dialog
          open={demoEdit !== null}
          onOpenChange={(open) => {
            if (!open) setDemoEdit(null);
          }}
        >
          {/* POLIR11: največja višina 90 dvh + notranje drsenje — enaka
              straža kot potrditveni modal (shadcn-ui/ui #16). */}
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical
                  className="size-5 text-orange-600 dark:text-orange-400"
                  aria-hidden="true"
                />
                {pick(l, DEMO_L.editTitle)}
              </DialogTitle>
              <DialogDescription>{pick(l, DEMO_L.editDesc)}</DialogDescription>
            </DialogHeader>

            <p
              role="note"
              className="flex items-start gap-2 rounded-md border border-orange-500/50 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
            >
              <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {pick(l, DEMO_L.honesty)}
            </p>

            {demoEdit ? (
              <p className="text-xs text-muted-foreground">
                {demoEdit.stopName} ·{" "}
                <span className="font-mono">
                  {parseDemoNote(demoEdit.note)?.providerBookingId ?? ""}
                </span>
              </p>
            ) : null}

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="demo-edit-date" className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {pick(l, DEMO_L.dateLabel)} *
                </Label>
                <Input
                  id="demo-edit-date"
                  type="date"
                  value={demoEditDate}
                  onChange={(e) => setDemoEditDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-edit-people" className="flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden="true" />
                  {pick(l, DEMO_L.peopleLabel)} *
                </Label>
                <Input
                  id="demo-edit-people"
                  inputMode="numeric"
                  value={demoEditPeople}
                  onChange={(e) => setDemoEditPeople(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-edit-name">{pick(l, DEMO_L.nameLabel)}</Label>
                <Input
                  id="demo-edit-name"
                  value={demoEditName}
                  maxLength={120}
                  onChange={(e) => setDemoEditName(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            {demoEditError ? (
              <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {demoEditError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDemoEdit(null)}
                disabled={busy}
              >
                {pick(l, L.close)}
              </Button>
              <Button
                size="sm"
                onClick={() => void submitDemoModify()}
                disabled={busy}
                className="gap-1.5 whitespace-normal text-left"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FlaskConical className="size-4" aria-hidden="true" />
                )}
                {pick(l, DEMO_L.editSubmit)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Modal: Vnesi potrdilo partnerja (PENDING → CONFIRMED, ──────
            uporabniška atestacija s številko + ceno iz partnerjevega
            potrdila — enak kanon kot 51-c, nikoli ponarejeno). */}
        <Dialog
          open={partnerConfirm !== null}
          onOpenChange={(open) => {
            if (!open) setPartnerConfirm(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Handshake
                  className="size-5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {pick(l, PARTNER_L.confirmTitle)}
              </DialogTitle>
              <DialogDescription>{pick(l, PARTNER_L.confirmDesc)}</DialogDescription>
            </DialogHeader>

            {partnerConfirm ? (
              <p className="text-xs text-muted-foreground">
                {partnerConfirm.stopName}
                {parsePartnerNote(partnerConfirm.note) ? (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground">
                      {parsePartnerNote(partnerConfirm.note)?.providerName}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pt-confirm-booking-id">
                  {pick(l, PARTNER_L.bookingIdLabel)}{" "}
                  <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="pt-confirm-booking-id"
                  value={partnerConfirmId}
                  maxLength={200}
                  onChange={(e) => setPartnerConfirmId(e.target.value)}
                  placeholder={pick(l, PARTNER_L.bookingIdPlaceholder)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-confirm-price">
                  {pick(l, PARTNER_L.priceLabel)}{" "}
                  <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <Input
                  id="pt-confirm-price"
                  inputMode="decimal"
                  value={partnerConfirmPrice}
                  onChange={(e) => setPartnerConfirmPrice(e.target.value)}
                  placeholder={pick(l, PARTNER_L.pricePlaceholder)}
                  autoComplete="off"
                />
              </div>
              {partnerConfirmError ? (
                <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {partnerConfirmError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPartnerConfirm(null)}
                disabled={busy}
              >
                {pick(l, L.close)}
              </Button>
              <Button
                size="sm"
                onClick={() => void submitPartnerConfirm()}
                disabled={busy}
                className="gap-1.5 border-emerald-600/50 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-700 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-600"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CircleCheck className="size-4" aria-hidden="true" />
                )}
                {pick(l, PARTNER_L.submitConfirm)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Modal: Spremeni partner rezervacijo (PATCH modify — ────────
            indikativno; DEJANSKA sprememba teče pri partnerju). */}
        <Dialog
          open={partnerEdit !== null}
          onOpenChange={(open) => {
            if (!open) setPartnerEdit(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Handshake
                  className="size-5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {pick(l, PARTNER_L.editTitle)}
              </DialogTitle>
              <DialogDescription>{pick(l, PARTNER_L.editDesc)}</DialogDescription>
            </DialogHeader>

            {partnerEdit ? (
              <p className="text-xs text-muted-foreground">
                {partnerEdit.stopName}
                {parsePartnerNote(partnerEdit.note) ? (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground">
                      {parsePartnerNote(partnerEdit.note)?.providerName}
                    </span>
                    {parsePartnerNote(partnerEdit.note)?.providerBookingId ? (
                      <>
                        {" · "}
                        <span className="font-mono">
                          {parsePartnerNote(partnerEdit.note)?.providerBookingId}
                        </span>
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>
            ) : null}

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pt-edit-date" className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {pick(l, PARTNER_L.dateLabel)} *
                </Label>
                <Input
                  id="pt-edit-date"
                  type="date"
                  value={partnerEditDate}
                  onChange={(e) => setPartnerEditDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-edit-people" className="flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden="true" />
                  {pick(l, PARTNER_L.peopleLabel)} *
                </Label>
                <Input
                  id="pt-edit-people"
                  inputMode="numeric"
                  value={partnerEditPeople}
                  onChange={(e) => setPartnerEditPeople(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-edit-name">{pick(l, PARTNER_L.nameLabel)}</Label>
                <Input
                  id="pt-edit-name"
                  value={partnerEditName}
                  maxLength={120}
                  onChange={(e) => setPartnerEditName(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            {partnerEditError ? (
              <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {partnerEditError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPartnerEdit(null)}
                disabled={busy}
              >
                {pick(l, L.close)}
              </Button>
              <Button
                size="sm"
                onClick={() => void submitPartnerModify()}
                disabled={busy}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <PenLine className="size-4" aria-hidden="true" />
                )}
                {pick(l, PARTNER_L.editSubmit)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
