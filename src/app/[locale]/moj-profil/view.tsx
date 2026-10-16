"use client";

import {
  Brain,
  Check,
  Clock,
  Heart,
  Info,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { intlDateLocale } from "@/lib/intl-locale";

/**
 * /moj-profil — P1-A (issue #3 §1/§2): OSEBNI POTOVALNI PROFIL.
 *  - preference z izvorom (USER_STATED) — vidi/ureja/briše vsak zapis;
 *  - dolgoročni spomin „Kaj si zapomnim o tebi" — dodaj/uredi/briši/
 *    pozabi-vse;
 *  - preklop personalizacije (off = fail-closed: agent spomina ne bere,
 *    novih zapisov ne zbiramo);
 *  - iskrena zasebnostna izjava: kaj je shranjeno, kje, kako dolgo.
 *
 * 0-AI: stran upravlja SAMO s svojimi podatki prek /api/preferences in
 * /api/memory; nič se ne izpeljuje brez uporabnikovega dejanja.
 */

const L = {
  kicker: { sl: "Osebni profil", en: "Personal profile", it: "Profilo personale", de: "Persönliches Profil", fr: "Profil personnel", es: "Perfil personal" },
  title: { sl: "Moj profil", en: "My profile", it: "Il mio profilo", de: "Mein Profil", fr: "Mon profil", es: "Mi perfil" },
  lead: {
    sl: "Potovalne preference in spomin, ki jih upravljaš sam. Uporabljajo se samo zate — nikoli v skupinskih klepetih.",
    en: "Travel preferences and memory you control. Used only for you — never in group chats.",
    it: "Preferenze di viaggio e memoria che controlli tu. Usate solo per te — mai nelle chat di gruppo.",
    de: "Reisepräferenzen und Erinnerungen, die du steuerst. Nur für dich verwendet — nie in Gruppenchats.",
    fr: "Préférences de voyage et mémoire que tu contrôles. Utilisées uniquement pour toi — jamais dans les discussions de groupe.",
    es: "Preferencias de viaje y memoria que controlas tú. Se usan solo para ti — nunca en chats de grupo.",
  },
  signInNeeded: { sl: "Za profil se prijavi", en: "Sign in to use your profile", it: "Accedi per usare il tuo profilo", de: "Melde dich an, um dein Profil zu nutzen", fr: "Connecte-toi pour utiliser ton profil", es: "Inicia sesión para usar tu perfil" },
  signInLead: {
    sl: "Profil je vezan na tvoj račun: preference in spomin se shranijo v oblak in sledijo ti (ne napravi).",
    en: "Your profile belongs to your account: preferences and memory are stored in the cloud and follow you (not the device).",
    it: "Il tuo profilo appartiene al tuo account: preferenze e memoria sono salvate nel cloud e ti seguono (non al dispositivo).",
    de: "Dein Profil gehört zu deinem Konto: Präferenzen und Erinnerungen werden in der Cloud gespeichert und folgen dir (nicht dem Gerät).",
    fr: "Ton profil appartient à ton compte : préférences et mémoire sont stockées dans le cloud et te suivent (pas l’appareil).",
    es: "Tu perfil pertenece a tu cuenta: las preferencias y la memoria se guardan en la nube y te siguen (no al dispositivo).",
  },
  signInCta: { sl: "Pojdi na prijavo", en: "Go to sign in", it: "Vai all’accesso", de: "Zur Anmeldung", fr: "Aller à la connexion", es: "Ir al inicio de sesión" },
  loadError: { sl: "Nalaganje profila ni uspelo.", en: "Failed to load profile.", it: "Caricamento del profilo non riuscito.", de: "Profil konnte nicht geladen werden.", fr: "Échec du chargement du profil.", es: "No se pudo cargar el perfil." },
  retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
  saved: { sl: "Shranjeno", en: "Saved", it: "Salvato", de: "Gespeichert", fr: "Enregistré", es: "Guardado" },
  personalizationTitle: { sl: "Personalizacija", en: "Personalization", it: "Personalizzazione", de: "Personalisierung", fr: "Personnalisation", es: "Personalización" },
  personalizationOn: { sl: "VKLOPLJENA", en: "ENABLED", it: "ATTIVA", de: "AKTIVIERT", fr: "ACTIVÉE", es: "ACTIVADA" },
  personalizationOff: { sl: "IZKLOPLJENA", en: "DISABLED", it: "DISATTIVA", de: "DEAKTIVIERT", fr: "DÉSACTIVÉE", es: "DESACTIVADA" },
  personalizationDesc: {
    sl: "Ko je vklopljena, @AI svetovalec uporablja tvoje preference in spomin pri predlogih. Izklop pomeni: spomin se ne bere in novi zapisi se ne zbirajo (obstoječe še vedno vidiš in lahko izbrišeš).",
    en: "When enabled, the @AI advisor uses your preferences and memory in suggestions. Disabled means: memory is not read and new entries are not collected (existing ones remain visible and deletable).",
    it: "Quando attiva, il consulente @AI usa le tue preferenze e la memoria nei suggerimenti. Disattivata significa: la memoria non viene letta e nuove voci non vengono raccolte (quelle esistenti restano visibili ed eliminabili).",
    de: "Wenn aktiviert, nutzt der @AI-Berater deine Präferenzen und Erinnerungen in Vorschlägen. Deaktiviert bedeutet: die Erinnerung wird nicht gelesen und neue Einträge werden nicht gesammelt (bestehende bleiben sichtbar und löschbar).",
    fr: "Quand elle est activée, le conseiller @AI utilise tes préférences et ta mémoire dans ses suggestions. Désactivée signifie : la mémoire n’est pas lue et aucune nouvelle entrée n’est collectée (les existantes restent visibles et supprimables).",
    es: "Cuando está activada, el asesor @IA usa tus preferencias y la memoria en las sugerencias. Desactivada significa: la memoria no se lee y no se recogen entradas nuevas (las existentes siguen visibles y se pueden borrar).",
  },
  preferencesTitle: { sl: "Potovalne preference", en: "Travel preferences", it: "Preferenze di viaggio", de: "Reisepräferenzen", fr: "Préférences de voyage", es: "Preferencias de viaje" },
  preferencesDesc: {
    sl: "Izbrano stanje — brez izpeljav. Vsako polje lahko tudi počistiš.",
    en: "Explicit choices — no inference. Every field can also be cleared.",
    it: "Scelte esplicite — nessuna deduzione. Ogni campo può anche essere azzerato.",
    de: "Explizite Auswahl — keine Ableitung. Jedes Feld lässt sich auch leeren.",
    fr: "Choix explicites — pas de déduction. Chaque champ peut aussi être effacé.",
    es: "Elecciones explícitas — sin inferencias. Cada campo también se puede vaciar.",
  },
  budget: { sl: "Proračun", en: "Budget", it: "Budget", de: "Budget", fr: "Budget", es: "Presupuesto" },
  budgetLow: { sl: "Nizki (€)", en: "Low (€)", it: "Basso (€)", de: "Niedrig (€)", fr: "Bas (€)", es: "Bajo (€)" },
  budgetMid: { sl: "Srednji (€€)", en: "Medium (€€)", it: "Medio (€€)", de: "Mittel (€€)", fr: "Moyen (€€)", es: "Medio (€€)" },
  budgetHigh: { sl: "Višji (€€€)", en: "Higher (€€€)", it: "Alto (€€€)", de: "Höher (€€€)", fr: "Élevé (€€€)", es: "Alto (€€€)" },
  season: { sl: "Letni čas", en: "Season", it: "Stagione", de: "Jahreszeit", fr: "Saison", es: "Temporada" },
  seasonAny: { sl: "Vseeno", en: "Any", it: "Qualsiasi", de: "Beliebig", fr: "Indifférent", es: "Cualquiera" },
  seasonSpring: { sl: "Pomlad", en: "Spring", it: "Primavera", de: "Frühling", fr: "Printemps", es: "Primavera" },
  seasonSummer: { sl: "Poletje", en: "Summer", it: "Estate", de: "Sommer", fr: "Été", es: "Verano" },
  seasonAutumn: { sl: "Jesen", en: "Autumn", it: "Autunno", de: "Herbst", fr: "Automne", es: "Otoño" },
  seasonWinter: { sl: "Zima", en: "Winter", it: "Inverno", de: "Winter", fr: "Hiver", es: "Invierno" },
  pace: { sl: "Tempo", en: "Pace", it: "Ritmo", de: "Tempo", fr: "Rythme", es: "Ritmo" },
  paceRelaxed: { sl: "Sproščen", en: "Relaxed", it: "Rilassato", de: "Entspannt", fr: "Détendu", es: "Relajado" },
  paceBalanced: { sl: "Uravnotežen", en: "Balanced", it: "Equilibrato", de: "Ausgeglichen", fr: "Équilibré", es: "Equilibrado" },
  paceIntense: { sl: "Intenziven", en: "Intense", it: "Intenso", de: "Intensiv", fr: "Intense", es: "Intenso" },
  party: { sl: "Družba", en: "Party", it: "Compagnia", de: "Reisende", fr: "Compagnie", es: "Compañía" },
  partySolo: { sl: "Sam(a)", en: "Solo", it: "Da solo", de: "Allein", fr: "Solo", es: "Solo" },
  partyCouple: { sl: "Par", en: "Couple", it: "Coppia", de: "Paar", fr: "Couple", es: "Pareja" },
  partyFamily: { sl: "Družina", en: "Family", it: "Famiglia", de: "Familie", fr: "Famille", es: "Familia" },
  partyFriends: { sl: "Prijatelji", en: "Friends", it: "Amici", de: "Freunde", fr: "Amis", es: "Amigos" },
  partyGroup: { sl: "Skupina", en: "Group", it: "Gruppo", de: "Gruppe", fr: "Groupe", es: "Grupo" },
  transport: { sl: "Prevoz", en: "Transport", it: "Trasporto", de: "Transport", fr: "Transport", es: "Transporte" },
  transportCar: { sl: "Avto", en: "Car", it: "Auto", de: "Auto", fr: "Voiture", es: "Coche" },
  transportBus: { sl: "Avtobus", en: "Bus", it: "Autobus", de: "Bus", fr: "Bus", es: "Autobús" },
  transportBike: { sl: "Kolo", en: "Bike", it: "Bici", de: "Fahrrad", fr: "Vélo", es: "Bicicleta" },
  transportHiking: { sl: "Peš", en: "Hiking", it: "A piedi", de: "Zu Fuß", fr: "À pied", es: "A pie" },
  transportMixed: { sl: "Mešano", en: "Mixed", it: "Misto", de: "Gemischt", fr: "Mixte", es: "Mixto" },
  interests: { sl: "Interesi", en: "Interests", it: "Interessi", de: "Interessen", fr: "Centres d’intérêt", es: "Intereses" },
  interestsDesc: {
    sl: "Besede, ki jih razume tudi načrtovalnik (npr. morje, gore, jame, mesto, kultura, hrana, vino).",
    en: "Words the planner also understands (e.g. sea, mountains, caves, city, culture, food, wine).",
    it: "Parole che anche il pianificatore capisce (es. mare, montagne, grotte, città, cultura, cibo, vino).",
    de: "Wörter, die der Planer ebenfalls versteht (z. B. Meer, Berge, Höhlen, Stadt, Kultur, Essen, Wein).",
    fr: "Mots que le planificateur comprend aussi (ex. mer, montagnes, grottes, ville, culture, cuisine, vin).",
    es: "Palabras que el planificador también entiende (p. ej. mar, montañas, cuevas, ciudad, cultura, comida, vino).",
  },
  food: { sl: "Hrana in omejitve", en: "Food and constraints", it: "Cibo e restrizioni", de: "Essen und Einschränkungen", fr: "Cuisine et contraintes", es: "Comida y restricciones" },
  foodPh: {
    sl: "npr. brez laktoze, raje lokalne gostilne",
    en: "e.g. lactose-free, prefer local inns",
    it: "es. senza lattosio, preferisco le osterie locali",
    de: "z. B. laktosefrei, lieber lokale Gasthäuser",
    fr: "ex. sans lactose, plutôt des auberges locales",
    es: "p. ej. sin lactosa, prefiero posadas locales",
  },
  avoid: { sl: "Ne predlagaj", en: "Do not suggest", it: "Non suggerire", de: "Nicht vorschlagen", fr: "Ne pas suggérer", es: "No sugerir" },
  avoidDesc: {
    sl: "Besede ali kraji, ki jih @AI in načrtovalnik preskočita.",
    en: "Words or places the @AI advisor and planner will skip.",
    it: "Parole o luoghi che il consulente @AI e il pianificatore salteranno.",
    de: "Wörter oder Orte, die der @AI-Berater und der Planer überspringen.",
    fr: "Mots ou lieux que le conseiller @AI et le planificateur ignoreront.",
    es: "Palabras o lugares que el asesor @IA y el planificador omitirán.",
  },
  addWord: { sl: "Dodaj besedo", en: "Add word", it: "Aggiungi parola", de: "Wort hinzufügen", fr: "Ajouter un mot", es: "Añadir palabra" },
  clear: { sl: "Počisti", en: "Clear", it: "Azzera", de: "Leeren", fr: "Effacer", es: "Vaciar" },
  cleared: { sl: "Počiščeno", en: "Cleared", it: "Azzerato", de: "Gelehrt", fr: "Effacé", es: "Vaciado" },
  // spomin
  memoryTitle: { sl: "Kaj si zapomnim o tebi", en: "What I remember about you", it: "Cosa ricordo di te", de: "Was ich über dich merke", fr: "Ce que je retiens de toi", es: "Lo que recuerdo de ti" },
  memoryDesc: {
    sl: "Izrecni zapisi, ki jih DODAŠ sam — nič se ne zbere samo od sebe. Uporabljajo se samo zate.",
    en: "Explicit entries YOU add — nothing is collected on its own. Used only for you.",
    it: "Voci esplicite che aggiungi TU — nulla viene raccolto da sé. Usate solo per te.",
    de: "Explizite Einträge, die DU hinzufügst — nichts wird von selbst gesammelt. Nur für dich verwendet.",
    fr: "Des entrées explicites que TU ajoutes — rien n’est collecté tout seul. Utilisées uniquement pour toi.",
    es: "Entradas explícitas que añades TÚ — nada se recoge por sí solo. Se usan solo para ti.",
  },
  memoryEmpty: {
    sl: "Spomin je prazen — dodaj prvi zapis spodaj.",
    en: "Memory is empty — add the first entry below.",
    it: "La memoria è vuota — aggiungi la prima voce qui sotto.",
    de: "Die Erinnerung ist leer — füge unten den ersten Eintrag hinzu.",
    fr: "La mémoire est vide — ajoute la première entrée ci-dessous.",
    es: "La memoria está vacía — añade la primera entrada abajo.",
  },
  memoryOffNote: {
    sl: "Personalizacija je izklopljena: ti zapisi se ne uporabljajo pri načrtovanju, vidiš pa jih zato, da jih lahko urediš ali izbrišeš.",
    en: "Personalization is disabled: these entries are not used in planning; you see them so you can edit or delete them.",
    it: "La personalizzazione è disattivata: queste voci non vengono usate nella pianificazione; le vedi per poterle modificare o eliminare.",
    de: "Die Personalisierung ist deaktiviert: diese Einträge fließen nicht in die Planung ein; du siehst sie, damit du sie bearbeiten oder löschen kannst.",
    fr: "La personnalisation est désactivée : ces entrées ne servent pas à la planification ; tu les vois pour pouvoir les modifier ou les supprimer.",
    es: "La personalización está desactivada: estas entradas no se usan en la planificación; las ves para poder editarlas o borrarlas.",
  },
  memoryKindFact: { sl: "Dejstvo", en: "Fact", it: "Fatto", de: "Fakt", fr: "Fait", es: "Hecho" },
  memoryKindPreference: { sl: "Prednost", en: "Preference", it: "Preferenza", de: "Präferenz", fr: "Préférence", es: "Preferencia" },
  memoryKindConstraint: { sl: "Omejitev", en: "Constraint", it: "Vincolo", de: "Einschränkung", fr: "Contrainte", es: "Restricción" },
  memoryKindVisit: { sl: "Obisk", en: "Visit", it: "Visita", de: "Besuch", fr: "Visite", es: "Visita" },
  memoryKindFeedback: { sl: "Odziv", en: "Feedback", it: "Feedback", de: "Feedback", fr: "Retour", es: "Comentario" },
  memorySourceUser: { sl: "Ti", en: "You", it: "Tu", de: "Du", fr: "Toi", es: "Tú" },
  memorySourceDerived: { sl: "Izpeljano", en: "Derived", it: "Derivato", de: "Abgeleitet", fr: "Dérivé", es: "Derivado" },
  memorySourceHistory: { sl: "Iz zgodovine poti", en: "From trip history", it: "Dallo storico dei viaggi", de: "Aus dem Reiseverlauf", fr: "De l’historique des voyages", es: "Del historial de viajes" },
  memorySourceImported: { sl: "Uvoženo", en: "Imported", it: "Importato", de: "Importiert", fr: "Importé", es: "Importado" },
  memoryAdd: { sl: "Dodaj zapis", en: "Add entry", it: "Aggiungi voce", de: "Eintrag hinzufügen", fr: "Ajouter une entrée", es: "Añadir entrada" },
  memoryValuePh: {
    sl: "npr. Najraje imam kraje z lepimi razgledi, ne maram dolgih voženj.",
    en: "e.g. I prefer places with nice views; I dislike long drives.",
    it: "es. Preferisco i luoghi con bei panorami; non mi piacciono i lunghi trasferimenti in auto.",
    de: "z. B. Ich mag Orte mit schöner Aussicht; lange Fahrten mag ich nicht.",
    fr: "ex. Je préfère les lieux avec de belles vues ; je n’aime pas les longs trajets.",
    es: "p. ej. Prefiero lugares con buenas vistas; no me gustan los trayectos largos.",
  },
  edit: { sl: "Uredi", en: "Edit", it: "Modifica", de: "Bearbeiten", fr: "Modifier", es: "Editar" },
  cancel: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Annuler", es: "Cancelar" },
  save: { sl: "Shrani", en: "Save", it: "Salva", de: "Speichern", fr: "Enregistrer", es: "Guardar" },
  delete: { sl: "Izbriši", en: "Delete", it: "Elimina", de: "Löschen", fr: "Supprimer", es: "Borrar" },
  forgetAll: { sl: "Pozabi vse", en: "Forget all", it: "Dimentica tutto", de: "Alles vergessen", fr: "Tout oublier", es: "Olvidar todo" },
  forgetAllTitle: {
    sl: "Pozabim vse zapise spomina?",
    en: "Forget all memory entries?",
    it: "Dimenticare tutte le voci della memoria?",
    de: "Alle Erinnerungseinträge vergessen?",
    fr: "Oublier toutes les entrées de la mémoire ?",
    es: "¿Olvidar todas las entradas de la memoria?",
  },
  forgetAllDesc: {
    sl: "Vsi zapisi se arhivirajo (ne uporabijo se več) in se po 90 dneh fizično pobrišejo. Dejanja ni mogoče razveljaviti.",
    en: "All entries are archived (no longer used) and physically deleted after 90 days. This cannot be undone.",
    it: "Tutte le voci vengono archiviate (non più usate) e fisicamente eliminate dopo 90 giorni. L’azione non è reversibile.",
    de: "Alle Einträge werden archiviert (nicht mehr verwendet) und nach 90 Tagen physisch gelöscht. Das kann nicht rückgängig gemacht werden.",
    fr: "Toutes les entrées sont archivées (plus utilisées) et physiquement supprimées après 90 jours. Cela ne peut pas être annulé.",
    es: "Todas las entradas se archivan (ya no se usan) y se borran físicamente después de 90 días. Esto no se puede deshacer.",
  },
  forgetAllConfirm: { sl: "Da, pozabi vse", en: "Yes, forget all", it: "Sì, dimentica tutto", de: "Ja, alles vergessen", fr: "Oui, tout oublier", es: "Sí, olvidar todo" },
  privacyTitle: { sl: "Zasebnost in izvor podatkov", en: "Privacy and data provenance", it: "Privacy e provenienza dei dati", de: "Datenschutz und Datenherkunft", fr: "Confidentialité et provenance des données", es: "Privacidad y procedencia de los datos" },
  privacy1: {
    sl: "Vsak zapis nosi izvor: „Tvoja nastavitev“ pomeni, da si ga TI vpisal; izpeljani/iz zgodovine nastanejo le s tvojo potrditvijo.",
    en: "Every entry carries provenance: “Your setting” means YOU entered it; derived/history entries only appear with your confirmation.",
    it: "Ogni voce indica la provenienza: «La tua impostazione» significa che l’hai inserita TU; le voci derivate o dallo storico compaiono solo con la tua conferma.",
    de: "Jeder Eintrag trägt eine Herkunft: „Deine Einstellung“ bedeutet, dass DU ihn eingegeben hast; abgeleitete Einträge oder aus dem Verlauf erscheinen nur mit deiner Bestätigung.",
    fr: "Chaque entrée indique sa provenance : « Ton réglage » signifie que TU l’as saisie ; les entrées dérivées ou issues de l’historique n’apparaissent qu’avec ta confirmation.",
    es: "Cada entrada indica su procedencia: «Tu ajuste» significa que TÚ la escribiste; las entradas derivadas o del historial solo aparecen con tu confirmación.",
  },
  privacy2: {
    sl: "Podatki so vezani na tvoj račun. Skupinski klepet in sodelavci na poti NIKOLI ne vidijo tvojih preferenc ali spomina.",
    en: "Data belongs to your account. Group chat and trip collaborators NEVER see your preferences or memory.",
    it: "I dati appartengono al tuo account. La chat di gruppo e i collaboratori del viaggio NON vedono MAI le tue preferenze o la memoria.",
    de: "Daten gehören zu deinem Konto. Gruppenchat und Reise-Mitarbeiter sehen deine Präferenzen oder Erinnerungen NIE.",
    fr: "Les données appartiennent à ton compte. La discussion de groupe et les collaborateurs du voyage ne voient JAMAIS tes préférences ni ta mémoire.",
    es: "Los datos pertenecen a tu cuenta. El chat de grupo y los colaboradores del viaje NUNCA ven tus preferencias ni tu memoria.",
  },
  privacy3: {
    sl: "Izbris: en zapis takoj arhiviram (90 dni), „Pozabi vse“ arhivira vse. Brez sledenja tretjih oseb — 0 AI žetonov.",
    en: "Deletion: a single entry is archived immediately (90 days); “Forget all” archives everything. No third-party tracking — 0 AI tokens.",
    it: "Eliminazione: una singola voce viene archiviata subito (90 giorni); «Dimentica tutto» archivia tutto. Nessun tracciamento di terze parti — 0 token IA.",
    de: "Löschen: ein einzelner Eintrag wird sofort archiviert (90 Tage); „Alles vergessen“ archiviert alles. Kein Tracking durch Dritte — 0 KI-Tokens.",
    fr: "Suppression : une entrée isolée est archivée immédiatement (90 jours) ; « Tout oublier » archive tout. Aucun pistage tiers — 0 jeton d’IA.",
    es: "Borrado: una entrada individual se archiva de inmediato (90 días); «Olvidar todo» archiva todo. Sin rastreo de terceros — 0 fichas de IA.",
  },
} as const;

type Dict = typeof L;
type tFn = <K extends keyof Dict>(key: K) => (typeof L[K])["sl"];

const INTEREST_SUGGESTIONS = [
  "morje",
  "gore",
  "jame",
  "mesto",
  "kultura",
  "hrana",
  "vino",
  "družina",
  "adrenalin",
  "toplice",
] as const;

const SINGLE_GROUPS = [
  {
    key: "budget",
    titleKey: "budget" as const,
    options: [
      { value: "€", labelKey: "budgetLow" as const },
      { value: "€€", labelKey: "budgetMid" as const },
      { value: "€€€", labelKey: "budgetHigh" as const },
    ],
  },
  {
    key: "season",
    titleKey: "season" as const,
    options: [
      { value: "any", labelKey: "seasonAny" as const },
      { value: "spring", labelKey: "seasonSpring" as const },
      { value: "summer", labelKey: "seasonSummer" as const },
      { value: "autumn", labelKey: "seasonAutumn" as const },
      { value: "winter", labelKey: "seasonWinter" as const },
    ],
  },
  {
    key: "pace",
    titleKey: "pace" as const,
    options: [
      { value: "relaxed", labelKey: "paceRelaxed" as const },
      { value: "balanced", labelKey: "paceBalanced" as const },
      { value: "intense", labelKey: "paceIntense" as const },
    ],
  },
  {
    key: "party",
    titleKey: "party" as const,
    options: [
      { value: "solo", labelKey: "partySolo" as const },
      { value: "couple", labelKey: "partyCouple" as const },
      { value: "family", labelKey: "partyFamily" as const },
      { value: "friends", labelKey: "partyFriends" as const },
      { value: "group", labelKey: "partyGroup" as const },
    ],
  },
  {
    key: "transport",
    titleKey: "transport" as const,
    options: [
      { value: "car", labelKey: "transportCar" as const },
      { value: "bus", labelKey: "transportBus" as const },
      { value: "bike", labelKey: "transportBike" as const },
      { value: "hiking", labelKey: "transportHiking" as const },
      { value: "mixed", labelKey: "transportMixed" as const },
    ],
  },
] as const;

interface PrefDto {
  key: string;
  value: string;
  source: string;
  updatedAt: string;
}

interface MemoryDto {
  id: string;
  kind: string;
  value: string;
  source: string;
  confidence: number;
  updatedAt: string;
}

function prefValue(raw: string | undefined): string | string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) return parsed.filter((w) => typeof w === "string");
    return null;
  } catch {
    return null;
  }
}

function kindLabel(kind: string, t: tFn): string {
  switch (kind) {
    case "fact":
      return t("memoryKindFact");
    case "preference":
      return t("memoryKindPreference");
    case "constraint":
      return t("memoryKindConstraint");
    case "visit":
      return t("memoryKindVisit");
    case "feedback":
      return t("memoryKindFeedback");
    default:
      return kind;
  }
}

function sourceLabel(source: string, t: tFn): string {
  switch (source) {
    case "USER":
    case "USER_STATED":
      return t("memorySourceUser");
    case "AGENT_DERIVED":
    case "DERIVED":
      return t("memorySourceDerived");
    case "TRIP_HISTORY":
      return t("memorySourceHistory");
    case "IMPORTED":
      return t("memorySourceImported");
    default:
      return source;
  }
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(intlDateLocale(locale), {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

// ── GLAVNA STRAN ───────────────────────────────────────────────────────────

export default function MojProfilPage() {
  const locale = useLocale();
  const t = useCallback(
    <K extends keyof Dict>(key: K): (typeof L[K])["sl"] => pick(locale, L[key]),
    [locale]
  );
  const { status } = useSession();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />

      <div className="mt-8">
        {status === "loading" ? (
          <ProfileSkeleton />
        ) : status === "unauthenticated" ? (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-5 w-5" aria-hidden />
                <p className="font-medium">{t("signInNeeded")}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("signInLead")}
              </p>
              <Button asChild>
                <Link href="/prijava">{t("signInCta")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ProfilePanel />
        )}
      </div>
    </main>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ── PANEL (prijavljeni) ────────────────────────────────────────────────────

function ProfilePanel() {
  const locale = useLocale();
  const t = useCallback(
    <K extends keyof Dict>(key: K): (typeof L[K])["sl"] => pick(locale, L[key]),
    [locale]
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [personalization, setPersonalization] = useState<"on" | "off">("on");
  const [memories, setMemories] = useState<MemoryDto[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [prefRes, memRes] = await Promise.all([
        fetch("/api/preferences"),
        fetch("/api/memory"),
      ]);
      if (!prefRes.ok || !memRes.ok) throw new Error("load failed");
      const prefData = (await prefRes.json()) as {
        preferences: PrefDto[];
        personalization: "on" | "off";
      };
      const memData = (await memRes.json()) as { memories: MemoryDto[] };
      const map: Record<string, string> = {};
      for (const p of prefData.preferences) map[p.key] = p.value;
      setPrefs(map);
      setPersonalization(prefData.personalization);
      setMemories(memData.memories);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [load]);

  const savePref = useCallback(
    async (key: string, value: unknown): Promise<boolean> => {
      setBusyKey(key);
      try {
        const res = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          showFlash(data.error ?? t("loadError"));
          return false;
        }
        const data = (await res.json()) as { value: string };
        setPrefs((prev) => ({ ...prev, [key]: data.value }));
        showFlash(t("saved"));
        return true;
      } catch {
        showFlash(t("loadError"));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [showFlash, t]
  );

  const clearPref = useCallback(
    async (key: string) => {
      setBusyKey(key);
      try {
        const res = await fetch(`/api/preferences?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          showFlash(t("loadError"));
          return;
        }
        setPrefs((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        showFlash(t("cleared"));
      } catch {
        showFlash(t("loadError"));
      } finally {
        setBusyKey(null);
      }
    },
    [showFlash, t]
  );

  const togglePersonalization = useCallback(
    async (next: "on" | "off") => {
      const ok = await savePref("personalization", next);
      if (ok) setPersonalization(next);
    },
    [savePref]
  );

  const refreshMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = (await res.json()) as { memories: MemoryDto[] };
        setMemories(data.memories);
      }
    } catch {
      // tiho: naslednje dejanje uporabnika bo osvežilo
    }
  }, []);

  const addMemory = useCallback(
    async (kind: string, value: string): Promise<boolean> => {
      setBusyKey("memory:add");
      try {
        const res = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, value }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          showFlash(data.error ?? t("loadError"));
          return false;
        }
        await refreshMemories();
        showFlash(t("saved"));
        return true;
      } catch {
        showFlash(t("loadError"));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [refreshMemories, showFlash, t]
  );

  const updateMemory = useCallback(
    async (id: string, value: string): Promise<boolean> => {
      setBusyKey(`memory:${id}`);
      try {
        const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          showFlash(data.error ?? t("loadError"));
          return false;
        }
        await refreshMemories();
        showFlash(t("saved"));
        return true;
      } catch {
        showFlash(t("loadError"));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [refreshMemories, showFlash, t]
  );

  const deleteMemory = useCallback(
    async (id: string) => {
      setBusyKey(`memory:${id}`);
      try {
        const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          showFlash(t("loadError"));
          return;
        }
        await refreshMemories();
        showFlash(t("saved"));
      } catch {
        showFlash(t("loadError"));
      } finally {
        setBusyKey(null);
      }
    },
    [refreshMemories, showFlash, t]
  );

  const forgetAll = useCallback(async () => {
    setBusyKey("memory:forget");
    try {
      const res = await fetch("/api/memory?confirm=forget-all", {
        method: "DELETE",
      });
      if (!res.ok) {
        showFlash(t("loadError"));
        return;
      }
      await refreshMemories();
      showFlash(t("saved"));
    } catch {
      showFlash(t("loadError"));
    } finally {
      setBusyKey(null);
    }
  }, [refreshMemories, showFlash, t]);

  const foodValue = useMemo(() => {
    const v = prefValue(prefs.food);
    return typeof v === "string" ? v : "";
  }, [prefs.food]);

  if (loading) return <ProfileSkeleton />;

  if (loadError) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p
        aria-live="polite"
        className={
          flash
            ? "min-h-6 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            : "min-h-6 text-sm"
        }
      >
        {flash ?? ""}
      </p>

      <PersonalizationCard
        t={t}
        enabled={personalization === "on"}
        busy={busyKey === "personalization"}
        onToggle={togglePersonalization}
      />

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" aria-hidden />
            {t("preferencesTitle")}
          </CardTitle>
          <CardDescription>{t("preferencesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SINGLE_GROUPS.map((group) => (
            <fieldset key={group.key} className="space-y-2">
              <legend className="text-sm font-semibold">{t(group.titleKey)}</legend>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const current = prefValue(prefs[group.key]);
                  const active = current === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="min-h-11"
                      aria-pressed={active}
                      disabled={busyKey === group.key}
                      onClick={() => {
                        if (active) {
                          void clearPref(group.key);
                        } else {
                          void savePref(group.key, opt.value);
                        }
                      }}
                    >
                      {t(opt.labelKey)}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <WordListField
            t={t}
            label={t("interests")}
            description={t("interestsDesc")}
            raw={prefs.interests}
            suggestions={[...INTEREST_SUGGESTIONS]}
            busy={busyKey === "interests"}
            onSave={(words) => void savePref("interests", words)}
          />

          <WordListField
            t={t}
            label={t("avoid")}
            description={t("avoidDesc")}
            raw={prefs.avoid}
            suggestions={[]}
            busy={busyKey === "avoid"}
            onSave={(words) => void savePref("avoid", words)}
          />

          <div className="space-y-2">
            <Label htmlFor="food-pref">{t("food")}</Label>
            <Textarea
              id="food-pref"
              rows={2}
              maxLength={200}
              placeholder={t("foodPh")}
              defaultValue={foodValue}
              key={foodValue}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="min-h-11"
                disabled={busyKey === "food"}
                onClick={() => {
                  const el = document.getElementById(
                    "food-pref"
                  ) as HTMLTextAreaElement | null;
                  void savePref("food", el?.value ?? "");
                }}
              >
                {busyKey === "food" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
                {t("save")}
              </Button>
              {prefs.food !== undefined && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  disabled={busyKey === "food"}
                  onClick={() => void clearPref("food")}
                >
                  {t("clear")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <MemoryCard
        t={t}
        locale={locale}
        personalizationOff={personalization === "off"}
        memories={memories}
        busyKey={busyKey}
        onAdd={addMemory}
        onUpdate={updateMemory}
        onDelete={deleteMemory}
        onForgetAll={forgetAll}
      />

      <PrivacyCard t={t} />
    </div>
  );
}

// ── KARTICE ────────────────────────────────────────────────────────────────

function PersonalizationCard({
  t,
  enabled,
  busy,
  onToggle,
}: {
  t: tFn;
  enabled: boolean;
  busy: boolean;
  onToggle: (next: "on" | "off") => void;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" aria-hidden />
          {t("personalizationTitle")}
        </CardTitle>
        <CardDescription className="max-w-2xl leading-relaxed">
          {t("personalizationDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            disabled={busy}
            onCheckedChange={(checked) => onToggle(checked ? "on" : "off")}
            aria-label={t("personalizationTitle")}
          />
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? t("personalizationOn") : t("personalizationOff")}
          </Badge>
          {busy && (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WordListField({
  t,
  label,
  description,
  raw,
  suggestions,
  busy,
  onSave,
}: {
  t: tFn;
  label: string;
  description: string;
  raw: string | undefined;
  suggestions: string[];
  busy: boolean;
  onSave: (words: string[]) => void;
}) {
  const initial = useMemo(() => {
    const v = prefValue(raw);
    return Array.isArray(v) ? v : [];
  }, [raw]);
  const [words, setWords] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const dirty = useMemo(
    () => JSON.stringify(words) !== JSON.stringify(initial),
    [words, initial]
  );

  const addWord = (word: string) => {
    const clean = word.trim().slice(0, 40);
    if (clean.length === 0 || words.includes(clean) || words.length >= 12) return;
    setWords((prev) => [...prev, clean]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {initial.length > 0 && !dirty && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setWords([]);
              onSave([]);
            }}
          >
            {t("clear")}
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      {words.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {words.map((w) => (
            <li key={w}>
              <Badge variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
                {w}
                <button
                  type="button"
                  aria-label={`${t("delete")}: ${w}`}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  onClick={() => setWords((prev) => prev.filter((x) => x !== w))}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !words.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                className="min-h-9 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                onClick={() => addWord(s)}
              >
                + {s}
              </button>
            ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addWord(draft);
            }
          }}
          placeholder={t("addWord")}
          className="h-11 max-w-64"
          aria-label={`${label}: ${t("addWord")}`}
          maxLength={40}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={draft.trim().length === 0}
          onClick={() => addWord(draft)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("addWord")}
        </Button>
      </div>
      {dirty && (
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={busy}
          onClick={() => onSave(words)}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
          {t("save")}
        </Button>
      )}
    </div>
  );
}

function MemoryCard({
  t,
  locale,
  personalizationOff,
  memories,
  busyKey,
  onAdd,
  onUpdate,
  onDelete,
  onForgetAll,
}: {
  t: tFn;
  locale: string;
  personalizationOff: boolean;
  memories: MemoryDto[];
  busyKey: string | null;
  onAdd: (kind: string, value: string) => Promise<boolean>;
  onUpdate: (id: string, value: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  onForgetAll: () => void;
}) {
  const [kind, setKind] = useState("preference");
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const kindOptions: { value: string; label: string }[] = [
    { value: "preference", label: t("memoryKindPreference") },
    { value: "constraint", label: t("memoryKindConstraint") },
    { value: "fact", label: t("memoryKindFact") },
    { value: "visit", label: t("memoryKindVisit") },
    { value: "feedback", label: t("memoryKindFeedback") },
  ];

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" aria-hidden />
          {t("memoryTitle")}
        </CardTitle>
        <CardDescription className="max-w-2xl leading-relaxed">
          {t("memoryDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {personalizationOff && (
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
            role="note"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{t("memoryOffNote")}</p>
          </div>
        )}

        {memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("memoryEmpty")}</p>
        ) : (
          <ul
            className="max-h-96 space-y-3 overflow-y-auto pr-1"
            aria-label={t("memoryTitle")}
          >
            {memories.map((m) => (
              <li key={m.id} className="rounded-lg border p-3 sm:p-4">
                {editingId === m.id ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      maxLength={500}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      aria-label={t("edit")}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="min-h-11"
                        disabled={busyKey === `memory:${m.id}`}
                        onClick={async () => {
                          const ok = await onUpdate(m.id, editValue);
                          if (ok) setEditingId(null);
                        }}
                      >
                        {busyKey === `memory:${m.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Check className="h-4 w-4" aria-hidden />
                        )}
                        {t("save")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11"
                        onClick={() => setEditingId(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{kindLabel(m.kind, t)}</Badge>
                      <Badge variant="secondary">{sourceLabel(m.source, t)}</Badge>
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatDate(m.updatedAt, locale)}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed">
                      {m.value}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11"
                        onClick={() => {
                          setEditingId(m.id);
                          setEditValue(m.value);
                        }}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        {t("edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11 text-destructive hover:text-destructive"
                        disabled={busyKey === `memory:${m.id}`}
                        onClick={() => onDelete(m.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        {t("delete")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {memories.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="min-h-11 text-destructive hover:text-destructive"
                disabled={busyKey === "memory:forget"}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("forgetAll")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("forgetAllTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("forgetAllDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onForgetAll()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("forgetAllConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Separator />

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              const ok = await onAdd(kind, value);
              if (ok) setValue("");
            })();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="memory-kind">{t("memoryAdd")}</Label>
            <div className="flex flex-wrap gap-1.5" id="memory-kind">
              {kindOptions.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  aria-pressed={kind === k.value}
                  className={
                    "min-h-11 rounded-full border px-3 py-2 text-xs font-medium transition " +
                    (kind === k.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary hover:text-foreground")
                  }
                  onClick={() => setKind(k.value)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            id="memory-value"
            rows={3}
            maxLength={500}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("memoryValuePh")}
            aria-label={t("memoryAdd")}
          />
          <Button
            type="submit"
            className="min-h-11"
            disabled={value.trim().length === 0 || busyKey === "memory:add"}
          >
            {busyKey === "memory:add" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            {t("memoryAdd")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PrivacyCard({ t }: { t: tFn }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          {t("privacyTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t("privacy1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t("privacy2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t("privacy3")}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
