"use client";

import { Loader2, Send, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALL_COUNTRY_CODES, COUNTRIES } from "@/lib/countries-data";
import { pick } from "@/lib/i18n-pick";
import { PROVIDER_CATEGORIES } from "@/lib/provider-model";

/**
 * Prijavnica ponudniškega profila (#35 faza 4b, §6c.1) — javna, brez prijave.
 *
 * KANONI (iskrenost):
 *  · Prijava NIKOLI ne objavi profila — gre v osnutek (status "draft"),
 *    skrbnik objavi po pregledu (admin UI faza 4b).
 *  · Koordinati so zaenkrat ročni vnos (iskreno označeno) — samodejni
 *    geokoding je faza 3 (Photon).
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

export default function ProviderApplyForm() {
  const l = useLocale() as Locales;

  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

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
    coordsHelp: {
      sl: "ZaNEnkrat ročno (npr. iz zemljevida); samodejni geokoding je v načrtu (faza 3).",
      en: "Manual for now (e.g. from a map); automatic geocoding is planned (phase 3).",
      it: "Per ora manuale (ad es. da una mappa); la geocodifica automatica è prevista (fase 3).",
      de: "Vorerst manuell (z. B. aus einer Karte); automatische Geokodierung ist geplant (Phase 3).",
      fr: "Manuel pour l'instant (par ex. depuis une carte) ; le géocodage automatique est prévu (phase 3).",
      es: "Manual por ahora (p. ej., desde un mapa); la geocodificación automática está prevista (fase 3).",
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
      <Card id="prijava-ponudnika" className="scroll-mt-24 border-primary/30">
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
    <Card id="prijava-ponudnika" className="scroll-mt-24">
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
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ALL_COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>
                  {COUNTRIES[code].flag} {pick(l, COUNTRIES[code].names)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-region">{t("region")}</Label>
            <Input id="p-region" name="region" required minLength={2} maxLength={80} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-place">{t("place")}</Label>
            <Input id="p-place" name="place" required minLength={2} maxLength={80} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lat">{t("lat")}</Label>
            <Input id="p-lat" name="lat" required inputMode="decimal" placeholder="46.0569" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lng">{t("lng")}</Label>
            <Input id="p-lng" name="lng" required inputMode="decimal" placeholder="14.5058" />
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
