"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  BookOpen,
  CalendarDays,
  Loader2,
  MapPin,
  PenLine,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { pick } from "@/lib/i18n-pick";
import { entriesLabel, slTimeAgo } from "@/lib/sl-utils";

// ============================================================================
// TRIP SOCIAL → SKUPNOSTNI POTNI DNEVNIK na /pot/[shareId] — rekonstrukcija
// F12 iz izvirnika 1.163.4 (TripDiaryEntry, model + čista logika v
// src/lib/trip-journal.ts). IZVIRNIKOV KANON (Stippl "travel reel"):
//   - TEXTOVNI spomini BREZ slik — "naš pošteni tekstovni pristop BREZ
//     slik: zasebnost + ni stroškov shrambe";
//   - dan (1-based), kraj spomina (1–80) in ocena (1–5 zvezdic) so
//     opcijski; spomin sam (2–2000) je edino obvezno polje;
//   - natisnjena stran = "photobook" — seznam vpisov je NAMENO tiskljiv
//     (formular in gumbi so print:hidden, vpisi NISO);
//   - ureja/izbriše avtor (ali lastnik poti) — `mine` je strežniška
//     značka, klient je ne more ponarediti.
//
// Živost: dnevnik so spomini, ne pogovor — enkratni naloz + osvežitev po
// vsaki spremembi (isti vzorec kot ankete), brez pollinga (iskreno).
// ============================================================================

const JOURNAL_TEXT_MAX = 2000;

/** Barve avatarjev — ista topla paleta kot klepet (brez modre/indigo). */
const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-amber-600",
  "bg-teal-700",
  "bg-orange-700",
  "bg-lime-700",
] as const;

/** 6-jezični slovarji (kanon pick — sl resnica, parity test zakleni). */
const DICT = {
  title: {
    sl: "Dnevnik potovanja",
    en: "Travel journal",
    it: "Diario di viaggio",
    de: "Reisetagebuch",
    fr: "Journal de voyage",
    es: "Diario de viaje",
  },
  subtitle: {
    sl: "Tekstovni spomini skupine — brez slik (zasebnost), natisni jih kot spominek.",
    en: "The group’s written memories — no images (privacy), print them as a keepsake.",
    it: "Ricordi scritti del gruppo — senza immagini (privacy), stampali come ricordo.",
    de: "Geschriebene Erinnerungen der Gruppe — ohne Bilder (Privatsphäre), als Andenken ausdrucken.",
    fr: "Souvenirs écrits du groupe — sans images (confidentialité), imprime-les comme souvenir.",
    es: "Recuerdos escritos del grupo — sin imágenes (privacidad), imprímelos como recuerdo.",
  },
  empty: {
    sl: "Še ni spominov — bodi prvi, ki zapiše dogodivščino!",
    en: "No memories yet — be the first to write down an adventure!",
    it: "Ancora nessun ricordo — sii il primo a raccontare un’avventura!",
    de: "Noch keine Erinnerungen — sei der Erste, der ein Abenteuer festhält!",
    fr: "Aucun souvenir pour l’instant — sois le premier à raconter une aventure !",
    es: "Aún no hay recuerdos — ¡sé el primero en contar una aventura!",
  },
  emptyHint: {
    sl: "Kaj si videl, okusil, doživel? Zapiši dan, kraj in oceno — skupina bo cenila.",
    en: "What did you see, taste, experience? Note the day, place and a rating — the group will appreciate it.",
    it: "Cosa hai visto, assaporato, vissuto? Annota giorno, luogo e voto — il gruppo lo apprezzerà.",
    de: "Was hast du gesehen, geschmeckt, erlebt? Notiere Tag, Ort und Bewertung — die Gruppe freut sich.",
    fr: "Qu’as-tu vu, goûté, vécu ? Note le jour, le lieu et une note — le groupe l’appréciera.",
    es: "¿Qué viste, saboreaste, viviste? Anota el día, el lugar y una valoración — el grupo lo agradecerá.",
  },
  loading: {
    sl: "Nalagam dnevnik …",
    en: "Loading journal …",
    it: "Carico il diario …",
    de: "Lade Tagebuch …",
    fr: "Chargement du journal …",
    es: "Cargando el diario …",
  },
  formTitle: {
    sl: "Nov spomin",
    en: "New memory",
    it: "Nuovo ricordo",
    de: "Neue Erinnerung",
    fr: "Nouveau souvenir",
    es: "Nuevo recuerdo",
  },
  editTitle: {
    sl: "Urejam spomin",
    en: "Editing memory",
    it: "Modifica ricordo",
    de: "Erinnerung bearbeiten",
    fr: "Modifier le souvenir",
    es: "Editando recuerdo",
  },
  labelDay: {
    sl: "Dan",
    en: "Day",
    it: "Giorno",
    de: "Tag",
    fr: "Jour",
    es: "Día",
  },
  dayGeneral: {
    sl: "Splošno",
    en: "General",
    it: "Generale",
    de: "Allgemein",
    fr: "Général",
    es: "General",
  },
  dayN: {
    sl: (n: number) => `${n}. dan`,
    en: (n: number) => `Day ${n}`,
    it: (n: number) => `Giorno ${n}`,
    de: (n: number) => `Tag ${n}`,
    fr: (n: number) => `Jour ${n}`,
    es: (n: number) => `Día ${n}`,
  },
  labelPlace: {
    sl: "Kraj spomina (neobvezno)",
    en: "Place of the memory (optional)",
    it: "Luogo del ricordo (facoltativo)",
    de: "Ort der Erinnerung (optional)",
    fr: "Lieu du souvenir (facultatif)",
    es: "Lugar del recuerdo (opcional)",
  },
  placePlaceholder: {
    sl: "npr. Bled — jezero",
    en: "e.g. Lake Bled",
    it: "es. Lago di Bled",
    de: "z. B. Bleder See",
    fr: "ex. lac de Bled",
    es: "p. ej. lago de Bled",
  },
  labelRating: {
    sl: "Ocena (neobvezno)",
    en: "Rating (optional)",
    it: "Voto (facoltativo)",
    de: "Bewertung (optional)",
    fr: "Note (facultatif)",
    es: "Valoración (opcional)",
  },
  ratingN: {
    sl: (n: number) => `Oceni z ${n} zvezdicami`,
    en: (n: number) => `Rate ${n} stars`,
    it: (n: number) => `Valuta con ${n} stelle`,
    de: (n: number) => `Mit ${n} Sternen bewerten`,
    fr: (n: number) => `Noter ${n} étoiles`,
    es: (n: number) => `Valorar con ${n} estrellas`,
  },
  labelMemory: {
    sl: "Spomin",
    en: "Memory",
    it: "Ricordo",
    de: "Erinnerung",
    fr: "Souvenir",
    es: "Recuerdo",
  },
  memoryPlaceholder: {
    sl: "Zapiši dogodivščino — kaj se je zgodilo, kdo je bil tam, zakaj boš to pametil …",
    en: "Write down the adventure — what happened, who was there, why you’ll remember it …",
    it: "Racconta l’avventura — cosa è successo, chi c’era, perché la ricorderai …",
    de: "Halte das Abenteuer fest — was geschah, wer dabei war, warum du es behalten wirst …",
    fr: "Raconte l’aventure — ce qui s’est passé, qui y était, pourquoi tu t’en souviendras …",
    es: "Cuenta la aventura — qué pasó, quién estaba, por qué lo recordarás …",
  },
  publish: {
    sl: "Objavi spomin",
    en: "Publish memory",
    it: "Pubblica ricordo",
    de: "Erinnerung veröffentlichen",
    fr: "Publier le souvenir",
    es: "Publicar recuerdo",
  },
  saving: {
    sl: "Shranjujem …",
    en: "Saving …",
    it: "Salvataggio …",
    de: "Speichern …",
    fr: "Enregistrement …",
    es: "Guardando …",
  },
  saveChanges: {
    sl: "Shrani spremembe",
    en: "Save changes",
    it: "Salva modifiche",
    de: "Änderungen speichern",
    fr: "Enregistrer les modifications",
    es: "Guardar cambios",
  },
  cancel: {
    sl: "Prekliči",
    en: "Cancel",
    it: "Annulla",
    de: "Abbrechen",
    fr: "Annuler",
    es: "Cancelar",
  },
  edit: {
    sl: "Uredi",
    en: "Edit",
    it: "Modifica",
    de: "Bearbeiten",
    fr: "Modifier",
    es: "Editar",
  },
  remove: {
    sl: "Izbriši",
    en: "Delete",
    it: "Elimina",
    de: "Löschen",
    fr: "Supprimer",
    es: "Eliminar",
  },
  confirmDelete: {
    sl: "Res izbrišem?",
    en: "Delete for real?",
    it: "Eliminare davvero?",
    de: "Wirklich löschen?",
    fr: "Supprimer vraiment ?",
    es: "¿Eliminar de verdad?",
  },
  publishedToast: {
    sl: "Spomin je zapisan",
    en: "Memory saved",
    it: "Ricordo salvato",
    de: "Erinnerung gespeichert",
    fr: "Souvenir enregistré",
    es: "Recuerdo guardado",
  },
  updatedToast: {
    sl: "Spomin je posodobljen",
    en: "Memory updated",
    it: "Ricordo aggiornato",
    de: "Erinnerung aktualisiert",
    fr: "Souvenir mis à jour",
    es: "Recuerdo actualizado",
  },
  deletedToast: {
    sl: "Spomin je izbrisan",
    en: "Memory deleted",
    it: "Ricordo eliminato",
    de: "Erinnerung gelöscht",
    fr: "Souvenir supprimé",
    es: "Recuerdo eliminado",
  },
  errorToast: {
    sl: "Vpisa ni bilo mogoče shraniti",
    en: "The memory could not be saved",
    it: "Impossibile salvare il ricordo",
    de: "Erinnerung konnte nicht gespeichert werden",
    fr: "Impossible d’enregistrer le souvenir",
    es: "No se pudo guardar el recuerdo",
  },
  writeAs: {
    sl: "Pišeš kot",
    en: "You are writing as",
    it: "Stai scrivendo come",
    de: "Du schreibst als",
    fr: "Tu écris en tant que",
    es: "Escribes como",
  },
  loginHint: {
    sl: "Dnevnik je berljiv vsem; za zapisovanje se prijavi kot sodelujoči na tej poti (vloga se dodeli s vabilom lastnika).",
    en: "The journal is readable by everyone; to write, sign in as a participant of this trip (the role is granted via the owner’s invitation).",
    it: "Il diario è leggibile da tutti; per scrivere accedi come partecipante di questo viaggio (il ruolo arriva dall’invito del proprietario).",
    de: "Das Tagebuch ist für alle lesbar; zum Schreiben melde dich als Teilnehmer dieser Reise an (die Rolle kommt über die Einladung des Besitzers).",
    fr: "Le journal est lisible par tous ; pour écrire, connecte-toi comme participant de ce voyage (le rôle vient de l’invitation du propriétaire).",
    es: "El diario es legible por todos; para escribir, inicia sesión como participante de este viaje (el rol llega con la invitación del propietario).",
  },
  editedNote: {
    sl: "urejeno",
    en: "edited",
    it: "modificato",
    de: "bearbeitet",
    fr: "modifié",
    es: "editado",
  },
  refresh: {
    sl: "Osveži",
    en: "Refresh",
    it: "Aggiorna",
    de: "Aktualisieren",
    fr: "Actualiser",
    es: "Actualizar",
  },
} as const;

/** Barva avatarja iz imena (stabilna za isto ime — kot klepet). */
function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Začetnica imena (varno za Unicode). */
function nameInitial(name: string): string {
  const first = Array.from(name.trim())[0] ?? "?";
  return first.toUpperCase();
}

export interface TripJournalItem {
  id: string;
  authorId: string | null;
  authorName: string;
  mine: boolean;
  dayIndex: number | null;
  placeName: string | null;
  rating: number | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface TripJournalProps {
  shareId: string;
  /** ISO datum ustvarjanja potovanja (spodnja meja za relativen čas). */
  createdAt: string;
  /** Zapisovanje — VIEWER+ (sodelujoči); strežnik preveri vlogo. */
  canPost: boolean;
  /** Število dni načrta (za izbirnik dneva); 0 = brez izbirnika. */
  planDays: number;
  /** Prikazno ime prijavljenega uporabnika (odvod seje). */
  myName: string | null;
}

export function TripJournal({ shareId, createdAt, canPost, planDays, myName }: TripJournalProps) {
  const { toast } = useToast();
  const l = useLocale();

  const [entries, setEntries] = useState<TripJournalItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // obrazec (nov vnos ALI urejanje obstoječega)
  const [text, setText] = useState("");
  const [dayIdx, setDayIdx] = useState("");
  const [place, setPlace] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // relativni čas šele po mountu (SSR/klient ura se razlikujeta)
  const [mounted, setMounted] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/journal`,
        { cache: "no-store" }
      );
      if (res.status === 404) {
        setEntries([]);
        return;
      }
      if (!res.ok) {
        setLoadError(`Napaka ${res.status}`);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        entries?: TripJournalItem[];
      } | null;
      if (Array.isArray(data?.entries)) {
        setEntries(data.entries);
        setLoadError(null);
      }
    } catch {
      // off-line — ohranimo trenutno stanje
    }
  }, [shareId]);

  useEffect(() => {
    setMounted(true);
    void load();
  }, [load]);

  const resetForm = useCallback(() => {
    setText("");
    setDayIdx("");
    setPlace("");
    setRating(null);
    setEditingId(null);
    setConfirmingId(null);
  }, []);

  const fillFormFromEntry = useCallback((entry: TripJournalItem) => {
    setText(entry.text);
    setDayIdx(entry.dayIndex === null ? "" : String(entry.dayIndex));
    setPlace(entry.placeName ?? "");
    setRating(entry.rating);
    setEditingId(entry.id);
    setConfirmingId(null);
    // formular je lahko nad seznamom — ponudi ga v pogled
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting || !shareId) return;

      const payload: Record<string, unknown> = {
        text: text.trim(),
        placeName: place.trim() === "" ? null : place.trim(),
        rating,
        dayIndex: dayIdx === "" ? null : Number(dayIdx),
      };

      setSubmitting(true);
      try {
        const res = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/journal`,
          {
            method: editingId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
          }
        );
        const data = (await res.json().catch(() => null)) as
          | { success?: unknown; entry?: TripJournalItem; error?: unknown }
          | null;

        if (!res.ok || data?.success !== true || !data?.entry) {
          throw new Error(
            typeof data?.error === "string" ? data.error : `HTTP ${res.status}`
          );
        }

        const saved = data.entry;
        if (editingId) {
          setEntries((prev) =>
            (prev ?? []).map((x) => (x.id === saved.id ? saved : x))
          );
          toast({ title: pick(l, DICT.updatedToast) });
        } else {
          setEntries((prev) => [saved, ...(prev ?? [])]);
          toast({ title: pick(l, DICT.publishedToast) });
        }
        resetForm();
      } catch (err) {
        toast({
          title: pick(l, DICT.errorToast),
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, shareId, text, place, rating, dayIdx, editingId, toast, l, resetForm]
  );

  const removeEntry = useCallback(
    async (id: string) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/journal`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }
        );
        const data = (await res.json().catch(() => null)) as
          | { success?: unknown; error?: unknown }
          | null;
        if (!res.ok || data?.success !== true) {
          throw new Error(
            typeof data?.error === "string" ? data.error : `HTTP ${res.status}`
          );
        }
        setEntries((prev) => (prev ?? []).filter((x) => x.id !== id));
        if (editingId === id) resetForm();
        toast({ title: pick(l, DICT.deletedToast) });
      } catch (err) {
        toast({
          title: pick(l, DICT.errorToast),
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
        setConfirmingId(null);
      }
    },
    [submitting, shareId, editingId, toast, l, resetForm]
  );

  const countLabel = entriesLabel(entries?.length ?? 0);

  return (
    <section aria-label="Potni dnevnik">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {/* Naslov + števec */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
              {pick(l, DICT.title)}
            </h2>
            <div className="flex items-center gap-2 print:hidden">
              <span className="text-sm text-muted-foreground">{countLabel}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void load()}
                aria-label={pick(l, DICT.refresh)}
                title={pick(l, DICT.refresh)}
              >
                <Loader2 className="size-3.5" aria-hidden="true" />
                {pick(l, DICT.refresh)}
              </Button>
            </div>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            {pick(l, DICT.subtitle)}
          </p>

          {/* Obrazec (novo urejanje/vnos) — tiskljiv NIMA smisla → print:hidden */}
          {canPost ? (
            <form
              ref={formRef}
              onSubmit={(e) => void submit(e)}
              className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-4 print:hidden"
            >
              <h3 className="text-sm font-semibold">
                {editingId ? pick(l, DICT.editTitle) : pick(l, DICT.formTitle)}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {planDays > 0 ? (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {pick(l, DICT.labelDay)}
                    </span>
                    <select
                      value={dayIdx}
                      onChange={(e) => setDayIdx(e.target.value)}
                      disabled={submitting}
                      aria-label={pick(l, DICT.labelDay)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{pick(l, DICT.dayGeneral)}</option>
                      {Array.from({ length: planDays }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          {pick(l, DICT.dayN)(i + 1)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {pick(l, DICT.labelPlace)}
                  </span>
                  <Input
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder={pick(l, DICT.placePlaceholder)}
                    maxLength={80}
                    disabled={submitting}
                    aria-label={pick(l, DICT.labelPlace)}
                    className="h-10"
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {pick(l, DICT.labelRating)}
                </span>
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-label={pick(l, DICT.labelRating)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-9 p-0"
                      onClick={() => setRating((cur) => (cur === n ? null : n))}
                      disabled={submitting}
                      aria-label={pick(l, DICT.ratingN)(n)}
                      aria-pressed={rating !== null && rating >= n}
                      title={pick(l, DICT.ratingN)(n)}
                    >
                      <Star
                        className={cn(
                          "size-5",
                          rating !== null && rating >= n
                            ? "fill-amber-500 text-amber-500"
                            : "text-muted-foreground/40"
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  ))}
                  {rating !== null ? (
                    <span className="ml-1 text-xs text-muted-foreground">{rating}/5</span>
                  ) : null}
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {pick(l, DICT.labelMemory)}
                </span>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={pick(l, DICT.memoryPlaceholder)}
                  required
                  minLength={2}
                  maxLength={JOURNAL_TEXT_MAX}
                  rows={4}
                  aria-label={pick(l, DICT.labelMemory)}
                  className="min-h-[104px] resize-y"
                  disabled={submitting}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {pick(l, DICT.writeAs)}{" "}
                <strong className="font-semibold text-foreground">{myName ?? "sodelujoči"}</strong>{" "}
                · {text.length}/{JOURNAL_TEXT_MAX}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {editingId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    disabled={submitting}
                    className="h-11"
                  >
                    {pick(l, DICT.cancel)}
                  </Button>
                ) : null}
                <Button type="submit" disabled={submitting} className="h-11 min-w-44 gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      {pick(l, DICT.saving)}
                    </>
                  ) : editingId ? (
                    pick(l, DICT.saveChanges)
                  ) : (
                    <>
                      <Plus className="size-4" aria-hidden="true" />
                      {pick(l, DICT.publish)}
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <p className="mb-4 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-sm text-muted-foreground print:hidden">
              {pick(l, DICT.loginHint)}
            </p>
          )}

          {/* Seznam vpisov — NAMENO TISKLJIV (izvirnik: natisnjena stran =
              "photobook"; gumbi urejanja so print:hidden) */}
          <div className="mt-4">
            {loadError ? (
              <p className="text-sm text-destructive" role="alert">
                {loadError}
              </p>
            ) : entries === null ? (
              <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                {pick(l, DICT.loading)}
              </p>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <BookOpen className="size-8 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{pick(l, DICT.empty)}</p>
                <p className="max-w-md text-xs text-muted-foreground/70">
                  {pick(l, DICT.emptyHint)}
                </p>
              </div>
            ) : (
              <ul className="space-y-4" aria-live="polite" aria-atomic="false">
                {entries.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 select-none items-center justify-center rounded-full text-sm font-bold text-white",
                          avatarColor(m.authorName)
                        )}
                        aria-hidden="true"
                      >
                        {nameInitial(m.authorName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-medium">{m.authorName}</span>
                          <time
                            dateTime={m.createdAt}
                            className="text-xs text-muted-foreground"
                          >
                            {mounted ? slTimeAgo(m.createdAt, createdAt) : "…"}
                          </time>
                          {m.updatedAt !== m.createdAt ? (
                            <span className="text-[10px] italic text-muted-foreground/70">
                              ({pick(l, DICT.editedNote)})
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {m.dayIndex !== null ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5">
                              <CalendarDays className="size-3" aria-hidden="true" />
                              {pick(l, DICT.dayN)(m.dayIndex)}
                            </span>
                          ) : null}
                          {m.placeName ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5">
                              <MapPin className="size-3" aria-hidden="true" />
                              {m.placeName}
                            </span>
                          ) : null}
                          {m.rating !== null ? (
                            <span
                              className="inline-flex items-center gap-0.5"
                              aria-label={`${m.rating}/5`}
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={cn(
                                    "size-3.5",
                                    n <= (m.rating ?? 0)
                                      ? "fill-amber-500 text-amber-500"
                                      : "text-muted-foreground/30"
                                  )}
                                  aria-hidden="true"
                                />
                              ))}
                            </span>
                          ) : null}
                          {m.mine ? (
                            <span className="flex gap-1 print:hidden">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => fillFormFromEntry(m)}
                                disabled={submitting}
                                aria-label={`${pick(l, DICT.edit)} — ${m.authorName}`}
                              >
                                <PenLine className="size-3" aria-hidden="true" />
                                {pick(l, DICT.edit)}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-7 gap-1 px-2 text-xs",
                                  confirmingId === m.id
                                    ? "text-destructive"
                                    : "text-muted-foreground hover:text-destructive"
                                )}
                                onClick={() =>
                                  confirmingId === m.id
                                    ? void removeEntry(m.id)
                                    : setConfirmingId(m.id)
                                }
                                disabled={submitting}
                                aria-label={`${pick(l, DICT.remove)} — ${m.authorName}`}
                              >
                                <Trash2 className="size-3" aria-hidden="true" />
                                {confirmingId === m.id
                                  ? pick(l, DICT.confirmDelete)
                                  : pick(l, DICT.remove)}
                              </Button>
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 break-words whitespace-pre-line text-sm text-foreground">
                          {m.text}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default TripJournal;
