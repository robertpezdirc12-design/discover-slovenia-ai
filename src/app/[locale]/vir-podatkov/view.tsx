"use client";

import {
  Database,
  ExternalLink,
  Landmark,
  Loader2,
  RotateCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pick } from "@/lib/i18n-pick";
import { intlDateLocale } from "@/lib/intl-locale";
import { DESTINATIONS } from "@/lib/slovenia-data";

/** Odziv /api/sto/search (P0-C — uradna STO vsebina, llms.txt ingest). */
interface StoSearchResponseDTO {
  query: string;
  language: string;
  total: number;
  results: {
    section: string;
    title: string;
    url: string;
    description: string;
  }[];
  attribution: string;
  fetchedAt: string;
}

/** Iskrena stanja iskanja — 503 (ni ingesta) in napaka omrežja sta ločeni. */
type StoSearchStatus =
  | "idle"
  | "loading"
  | "ok"
  | "empty"
  | "not-ingested"
  | "error";

/** Iskren izpis datuma ingesta (iz fetchedAt odziva, nikoli izmišljen). */
function formatIngestDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlDateLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * KARTICA „IŠČI PO URADNI VSEBINI STO" (P0-C UI priklop) — iskalnik po
 * ingesciranem uradnem vodniku slovenia.info (llms.txt). Povezave vodijo
 * na URADNE strani STO (ni affiliate — brez rel="sponsored"). Iskrena
 * stanja: HTTP 503 = pasica „še ni ingescirana" (ni napaka uporabnika);
 * prazen zadetek = prijazen predlog, ne napaka; napaka omrežja = retry.
 */
function StoSearchCard({
  locale,
  labels,
}: {
  locale: string;
  labels: {
    heading: string;
    intro: string;
    inputLabel: string;
    inputPlaceholder: string;
    searchAction: string;
    searchBusy: string;
    resultsCount: (n: number) => string;
    emptyResult: (q: string) => string;
    openOfficial: string;
    notIngestedTitle: string;
    notIngestedBody: string;
    errorText: string;
    retry: string;
  };
}) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<StoSearchStatus>("idle");
  const [data, setData] = React.useState<StoSearchResponseDTO | null>(null);
  const [lastQuery, setLastQuery] = React.useState("");
  const abortRef = React.useRef<AbortController | null>(null);

  // Odmontiranje prekliče morebitni in-flight zahtevek (brez obeženih iskanj).
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const trimmed = q.trim();
  const busy = status === "loading";

  const runSearch = async (query: string) => {
    if (query.length === 0 || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLastQuery(query);
    setStatus("loading");
    try {
      const res = await fetch(
        `/api/sto/search?q=${encodeURIComponent(query)}&lang=${
          locale === "sl" ? "sl" : "en"
        }`,
        { signal: controller.signal }
      );
      if (res.status === 503) {
        setStatus("not-ingested"); // vsebina še ni ingescirana — pasica
        return;
      }
      if (!res.ok) throw new Error("sto-search");
      const json = (await res.json()) as StoSearchResponseDTO;
      setData(json);
      setStatus(json.total > 0 ? "ok" : "empty");
    } catch {
      if (controller.signal.aborted) return; // nadomeščeno z novim iskanjem
      setStatus("error");
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="size-4.5 text-primary" aria-hidden="true" />
          {labels.heading}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {labels.intro}
        </p>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(trimmed);
          }}
        >
          <div className="relative flex-1">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.inputPlaceholder}
              aria-label={labels.inputLabel}
              className="h-11 pl-9"
            />
          </div>
          <Button
            type="submit"
            disabled={trimmed.length === 0 || busy}
            aria-busy={busy}
            className="h-11 sm:w-32"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            {labels.searchAction}
            {busy && <span className="sr-only">{labels.searchBusy}</span>}
          </Button>
        </form>

        {/* 503 — vsebina še ni ingescirana (amber: iskrenost, ni krivda). */}
        {status === "not-ingested" && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-amber-500/50 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30"
          >
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {labels.notIngestedTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {labels.notIngestedBody}
            </p>
          </div>
        )}

        {/* Napaka omrežja — jasen retry gumb. */}
        {status === "error" && (
          <div
            role="alert"
            className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm font-medium text-destructive">{labels.errorText}</p>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 px-4"
              onClick={() => void runSearch(lastQuery)}
            >
              <RotateCw className="size-4" aria-hidden="true" />
              {labels.retry}
            </Button>
          </div>
        )}

        {/* Prazno — prijazen predlog (NI napaka). */}
        {status === "empty" && (
          <div className="mt-4 rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm font-semibold">{labels.emptyResult(lastQuery)}</p>
          </div>
        )}

        {/* Zadetki + atribucija vira (obvezna ob uporabi uradne vsebine).
            Med ponovnim iskanjem zadetki ostanejo vidni (spinner v gumbu
            nosi busy stanje) — brez utripanja seznama. */}
        {(status === "ok" || (status === "loading" && data !== null)) &&
          data !== null && (
            <div className="mt-4" aria-live="polite">
              <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {labels.resultsCount(data.total)}
              </p>
              <ul className="scrollbar-slim mt-2 max-h-96 list-none space-y-2 overflow-y-auto pr-1">
                {data.results.map((r, i) => (
                  <li key={`${i}-${r.url}`} className="rounded-lg border bg-card p-3.5">
                    <span className="inline-flex max-w-full items-center truncate rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {r.section}
                    </span>
                    <h3 className="mt-1.5 text-sm leading-snug font-bold">{r.title}</h3>
                    {r.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                    {/* Uradne strani STO — NI affiliate (brez rel=sponsored). */}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-green mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      {labels.openOfficial}
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {data.attribution} · {formatIngestDate(data.fetchedAt, locale)}
              </p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

/**
 * /vir-podatkov — viri, svežina in provenanca (1:1 po produkciji).
 * Statistika provenance se izračuna IZ DEJANSKEGA nabora (nikoli izmišljena).
 */
export default function DataSourcePage() {
  const l = useLocale();

  const prov = React.useMemo(() => {
    let official = 0;
    let editorial = 0;
    let latest = "";
    for (const d of DESTINATIONS) {
      if (d.provenance.kind === "official") official++;
      else editorial++;
      if (d.provenance.verifiedAt > latest) latest = d.provenance.verifiedAt;
    }
    return { official, editorial, latest, total: DESTINATIONS.length };
  }, []);

  const L = {
    title: { sl: "Vir podatkov", en: "Data source", it: "Fonte dei dati", de: "Datenquelle", fr: "Source des données", es: "Fuente de datos" },
    lead: {
      sl: "Platforma Discover Slovenia AI uporablja naslednje vire podatkov za zagotavljanje kakovostnih informacij o turističnih destinacijah.",
      en: "Discover Slovenia AI uses the following data sources to provide quality information about tourist destinations.",
      it: "Discover Slovenia AI utilizza le seguenti fonti di dati per fornire informazioni di qualità sulle destinazioni turistiche.",
      de: "Discover Slovenia AI verwendet die folgenden Datenquellen, um hochwertige Informationen über Reiseziele bereitzustellen.",
      fr: "Discover Slovenia AI utilise les sources de données suivantes pour fournir des informations de qualité sur les destinations touristiques.",
      es: "Discover Slovenia AI utiliza las siguientes fuentes de datos para ofrecer información de calidad sobre destinos turísticos.",
    },
    sourcesHeading: { sl: "Viri podatkov", en: "Data sources", it: "Fonti dei dati", de: "Datenquellen", fr: "Sources des données", es: "Fuentes de datos" },
    provHeading: {
      sl: "Provenance destinacijske vsebine (38 destinacij)",
      en: "Destination content provenance (38 destinations)",
      it: "Provenienza dei contenuti delle destinazioni (38 destinazioni)",
      de: "Provenienz der Destinationsinhalte (38 Destinationen)",
      fr: "Provenance des contenus des destinations (38 destinations)",
      es: "Procedencia del contenido de los destinos (38 destinos)",
    },
    provIntro: {
      sl: "Vsaka destinacija v uredniškem vodniku nosi zapis o viru in datumu: ali ima zunanjega preverjenega vira (uradna stran destinacije ali kanonična STO stran), ali je uredniško kurirana vsebina Discover Slovenia (pošteno označeno, brez izmišljenega vira). Enak zapis je dostopen prek API-ja (polje provenance).",
      en: "Every destination in the editorial guide carries a record of its source and date: either an external verified source (an official destination page or the canonical STO page) or editorially curated Discover Slovenia content (honestly labelled, with no invented source). The same record is available via the API (the provenance field).",
      it: "Ogni destinazione nella guida editoriale porta un record di fonte e data: o una fonte esterna verificata (la pagina ufficiale della destinazione o la pagina canonica STO), oppure contenuti Discover Slovenia curati editorialmente (etichettati onestamente, senza fonti inventate). Lo stesso record è disponibile tramite l'API (il campo provenance).",
      de: "Jede Destination im redaktionellen Guide trägt einen Eintrag zu Quelle und Datum: entweder eine externe geprüfte Quelle (eine offizielle Destinationsseite oder die kanonische STO-Seite) oder redaktionell kuratierte Discover-Slovenia-Inhalte (ehrlich gekennzeichnet, ohne erfundene Quelle). Derselbe Eintrag ist über die API verfügbar (das Feld provenance).",
      fr: "Chaque destination du guide éditorial porte un enregistrement de sa source et de sa date : soit une source externe vérifiée (une page officielle de la destination ou la page canonique de l'STO), soit un contenu Discover Slovenia curaté par la rédaction (étiqueté honnêtement, sans source inventée). Le même enregistrement est disponible via l'API (le champ provenance).",
      es: "Cada destino de la guía editorial lleva un registro de fuente y fecha: o una fuente externa verificada (la página oficial del destino o la página canónica de la STO), o contenido Discover Slovenia curado editorialmente (etiquetado con honestidad, sin fuente inventada). El mismo registro está disponible vía API (el campo provenance).",
    },
    freshnessHeading: { sl: "Svežina podatkov", en: "Data freshness", it: "Freschezza dei dati", de: "Datenfrische", fr: "Fraîcheur des données", es: "Frescura de los datos" },
    freshnessBody: {
      sl: "Za vsak glavni podatkovni sloj objavljamo svežino in vrsto vira. Posnetek množice krajev ni živo stanje: število točk iz statičnega posnetka NE pomeni, da je enako število krajev trenutno odprtih — posnetek je stanje ob dnevu zajema.",
      en: "For every major data layer we publish freshness and source type. A snapshot of a place set is not a live state: the number of points from a static snapshot does NOT mean the same number of places is currently open — a snapshot is the state as of its capture date.",
      it: "Per ogni livello dati principale pubblichiamo freschezza e tipo di fonte. Un'istantanea di un insieme di luoghi non è uno stato live: il numero di punti di un'istantanea statica NON significa che altrettanti luoghi siano attualmente aperti — l'istantanea è lo stato alla data di acquisizione.",
      de: "Für jede große Datenschicht veröffentlichen wir Frische und Quellentyp. Ein Snapshot einer Ortsmenge ist kein Live-Zustand: Die Punktzahl aus einem statischen Snapshot bedeutet NICHT, dass ebenso viele Orte aktuell offen sind — ein Snapshot ist der Stand zum Erfassungsdatum.",
      fr: "Pour chaque grande couche de données, nous publions la fraîcheur et le type de source. Un instantané d'un ensemble de lieux n'est pas un état en direct : le nombre de points d'un instantané statique ne signifie PAS que le même nombre de lieux est actuellement ouvert — un instantané est l'état à sa date de capture.",
      es: "Para cada capa principal de datos publicamos frescura y tipo de fuente. Una instantánea de un conjunto de lugares no es un estado en vivo: el número de puntos de una instantánea estática NO significa que el mismo número de lugares esté abierto ahora — una instantánea es el estado a su fecha de captura.",
    },
    languageHeading: { sl: "Jezik zapisa", en: "Language of record", it: "Lingua del record", de: "Sprache des Eintrags", fr: "Langue de l'enregistrement", es: "Idioma del registro" },
    languageBody: {
      sl: "Slovenščina je vir resnice (slovenia-data.ts); angleška različica je prekrivni prevod po istem ID-ju. Ostali jeziki niso podprti v vsebinskem naboru.",
      en: "Slovenian is the source of truth (slovenia-data.ts); the English version is an overlay translation under the same ID. Other languages are not supported in the content dataset.",
      it: "Lo sloveno è la fonte di verità (slovenia-data.ts); la versione inglese è una traduzione a sovrapposizione con lo stesso ID. Le altre lingue non sono supportate nel dataset dei contenuti.",
      de: "Slowenisch ist die Quelle der Wahrheit (slovenia-data.ts); die englische Version ist eine überlagerte Übersetzung unter derselben ID. Weitere Sprachen werden im Inhaltsdatensatz nicht unterstützt.",
      fr: "Le slovène est la source de vérité (slovenia-data.ts) ; la version anglaise est une traduction en surimpression sous le même ID. Les autres langues ne sont pas prises en charge dans le jeu de données de contenu.",
      es: "El esloveno es la fuente de verdad (slovenia-data.ts); la versión inglesa es una traducción superpuesta con el mismo ID. Los demás idiomas no están soportados en el conjunto de datos de contenido.",
    },
    statTotal: { sl: "destinacij skupaj", en: "destinations total", it: "destinazioni totali", de: "Destinationen gesamt", fr: "destinations au total", es: "destinos en total" },
    statOfficial: { sl: "z uradnim virom", en: "with official source", it: "con fonte ufficiale", de: "mit offizieller Quelle", fr: "avec source officielle", es: "con fuente oficial" },
    statEditorial: { sl: "uredniško kuriranih", en: "editorially curated", it: "curate editorialmente", de: "redaktionell kuratiert", fr: "curatés par la rédaction", es: "curadas editorialmente" },
    statUpdated: { sl: "posodobljeno", en: "updated", it: "aggiornato", de: "aktualisiert", fr: "mis à jour", es: "actualizado" },
    honestyHeading: { sl: "Iskrena odločitev", en: "An honest decision", it: "Una decisione onesta", de: "Eine ehrliche Entscheidung", fr: "Une décision honnête", es: "Una decisión honesta" },
    honestyBody: {
      sl: "Iskanje javnega portala s strukturiranimi, strojno berljivimi državnimi turističnimi podatki ni obrodilo s preverljivim rezultatom. Ne kopiramo in si ne izmišljujemo vira, ki ga ni mogoče preveriti — namesto tega uporabljamo preverljive javne vire in lastno uredniško kuracijo, ki je vedno tako označena.",
      en: "Our search for a public portal with structured, machine-readable national tourism data did not yield a verifiable result. We do not copy or invent a source that cannot be verified — instead we use verifiable public sources and our own editorial curation, always labelled as such.",
      it: "La ricerca di un portale pubblico con dati turistici nazionali strutturati e leggibili dalle macchine non ha prodotto un risultato verificabile. Non copiamo né inventiamo una fonte non verificabile — usiamo invece fonti pubbliche verificabili e la nostra curatela editoriale, sempre etichettata come tale.",
      de: "Unsere Suche nach einem öffentlichen Portal mit strukturierten, maschinenlesbaren nationalen Tourismusdaten hat kein überprüfbares Ergebnis gebracht. Wir kopieren nicht und erfinden keine Quelle, die sich nicht überprüfen lässt — stattdessen nutzen wir überprüfbare öffentliche Quellen und unsere eigene redaktionelle Kuratierung, immer so gekennzeichnet.",
      fr: "Notre recherche d'un portail public de données touristiques nationales structurées et lisibles par machine n'a pas donné de résultat vérifiable. Nous ne copions pas et n'inventons pas une source invérifiable — nous utilisons plutôt des sources publiques vérifiables et notre propre curatelle éditoriale, toujours étiquetée comme telle.",
      es: "Nuestra búsqueda de un portal público con datos turísticos nacionales estructurados y legibles por máquina no dio un resultado verificable. No copiamos ni inventamos una fuente no verificable — usamos en su lugar fuentes públicas verificables y nuestra propia curaduría editorial, siempre etiquetada como tal.",
    },
    seeAlso: { sl: "Poglej tudi", en: "See also", it: "Vedi anche", de: "Siehe auch", fr: "Voir aussi", es: "Ver también" },
    apiLabel: { sl: "API destinacij (JSON)", en: "Destinations API (JSON)", it: "API delle destinazioni (JSON)", de: "Destinations-API (JSON)", fr: "API des destinations (JSON)", es: "API de destinos (JSON)" },
    trustLabel: { sl: "Zaupanje in varnost", en: "Trust & safety", it: "Fiducia e sicurezza", de: "Vertrauen & Sicherheit", fr: "Confiance et sécurité", es: "Confianza y seguridad" },
    // ── P0-C: iskanje po uradni vsebini STO (slovenia.info llms.txt) ──
    stoHeading: {
      sl: "Išči po uradni vsebini STO (slovenia.info)",
      en: "Search official STO content (slovenia.info)",
      it: "Cerca nei contenuti ufficiali STO (slovenia.info)",
      de: "Offizielle STO-Inhalte durchsuchen (slovenia.info)",
      fr: "Rechercher dans le contenu officiel de l'STO (slovenia.info)",
      es: "Buscar en el contenido oficial de la STO (slovenia.info)",
    },
    stoIntro: {
      sl: "Ta iskalnik teče po URADNEM turističnem vodniku Slovenske turistične organizacije — viru llms.txt na slovenia.info, ki smo ga ingescirali v 7 jezikih (752 vnosov). Iskanje razume slovenske sklonske oblike: poizvedba „blede“ najde „Bled“, „poti“ pa „poteh“.",
      en: "This search runs on the OFFICIAL travel guide of the Slovenian Tourist Board — the llms.txt source at slovenia.info, ingested in 7 languages (752 entries). The search understands Slovenian inflected forms: the query “blede” finds “Bled”, and “poti” finds “poteh”.",
      it: "Questo motore funziona sulla guida ufficiale dell'ente turistico sloveno — la fonte llms.txt su slovenia.info, ingescata in 7 lingue (752 voci). La ricerca capisce le forme flesse slovene: la query «blede» trova «Bled», e «poti» trova «poteh».",
      de: "Diese Suche läuft auf dem offiziellen Reiseführer der Slowenischen Tourismusorganisation — der llms.txt-Quelle auf slovenia.info, die wir in 7 Sprachen ingeschtet haben (752 Einträge). Die Suche versteht slowenische Beugungsformen: Die Anfrage „blede“ findet „Bled“, und „poti“ findet „poteh“.",
      fr: "Cette recherche fonctionne sur le guide officiel de l'office de tourisme slovène — la source llms.txt sur slovenia.info, ingérée en 7 langues (752 entrées). La recherche comprend les formes fléchies slovènes : la requête « blede » trouve « Bled », et « poti » trouve « poteh ».",
      es: "Este buscador funciona sobre la guía oficial del organismo turístico esloveno — la fuente llms.txt en slovenia.info, ingestado en 7 idiomas (752 entradas). La búsqueda entiende las formas flexivas eslovenas: la consulta «blede» encuentra «Bled», y «poti» encuentra «poteh».",
    },
    stoInputLabel: {
      sl: "Iskalni niz po uradni vsebini STO",
      en: "Search query for official STO content",
      it: "Termine di ricerca per i contenuti ufficiali STO",
      de: "Suchanfrage für offizielle STO-Inhalte",
      fr: "Requête pour le contenu officiel de l'STO",
      es: "Consulta de búsqueda del contenido oficial de la STO",
    },
    stoInputPlaceholder: {
      sl: "Npr. Bled, jama, termalno zdravilišče …",
      en: "E.g. Bled, cave, thermal spa …",
      it: "Es. Bled, grotta, centro termale …",
      de: "Z. B. Bled, Höhle, Thermalbad …",
      fr: "Ex. Bled, grotte, spa thermal …",
      es: "P. ej. Bled, cueva, balneario termal …",
    },
    stoSearchAction: { sl: "Išči", en: "Search", it: "Cerca", de: "Suchen", fr: "Rechercher", es: "Buscar" },
    stoSearchBusy: {
      sl: "Iščem po uradni vsebini …",
      en: "Searching official content …",
      it: "Ricerca nei contenuti ufficiali …",
      de: "Offizielle Inhalte werden durchsucht …",
      fr: "Recherche dans le contenu officiel …",
      es: "Buscando en el contenido oficial …",
    },
    stoResultsCount: {
      sl: (n: number) =>
        n === 1 ? "1 zadetek" : n >= 2 && n <= 4 ? `${n} zadetki` : `${n} zadetkov`,
      en: (n: number) => (n === 1 ? "1 result" : `${n} results`),
      it: (n: number) => (n === 1 ? "1 risultato" : `${n} risultati`),
      de: (n: number) => (n === 1 ? "1 Ergebnis" : `${n} Ergebnisse`),
      fr: (n: number) => (n === 1 ? "1 résultat" : `${n} résultats`),
      es: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
    },
    stoEmptyResult: {
      sl: (q: string) =>
        `Ni zadetkov za „${q}“ — to ni napaka. Poskusi krajše geslo, npr. samo „bled“.`,
      en: (q: string) =>
        `No results for “${q}” — that is not an error. Try a shorter term, e.g. just “bled”.`,
      it: (q: string) =>
        `Nessun risultato per «${q}» — non è un errore. Prova un termine più corto, per esempio solo «bled».`,
      de: (q: string) =>
        `Keine Ergebnisse für „${q}“ — das ist kein Fehler. Versuche einen kürzeren Begriff, z. B. nur „bled“.`,
      fr: (q: string) =>
        `Aucun résultat pour « ${q} » — ce n'est pas une erreur. Essaie un terme plus court, par ex. juste « bled ».`,
      es: (q: string) =>
        `Sin resultados para «${q}» — no es un error. Prueba un término más corto, p. ej. solo «bled».`,
    },
    stoOpenOfficial: {
      sl: "Odpri na slovenia.info",
      en: "Open on slovenia.info",
      it: "Apri su slovenia.info",
      de: "Auf slovenia.info öffnen",
      fr: "Ouvrir sur slovenia.info",
      es: "Abrir en slovenia.info",
    },
    stoNotIngestedTitle: {
      sl: "STO vsebina še ni ingescirana",
      en: "STO content has not been ingested yet",
      it: "I contenuti STO non sono ancora stati ingescati",
      de: "STO-Inhalte wurden noch nicht ingeschtet",
      fr: "Le contenu de l'STO n'a pas encore été ingéré",
      es: "El contenido de la STO aún no ha sido ingestado",
    },
    stoNotIngestedBody: {
      sl: "Iskalnik čaka na ingest uradnega vodnika (llms.txt, slovenia.info) — poskusi znova kasneje.",
      en: "The search is waiting for the ingest of the official guide (llms.txt, slovenia.info) — try again later.",
      it: "Il motore attende l'ingestione della guida ufficiale (llms.txt, slovenia.info) — riprova più tardi.",
      de: "Die Suche wartet auf den Ingest des offiziellen Guides (llms.txt, slovenia.info) — versuche es später erneut.",
      fr: "La recherche attend l'ingestion du guide officiel (llms.txt, slovenia.info) — réessaie plus tard.",
      es: "El buscador espera la ingesta de la guía oficial (llms.txt, slovenia.info) — reinténtalo más tarde.",
    },
    stoErrorText: {
      sl: "Iskanje trenutno ni dosegljivo — preveri povezavo in poskusi znova.",
      en: "Search is currently unreachable — check your connection and try again.",
      it: "La ricerca non è al momento raggiungibile — controlla la connessione e riprova.",
      de: "Die Suche ist derzeit nicht erreichbar — prüfe deine Verbindung und versuche es erneut.",
      fr: "La recherche est momentanément injoignable — vérifie ta connexion et réessaie.",
      es: "La búsqueda no está disponible ahora mismo — comprueba tu conexión y reintenta.",
    },
    stoRetry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const sources = [
    {
      name: "OpenStreetMap",
      desc: pick(l, {
        sl: "POI podatki (točke interesa) — atrakcije, muzeji, restavracije, hoteli, razgledišča, naravne znamenitosti. Licenca: ODbL.",
        en: "POI data (points of interest) — sights, museums, restaurants, hotels, viewpoints, natural features. Licence: ODbL.",
        it: "Dati POI (punti di interesse) — attrazioni, musei, ristoranti, hotel, punti panoramici, fenomeni naturali. Licenza: ODbL.",
        de: "POI-Daten (Points of Interest) — Sehenswürdigkeiten, Museen, Restaurants, Hotels, Aussichtspunkte, Naturdenkmäler. Lizenz: ODbL.",
        fr: "Données POI (points d'intérêt) — sites, musées, restaurants, hôtels, points de vue, éléments naturels. Licence : ODbL.",
        es: "Datos de POI (puntos de interés) — atracciones, museos, restaurantes, hoteles, miradores, hitos naturales. Licencia: ODbL.",
      }),
      url: "https://www.openstreetmap.org/copyright",
    },
    {
      name: "I feel Slovenia (STO) — slovenia.info",
      desc: pick(l, {
        sl: "Uradna turistična vsebina Slovenske turistične organizacije, ki jo AI uporablja kot uzemljenje odgovorov s citati.",
        en: "Official content of the Slovenian Tourist Board, used by the AI as grounding for cited answers.",
        it: "Contenuti turistici ufficiali dell'ente turistico sloveno, usati dall'AI come base per risposte citate.",
        de: "Offizielle Tourismusinhalte der Slowenischen Tourismusorganisation, die die KI als Grounding für Antworten mit Quellenangaben nutzt.",
        fr: "Contenu touristique officiel de l'office de tourisme slovène, utilisé par l'IA comme ancrage pour des réponses citées.",
        es: "Contenido turístico oficial del organismo turístico esloveno, usado por la IA como base para respuestas citadas.",
      }),
      url: "https://www.slovenia.info",
    },
    {
      name: "Wikipedia / Wikidata",
      desc: pick(l, {
        sl: "Opisi destinacij in POI-jev. Licenca: CC BY-SA.",
        en: "Descriptions of destinations and POIs. Licence: CC BY-SA.",
        it: "Descrizioni di destinazioni e POI. Licenza: CC BY-SA.",
        de: "Beschreibungen von Destinationen und POIs. Lizenz: CC BY-SA.",
        fr: "Descriptions des destinations et des POI. Licence : CC BY-SA.",
        es: "Descripciones de destinos y POI. Licencia: CC BY-SA.",
      }),
      url: "https://www.wikidata.org",
    },
    {
      name: "Open-Meteo",
      desc: pick(l, {
        sl: "Vremenski podatki v realnem času. Brezplačni API brez ključa.",
        en: "Real-time weather data. A free, keyless API.",
        it: "Dati meteo in tempo reale. API gratuita senza chiave.",
        de: "Echtzeit-Wetterdaten. Eine kostenlose API ohne Schlüssel.",
        fr: "Données météo en temps réel. Une API gratuite sans clé.",
        es: "Datos meteorológicos en tiempo real. Una API gratuita sin clave.",
      }),
      url: "https://open-meteo.com",
    },
  ];

  const stats = [
    { value: String(prov.total), label: t("statTotal") },
    { value: String(prov.official), label: t("statOfficial") },
    { value: String(prov.editorial), label: t("statEditorial") },
    { value: prov.latest, label: t("statUpdated") },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("title")} lead={t("lead")} />

      {/* Provenanca — izračunana iz nabora */}
      <Card className="mt-8 border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4.5 text-primary" aria-hidden="true" />
            {t("provHeading")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("provIntro")}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border bg-background p-3 text-center">
                <dt className="order-2 text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-xl font-bold text-primary">{s.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Viri */}
      <h2 className="mt-10 flex items-center gap-2 text-xl font-bold tracking-tight">
        <Database className="size-5 text-primary" aria-hidden="true" />
        {t("sourcesHeading")}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {sources.map((s) => (
          <Card key={s.name}>
            <CardContent className="p-5">
              <p className="text-sm font-bold">{s.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {s.url.replace("https://", "")}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* P0-C — iskanje po uradni STO vsebini (llms.txt ingest, živi API) */}
      <StoSearchCard
        locale={l}
        labels={{
          heading: t("stoHeading"),
          intro: t("stoIntro"),
          inputLabel: t("stoInputLabel"),
          inputPlaceholder: t("stoInputPlaceholder"),
          searchAction: t("stoSearchAction"),
          searchBusy: t("stoSearchBusy"),
          resultsCount: t("stoResultsCount"),
          emptyResult: t("stoEmptyResult"),
          openOfficial: t("stoOpenOfficial"),
          notIngestedTitle: t("stoNotIngestedTitle"),
          notIngestedBody: t("stoNotIngestedBody"),
          errorText: t("stoErrorText"),
          retry: t("stoRetry"),
        }}
      />

      {/* Svežina + jezik + iskrenost */}
      <div className="mt-10 space-y-6">
        {[
          { heading: t("freshnessHeading"), body: t("freshnessBody") },
          { heading: t("languageHeading"), body: t("languageBody") },
          { heading: t("honestyHeading"), body: t("honestyBody") },
        ].map((sec) => (
          <section key={sec.heading}>
            <h2 className="text-lg font-bold tracking-tight">{sec.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {sec.body}
            </p>
          </section>
        ))}
      </div>

      <Card className="mt-8">
        <CardContent className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("seeAlso")}
          </p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <a href="/api/destinations" className="text-sm font-medium text-primary hover:underline">
                {t("apiLabel")}
              </a>
            </li>
            <li>
              <a href={l === "en" ? "/en/zaupanje-in-varnost" : "/zaupanje-in-varnost"} className="text-sm font-medium text-primary hover:underline">
                {t("trustLabel")}
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
