/**
 * LISTING-MODERATION — statusni stroj B2B tržnice (P0-H, issue #1 §22).
 *
 * Življenjski cikel: draft → pending → published (+ rejected).
 *  - partner USTVARI osnutek (draft) in ga PREDLAGA (pending);
 *  - SAMO skrbnik (DSA_ADMIN_EMAILS — isAdminSession) objavljuje
 *    (pending → published) ali zavrne (pending → rejected z razlogom);
 *  - SPREMEMBA VSEBINE sproži PONOVNO MODERACIJO (§22):
 *    urejanje objavljenega/v predaji vrne listing v "pending",
 *    urejanje osnutka/zavrnjenega pa v "draft";
 *  - partner lahko umakne (pending → draft) ali vzame s police
 *    (published → draft); nikoli ne objavi samega sebe.
 *
 * Čiste funkcije (0 DB) — obnašanje je testno zaklenjeno v
 * tests/listing-moderation.test.ts.
 */

export const LISTING_STATUSES = ["draft", "pending", "published", "rejected"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export function isListingStatus(value: unknown): value is ListingStatus {
  return typeof value === "string" && (LISTING_STATUSES as readonly string[]).includes(value);
}

/** Dovoljeni prehodi (iz → množica v). */
export const LISTING_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> =
  Object.freeze({
    draft: ["pending"],
    pending: ["draft", "published", "rejected"],
    published: ["draft", "pending"],
    rejected: ["draft"],
  });

/** Kdo lahko izvede prehod ("partner" = lastnik vnosa, "admin" = skrbnik).
 *  Dovoljeni prehodi samo — ostali ključi ne obstajajo (undefined = prepoved). */
export const LISTING_TRANSITION_ACTORS: Readonly<
  Partial<Record<`${ListingStatus}->${ListingStatus}`, readonly ("partner" | "admin")[]>>
> = {
  "draft->pending": ["partner"],
  "pending->draft": ["partner", "admin"],
  "pending->published": ["admin"],
  "pending->rejected": ["admin"],
  "published->draft": ["partner", "admin"],
  "published->pending": ["partner", "admin"],
  "rejected->draft": ["partner", "admin"],
};

export type ListingActor = "partner" | "admin";

/** Ali je prehod v načelu dovoljen (ne glede na akterja). */
export function canTransitionListing(from: ListingStatus, to: ListingStatus): boolean {
  return LISTING_TRANSITIONS[from].includes(to);
}

/** Ali sme ta akter izvesti prehod (partner NIKOLI ne objavi samega sebe). */
export function canActorTransitionListing(
  from: ListingStatus,
  to: ListingStatus,
  actor: ListingActor
): boolean {
  const key = `${from}->${to}` as const;
  const actors = LISTING_TRANSITION_ACTORS[key];
  return Boolean(actors && actors.includes(actor));
}

/**
 * Status po spremembi VSEBINE (§22 »sprememba vsebine sproži ponovno
 * moderacijo«): objavljeno/predano → nazaj v predajo (pending),
 * zavrnjeno → osnutek (partner predeluje), osnutek ostane osnutek.
 */
export function statusAfterContentEdit(current: ListingStatus): ListingStatus {
  if (current === "published" || current === "pending") return "pending";
  return "draft";
}

/** Ali listingVIDEN v javni tržnici (samo objavljeni z aktivno zalogo). */
export function isListingPubliclyVisible(status: ListingStatus, active: boolean): boolean {
  return status === "published" && active;
}

/** AuditLog dejanje za prehod (kanonska imena). */
export function transitionAuditAction(from: ListingStatus, to: ListingStatus): string {
  if (to === "published") return "listing.published";
  if (to === "rejected") return "listing.rejected";
  if (to === "pending" && from === "draft") return "listing.submitted";
  if (to === "pending" && from === "published") return "listing.remoderation";
  if (to === "draft" && from === "pending") return "listing.withdrawn";
  if (to === "draft" && from === "published") return "listing.unpublished";
  if (to === "draft" && from === "rejected") return "listing.revised";
  return "listing.transition";
}

// ── Oznake za UI (dvojezično) ──────────────────────────────────────────────

export const LISTING_STATUS_LABELS: Readonly<
  Record<ListingStatus, { sl: string; en: string; it: string; de: string; fr: string; es: string }>
> = Object.freeze({
  draft: { sl: "Osnutek", en: "Draft", it: "Bozza", de: "Entwurf", fr: "Brouillon", es: "Borrador" },
  pending: { sl: "V predaji", en: "Pending review", it: "In revisione", de: "In Prüfung", fr: "En cours de révision", es: "En revisión" },
  published: { sl: "Objavljeno", en: "Published", it: "Pubblicato", de: "Veröffentlicht", fr: "Publié", es: "Publicado" },
  rejected: { sl: "Zavrnjeno", en: "Rejected", it: "Rifiutato", de: "Abgelehnt", fr: "Rejeté", es: "Rechazado" },
});

// ── Validacija vsebine vnosa ───────────────────────────────────────────────

export interface ListingContentInput {
  name?: unknown;
  description?: unknown;
  priceCents?: unknown;
  stock?: unknown;
  kind?: unknown;
}

export interface ListingContent {
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  kind: string;
}

export type ListingContentResult =
  | { ok: true; value: ListingContent }
  | { ok: false; error: string };

export const LISTING_KINDS = ["experience", "ticket", "product"] as const;

/**
 * Validacija vsebine partnerjevega vnosa:
 * ime 2–120, opis 20–2000, cena 1 € – 10.000 € (v centih), zaloga 0–10.000,
 * vrsta experience|ticket|product.
 */
export function validateListingContent(input: ListingContentInput): ListingContentResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: "Ime mora imeti med 2 in 120 znakov." };
  }
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 20 || description.length > 2000) {
    return { ok: false, error: "Opis mora imeti med 20 in 2000 znakov." };
  }
  const priceCents =
    typeof input.priceCents === "number"
      ? Math.round(input.priceCents)
      : Number(input.priceCents);
  if (!Number.isFinite(priceCents) || priceCents < 100 || priceCents > 1_000_000) {
    return { ok: false, error: "Cena mora biti med 1 € in 10.000 €." };
  }
  const stock = typeof input.stock === "number" ? Math.round(input.stock) : Number(input.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 10_000) {
    return { ok: false, error: "Zaloga mora biti celo število med 0 in 10.000." };
  }
  const kind = typeof input.kind === "string" ? input.kind : "";
  if (!(LISTING_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Neznana vrsta izdelka." };
  }
  return { ok: true, value: { name, description, priceCents, stock, kind } };
}
