"use client";

import { Loader2, MapPin, Search, Send, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALL_COUNTRY_CODES, COUNTRIES } from "@/lib/countries-data";
import type { GeocodeHit } from "@/lib/geocoding-server";
import { pick } from "@/lib/i18n-pick";
import { PROVIDER_CATEGORIES, isCanonCountry } from "@/lib/provider-model";

/**
 * Prijavnica ponudniškega profila (#35 faza 4b, §6c.1) — javna, brez prijave.
 * Faza 3 (2.64.0): krajevno iskanje (Photon/OpenStreetMap prek /api/geocode)
 * izpolni kraj/regijo/državo/koordinati — ROČNI VNOS OSTANE VEDNO MOGOČ
 * (reverzibilnost kanon: iskanje je pomoč, ne vrata).
 *
 * KANONI (iskrenost):
 *  · Prijava NIKOLI ne objavi profila — gre v osnutek (status "draft"),
 *    skrbnik objavi po pregledu (admin UI faza 4b).
 *  · Iskanje: strežniški Photon (BJS) — source "photon" samo za realne
 *    odgovore; napaka → source "none" → iskreno sporočilo + ročni vnos.
 *    Zadetki so filtrirani na 10 kanonskih držav (filtriranje je vidno).
 *  · Atribucija OSM je VEDNO vidna ob zadetkih (ODbL kanon, ATTRIBUTIONS.md).
 *  · Dedup (geohash-7 + ime) — 409 pokaže pošteno razlago.
 *  · Brez osebnih podatkov razen kontakt ponudnika (telefon/e-pošta) —
 *    to so podatki profila, ne sledenja (GDPR R6).
 */

const CATEGORY_LABELS: Record<string, Record<"sl" | "en" | "it" | "de" | "fr" | "es", string>> = {
  accommodation: { sl: "Nastanitev", en: "Accommodation", it: "Alloggio", de: "Unterkunft", fr: "Hébergement", es: "Alojamiento" },
  food: { sl: "Hrana in pijača", en: "Food & drink", it: "Cibo e bevande", de: "Essen & Trinken", fr: "Gastronomie", es: "Comida y bebida" },
  guide: { sl: "Vodnik", en: "Guide", it: "Guida", de: "Reiseleiter", fr: "Guide", es: "Guía" },
  activity: { sl: "Aktivnost", en: "Activity", it: "Attività", de: "Aktivität", fr: "Activité", es: "Actividad" },
  transport: { sl: "Prevoz", en: "Transport", it: "Trasporto", de: "Transport", fr: "Transport", es: "Transporte" },
  attraction: { sl: "Znamenitost", en: "Attraction", it: "Attrazione", de: "Sehenswürdigkeit", fr: "Attraction", es: "Atracción" },
  event: { sl: "Dogodek", en: "Event", it: "Evento", de: "Veranstaltung", fr: "Événement", es: "Evento" },
  wellness: { sl: "Wellness", en: "Wellness", it: "Benessere", de: "Wellness", fr: "Bien-être", es: "Bienestar" },
};

type Locales = "sl" | "en" | "it" | "de" | "fr" | "es";

const MIN_SEARCH_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 400;

export default function ProviderApplyForm() {
  const l = useLocale() as Locales;

  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // ── Faza 3: krajevno iskanje (Photon prek /api/geocode) ─────────────
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchHits, setSearchHits] = React.useState<GeocodeHit[]>([]);
  const [searchState, setSearchState] = React.useState<
    "idle" | "loading" | "open" | "nohits" | "unavailable" | "filtered" | "rateLimited"
  >("idle");
  const [highlight, setHighlight] = React.useState(-1);
  const searchBoxRef = React.useRef<HTMLDivElement | null>(null);
  const searchSeqRef = React.useRef(0);
  /** Po izbiri zadetka enkrat ustavi samodejno iskanje oznake (re-priklop). */
  const suppressSearchRef = React.useRef(false);
  const placeInputRef = React.useRef<HTMLInputElement | null>(null);
  const regionInputRef = React.useRef<HTMLInputElement | null>(null);
  const latInputRef = React.useRef<HTMLInputElement | null>(null);
  const lngInputRef = React.useRef<HTMLInputElement | null>(null);
  const countrySelectRef = React.useRef<HTMLSelectElement | null>(null);

  const L: Record<string, Record<Locales, string>> = {
    title: { sl: "Prijavi svoj ponudniški profil", en: "Submit your provider profile", it: "Invia il tuo profilo di fornitore", de: "Dein Anbieterprofil einreichen", fr: "Soumettre ton profil de prestataire", es: "Envía tu perfil de proveedor" },
    lead: {
      sl: "Brezplačno v beta fazi — za ponudnike z vsega Balkana (10 držav). Profil gre v osnutek; skrbnik ga pregleda in objavi. Nikoli se ne objavi samodejno.",
      en: "Free during beta — for providers from across the Balkans (10 countries). Your profile goes to draft; an admin reviews and publishes it. It is never published automatically.",
      it: "Gratis in fase beta — per fornitori da tutta la Penisola Balcanica (10 paesi). Il profilo va in bozza; un amministratore lo esamina e lo pubblica. Non viene mai pubblicato automaticamente.",
      de: "In der Beta-Phase kostenlos — für Anbieter aus dem gesamten Balkan (10 Länder). Dein Profil landet im Entwurf; ein Admin prüft und veröffentlicht es. Es wird nie automatisch veröffentlicht.",
      fr: "Gratuit en version bêta — pour les prestataires de tous les Balkans (10 pays). Ton profil passe en brouillon ; un admin le révise et le publie. Il n'est jamais publié automatiquement.",
      es: "Gratis en fase beta — para proveedores de toda la región balcánica (10 países). Tu perfil pasa a borrador; un admin lo revisa y publica. Nunca se publica automáticamente.",
    },
    name: { sl: "Ime ponudnika", en: "Provider name", it: "Nome del fornitore", de: "Name des Anbieters", fr: "Nom du prestataire", es: "Nombre del proveedor" },
    category: { sl: "Kategorija", en: "Category", it: "Categoria", de: "Kategorie", fr: "Catégorie", es: "Categoría" },
    subcategory: { sl: "Podkategorija (neobvezno)", en: "Subcategory (optional)", it: "Sottocategoria (opzionale)", de: "Unterkategorie (optional)", fr: "Sous-catégorie (facultatif)", es: "Subcategoría (opcional)" },
    country: { sl: "Država", en: "Country", it: "Paese", de: "Land", fr: "Pays", es: "País" },
    region: { sl: "Regija", en: "Region", it: "Regione", de: "Region", fr: "Région", es: "Región" },
    place: { sl: "Kraj", en: "Place", it: "Località", de: "Ort", fr: "Lieu", es: "Lugar" },
    lat: { sl: "Zemljepisna širina (lat)", en: "Latitude (lat)", it: "Latitudine (lat)", de: "Breitengrad (lat)", fr: "Latitude (lat)", es: "Latitud (lat)" },
    lng: { sl: "Zemljepisna dolžina (lng)", en: "Longitude (lng)", it: "Longitudine (lng)", de: "Längengrad (lng)", fr: "Longitude (lng)", es: "Longitud (lng)" },
    searchLabel: {
      sl: "Išči kraj (neobvezno)", en: "Search for a place (optional)", it: "Cerca un luogo (opzionale)", de: "Ort suchen (optional)", fr: "Rechercher un lieu (facultatif)", es: "Buscar un lugar (opcional)",
    },
    searchHint: {
      sl: "Vpiši vsaj 3 znake — zadetek izpolni kraj, državo in koordinati (regijo, če je znana). Ročni vnos spodaj ostaja vedno mogoč.",
      en: "Type at least 3 characters — a result fills place, country and coordinates (region when known). Manual entry below always remains possible.",
      it: "Digita almeno 3 caratteri — un risultato compila località, paese e coordinate (regione se nota). L'inserimento manuale qui sotto resta sempre possibile.",
      de: "Tippe mindestens 3 Zeichen — ein Treffer füllt Ort, Land und Koordinaten (Region, falls bekannt). Manuelle Eingabe unten bleibt immer möglich.",
      fr: "Tape au moins 3 caractères — un résultat remplit lieu, pays et coordonnées (région si connue). La saisie manuelle ci-dessous reste toujours possible.",
      es: "Escribe al menos 3 caracteres — un resultado rellena lugar, país y coordenadas (región si se conoce). La entrada manual abajo siempre es posible.",
    },
    nohits: { sl: "Ni zadetkov.", en: "No results.", it: "Nessun risultato.", de: "Keine Treffer.", fr: "Aucun résultat.", es: "Sin resultados." },
    filtered: {
      sl: "Zadetki samo v 10 državah platforme.", en: "Results limited to the platform's 10 countries.", it: "Risultati solo nei 10 paesi della piattaforma.", de: "Treffer nur in den 10 Ländern der Plattform.", fr: "Résultats limités aux 10 pays de la plateforme.", es: "Resultados solo en los 10 países de la plataforma.",
    },
    unavailable: {
      sl: "Iskanje trenutno ni na voljo — vpiši polja ročno.", en: "Search is currently unavailable — fill the fields manually.", it: "La ricerca non è al momento disponibile — compila i campi manualmente.", de: "Die Suche ist derzeit nicht verfügbar — fülle die Felder manuell aus.", fr: "La recherche est actuellement indisponible — remplis les champs manuellement.", es: "La búsqueda no está disponible ahora — rellena los campos manualmente.",
    },
    rateLimited: {
      sl: "Preveč iskanj — poskusi čez minuto.", en: "Too many searches — try again in a minute.", it: "Troppe ricerche — riprova tra un minuto.", de: "Zu viele Suchen — versuche es in einer Minute wieder.", fr: "Trop de recherches — réessaie dans une minute.", es: "Demasiadas búsquedas — inténtalo en un minuto.",
    },
    attribution: {
      sl: "Vir: Photon · © OpenStreetMap contributors", en: "Source: Photon · © OpenStreetMap contributors", it: "Fonte: Photon · © OpenStreetMap contributors", de: "Quelle: Photon · © OpenStreetMap contributors", fr: "Source : Photon · © OpenStreetMap contributors", es: "Fuente: Photon · © OpenStreetMap contributors",
    },
    useResult: { sl: "Uporabi", en: "Use", it: "Usa", de: "Verwenden", fr: "Utiliser", es: "Usar" },
    coordsHelp: {
      sl: "Ročno (npr. iz zemljevida) ali uporabi iskanje zgoraj — enostavno menjljivo.",
      en: "Manual (e.g. from a map) or use the search above — easily interchangeable.",
      it: "Manuale (ad es. da una mappa) o usa la ricerca sopra — facilmente intercambiabile.",
      de: "Manuell (z. B. aus einer Karte) oder die Suche oben verwenden — leicht austauschbar.",
      fr: "Manuel (par ex. depuis une carte) ou utilise la recherche ci-dessus — facilement interchangeable.",
      es: "Manual (p. ej., desde un mapa) o usa la búsqueda de arriba — fácilmente intercambiable.",
    },
    description: { sl: "Opis (vsaj 10 znakov)", en: "Description (min. 10 characters)", it: "Descrizione (min. 10 caratteri)", de: "Beschreibung (mind. 10 Zeichen)", fr: "Description (min. 10 caractères)", es: "Descripción (mín. 10 caracteres)" },
    languages: { sl: "Jeziki (CSV, npr. sl,en)", en: "Languages (CSV, e.g. en,sl)", it: "Lingue (CSV, es. it,en)", de: "Sprachen (CSV, z. B. de,en)", fr: "Langues (CSV, ex. fr,en)", es: "Idiomas (CSV, p. ej. es,en)" },
    officialUrl: { sl: "Spletna stran (neobvezno)", en: "Website (optional)", it: "Sito web (opzionale)", de: "Website (optional)", fr: "Site web (facultatif)", es: "Sitio web (opcional)" },
    phone: { sl: "Telefon (neobvezno, +386 …)", en: "Phone (optional, +386 …)", it: "Telefono (opzionale, +39 …)", de: "Telefon (optional, +49 …)", fr: "Téléphone (facultatif, +33 …)", es: "Teléfono (opcional, +34 …)" },
    email: { sl: "E-pošta (neobvezno)", en: "Email (optional)", it: "E-mail (opzionale)", de: "E-Mail (optional)", fr: "E-mail (facultatif)", es: "Correo (opcional)" },
    priceFrom: { sl: "„Od“-cena (neobvezno)", en: "„From“ price (optional)", it: "Prezzo „da“ (opzionale)", de: "„Ab“-Preis (optional)", fr: "Prix „dès“ (facultatif)", es: "Precio „desde“ (opcional)" },
    send: { sl: "Pošlji prijavo", en: "Submit application", it: "Invia la candidatura", de: "Bewerbung senden", fr: "Envoyer la candidature", es: "Enviar la solicitud" },
    sending: { sl: "Pošiljanje …", en: "Submitting …", it: "Invio in corso …", de: "Wird gesendet …", fr: "Envoi en cours …", es: "Enviando …" },
    doneTitle: { sl: "Prijava prejeta", en: "Application received", it: "Candidatura ricevuta", de: "Bewerbung erhalten", fr: "Candidature reçue", es: "Solicitud recibida" },
    doneLead: {
      sl: "Tvoj profil je v osnutku in čaka skrbniški pregled. Ne objavi se samodejno — o obdelavi te lahko obvestimo na e-pošto, če si jo podal.",
      en: "Your profile is in draft and awaiting admin review. It is not published automatically — if you provided an email, we can notify you about the outcome.",
      it: "Il tuo profilo è in bozza e in attesa di revisione. Non viene pubblicato automaticamente — se hai fornito un'e-mail, possiamo avvisarti dell'esito.",
      de: "Dein Profil ist im Entwurf und wartet auf die Admin-Prüfung. Es wird nicht automatisch veröffentlicht — wenn du eine E-Mail angegeben hast, informieren wir dich über den Ausgang.",
      fr: "Ton profil est en brouillon et attend la révision de l'admin. Il n'est pas publié automatiquement — si tu as fourni un e-mail, nous pouvons t'informer du résultat.",
      es: "Tu perfil está en borrador y a la espera de revisión. No se publica automáticamente — si indicaste un correo, podemos avisarte del resultado.",
    },
    draftBadge: { sl: "osnutek — čaka pregled", en: "draft — awaiting review", it: "bozza — in attesa di revisione", de: "Entwurf — wartet auf Prüfung", fr: "brouillon — en attente de révision", es: "borrador — a la espera de revisión" },
    err: { sl: "Prijava ni uspela.", en: "The submission failed.", it: "L'invio non è riuscito.", de: "Das Senden ist fehlgeschlagen.", fr: "L'envoi a échoué.", es: "El envío falló." },
  } as const;

  const t = React.useCallback(<K extends keyof typeof L>(k: K): string => pick(l, L[k]), [l]);

  // ── Iskanje: debounce 400 ms, ≥3 znakov, zavrženi zastareli odgovori ─
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false; // oznaka izbranega zadetka — ne išči
      return;
    }
    if (q.length < MIN_SEARCH_CHARS) {
      setSearchHits([]);
      setSearchState("idle");
      return;
    }
    setSearchState("loading");
    const seq = ++searchSeqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}&limit=5`,
          { headers: { Accept: "application/json" } }
        );
        if (res.status === 429) {
          if (searchSeqRef.current !== seq) return;
          setSearchHits([]);
          setSearchState("rateLimited");
          return;
        }
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; source?: string; hits?: GeocodeHit[] }
          | null;
        if (searchSeqRef.current !== seq || !res.ok || !body?.ok) {
          if (searchSeqRef.current === seq) {
            setSearchHits([]);
            setSearchState("unavailable");
          }
          return;
        }
        const hits = body.hits ?? [];
        if (body.source !== "photon") {
          // Iskrenostni kanon: "none" = vir ni dosegljiv (NE "ni zadetkov") —
          // sporočilo usmeri k ročnemu vnosu (vedno mogoč).
          setSearchHits([]);
          setSearchState("unavailable");
          return;
        }
        if (hits.length === 0) {
          setSearchHits([]);
          setSearchState("nohits");
          return;
        }
        const canonHits = hits.filter((h) => isCanonCountry(h.countryCode));
        if (canonHits.length === 0) {
          setSearchHits([]);
          setSearchState("filtered");
          return;
        }
        setSearchHits(canonHits);
        setHighlight(-1);
        setSearchState("open");
      } catch {
        if (searchSeqRef.current !== seq) return;
        setSearchHits([]);
        setSearchState("unavailable");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Klik zunaj zapre spustni seznam.
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!searchBoxRef.current?.contains(e.target as Node)) {
        setSearchState((s) => (s === "open" ? "idle" : s));
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pickHit(hit: GeocodeHit) {
    // „Kraj" = mesto/vas: city ?? ime (iskanje „Ljubljanski grad" → kraj Ljubljana).
    if (placeInputRef.current) {
      placeInputRef.current.value = hit.city ?? hit.name;
    }
    if (regionInputRef.current && hit.region && regionInputRef.current.value.trim() === "") {
      regionInputRef.current.value = hit.region;
    }
    if (latInputRef.current) latInputRef.current.value = String(hit.lat);
    if (lngInputRef.current) lngInputRef.current.value = String(hit.lng);
    if (countrySelectRef.current && isCanonCountry(hit.countryCode)) {
      countrySelectRef.current.value = hit.countryCode;
    }
    suppressSearchRef.current = true;
    setSearchQuery(hit.label);
    setSearchHits([]);
    setSearchState("idle");
    placeInputRef.current?.focus();
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (searchState !== "open" || searchHits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % searchHits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? searchHits.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = highlight >= 0 ? highlight : 0;
      pickHit(searchHits[idx] as GeocodeHit);
    } else if (e.key === "Escape") {
      setSearchState("idle");
      setSearchHits([]);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setErr(null);

    const fd = new FormData(e.currentTarget);
    const num = (k: string): number | undefined => {
      const v = fd.get(k);
      if (typeof v !== "string" || v.trim() === "") return undefined;
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };

    const payload = {
      name: String(fd.get("name") ?? ""),
      countryCode: String(fd.get("countryCode") ?? ""),
      region: String(fd.get("region") ?? ""),
      place: String(fd.get("place") ?? ""),
      lat: num("lat") ?? 999,
      lng: num("lng") ?? 999,
      category: String(fd.get("category") ?? ""),
      subcategory: String(fd.get("subcategory") ?? "") || undefined,
      description: String(fd.get("description") ?? ""),
      languages: String(fd.get("languages") ?? ""),
      officialUrl: String(fd.get("officialUrl") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      priceFrom: num("priceFrom"),
    };

    try {
      const res = await fetch("/api/providers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string } | null;
      if (res.ok && body?.ok && body.id) {
        setDone(body.id);
      } else {
        setErr(body?.error ?? t("err"));
      }
    } catch {
      setErr(t("err"));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <Card id="prijava-ponudnika" className="scroll-mt-24 rounded-2xl border-primary/30 bg-gradient-to-br from-primary/[0.05] to-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <CardTitle className="text-base">{t("doneTitle")}</CardTitle>
          </div>
          <CardDescription className="mt-1">{t("doneLead")}</CardDescription>
          <Badge variant="outline" className="mt-3 w-fit">
            {t("draftBadge")}
          </Badge>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="prijava-ponudnika" className="scroll-mt-24 rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("lead")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate={false}>
          <div className="grid gap-1.5">
            <Label htmlFor="p-name">{t("name")}</Label>
            <Input id="p-name" name="name" required minLength={2} maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-category">{t("category")}</Label>
            <select
              id="p-category"
              name="category"
              required
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PROVIDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {pick(l, CATEGORY_LABELS[c])}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-subcategory">{t("subcategory")}</Label>
            <Input id="p-subcategory" name="subcategory" maxLength={60} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-country">{t("country")}</Label>
            <select
              id="p-country"
              name="countryCode"
              required
              defaultValue="SI"
              ref={countrySelectRef}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ALL_COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>
                  {COUNTRIES[code].flag} {pick(l, COUNTRIES[code].names)}
                </option>
              ))}
            </select>
          </div>

          {/* Faza 3: krajevno iskanje (Photon/OSM prek strežniškega /api/geocode) */}
          <div ref={searchBoxRef} className="relative grid gap-1.5 sm:col-span-2">
            <Label htmlFor="p-search">{t("searchLabel")}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="p-search"
                type="text"
                role="combobox"
                aria-expanded={searchState === "open"}
                aria-controls="p-search-listbox"
                aria-autocomplete="list"
                autoComplete="off"
                className="pl-9"
                placeholder="Ljubljanski grad, Bled, Mostar …"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
              />
              {searchState === "loading" && (
                <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("searchHint")}</p>

            {(searchState === "open" || searchState === "nohits" || searchState === "unavailable" || searchState === "filtered" || searchState === "rateLimited") && (
              <div
                id="p-search-listbox"
                role="listbox"
                aria-label={t("searchLabel")}
                className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-background shadow-xl"
              >
                {searchState === "open" &&
                  searchHits.map((hit, i) => (
                    <button
                      // Photon lahko vrne 2 lastnosti z ISTIM imenom + koordinatama
                      // (npr. dva OSM vnosna vozlišča) — indeks prepreči podvojen ključ.
                      key={`${hit.countryCode}-${hit.lat}-${hit.lng}-${hit.name}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        i === highlight ? "bg-accent" : "hover:bg-accent"
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault(); // ne pusti blur-a zapreti seznama pred izbiro
                        pickHit(hit);
                      }}
                      onMouseEnter={() => setHighlight(i)}
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{hit.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[hit.city, hit.region, hit.country].filter(Boolean).join(", ")} · {hit.lat.toFixed(4)}, {hit.lng.toFixed(4)}
                        </span>
                      </span>
                    </button>
                  ))}
                {searchState === "nohits" && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t("nohits")}</p>
                )}
                {searchState === "filtered" && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t("filtered")}</p>
                )}
                {searchState === "unavailable" && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t("unavailable")}</p>
                )}
                {searchState === "rateLimited" && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t("rateLimited")}</p>
                )}
                {searchHits.length > 0 && (
                  <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                    {t("attribution")}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="p-region">{t("region")}</Label>
            <Input id="p-region" name="region" required minLength={2} maxLength={80} ref={regionInputRef} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-place">{t("place")}</Label>
            <Input id="p-place" name="place" required minLength={2} maxLength={80} ref={placeInputRef} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lat">{t("lat")}</Label>
            <Input id="p-lat" name="lat" required inputMode="decimal" placeholder="46.0569" ref={latInputRef} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lng">{t("lng")}</Label>
            <Input id="p-lng" name="lng" required inputMode="decimal" placeholder="14.5058" ref={lngInputRef} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">{t("coordsHelp")}</p>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="p-description">{t("description")}</Label>
            <Textarea id="p-description" name="description" required minLength={10} maxLength={1000} rows={4} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-languages">{t("languages")}</Label>
            <Input id="p-languages" name="languages" required defaultValue="sl,en" maxLength={60} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-officialUrl">{t("officialUrl")}</Label>
            <Input id="p-officialUrl" name="officialUrl" type="url" placeholder="https://…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-phone">{t("phone")}</Label>
            <Input id="p-phone" name="phone" type="tel" placeholder="+386 1 234 56 78" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-email">{t("email")}</Label>
            <Input id="p-email" name="email" type="email" maxLength={160} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-priceFrom">{t("priceFrom")}</Label>
            <Input id="p-priceFrom" name="priceFrom" inputMode="decimal" placeholder="35" />
          </div>
          {err && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {err}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={sending} className="w-full sm:w-auto">
              {sending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
                  {t("sending")}
                </>
              ) : (
                <>
                  <Send className="mr-1.5 size-4" aria-hidden="true" />
                  {t("send")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
