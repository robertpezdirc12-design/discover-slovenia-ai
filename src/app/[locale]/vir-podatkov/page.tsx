"use client";

import { Database, ExternalLink, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pick } from "@/lib/i18n-pick";
import { DESTINATIONS } from "@/lib/slovenia-data";

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
    title: { sl: "Vir podatkov", en: "Data source" },
    lead: {
      sl: "Platforma Discover Slovenia AI uporablja naslednje vire podatkov za zagotavljanje kakovostnih informacij o turističnih destinacijah.",
      en: "Discover Slovenia AI uses the following data sources to provide quality information about tourist destinations.",
    },
    sourcesHeading: { sl: "Viri podatkov", en: "Data sources" },
    provHeading: {
      sl: "Provenance destinacijske vsebine (38 destinacij)",
      en: "Destination content provenance (38 destinations)",
    },
    provIntro: {
      sl: "Vsaka destinacija v uredniškem vodniku nosi zapis o viru in datumu: ali ima zunanjega preverjenega vira (uradna stran destinacije ali kanonična STO stran), ali je uredniško kurirana vsebina Discover Slovenia (pošteno označeno, brez izmišljenega vira). Enak zapis je dostopen prek API-ja (polje provenance).",
      en: "Every destination in the editorial guide carries a record of its source and date: either an external verified source (an official destination page or the canonical STO page) or editorially curated Discover Slovenia content (honestly labelled, with no invented source). The same record is available via the API (the provenance field).",
    },
    freshnessHeading: { sl: "Svežina podatkov", en: "Data freshness" },
    freshnessBody: {
      sl: "Za vsak glavni podatkovni sloj objavljamo svežino in vrsto vira. Posnetek množice krajev ni živo stanje: število točk iz statičnega posnetka NE pomeni, da je enako število krajev trenutno odprtih — posnetek je stanje ob dnevu zajema.",
      en: "For every major data layer we publish freshness and source type. A snapshot of a place set is not a live state: the number of points from a static snapshot does NOT mean the same number of places is currently open — a snapshot is the state as of its capture date.",
    },
    languageHeading: { sl: "Jezik zapisa", en: "Language of record" },
    languageBody: {
      sl: "Slovenščina je vir resnice (slovenia-data.ts); angleška različica je prekrivni prevod po istem ID-ju. Ostali jeziki niso podprti v vsebinskem naboru.",
      en: "Slovenian is the source of truth (slovenia-data.ts); the English version is an overlay translation under the same ID. Other languages are not supported in the content dataset.",
    },
    statTotal: { sl: "destinacij skupaj", en: "destinations total" },
    statOfficial: { sl: "z uradnim virom", en: "with official source" },
    statEditorial: { sl: "uredniško kuriranih", en: "editorially curated" },
    statUpdated: { sl: "posodobljeno", en: "updated" },
    honestyHeading: { sl: "Iskrena odločitev", en: "An honest decision" },
    honestyBody: {
      sl: "Iskanje javnega portala s strukturiranimi, strojno berljivimi državnimi turističnimi podatki ni obrodilo s preverljivim rezultatom. Ne kopiramo in si ne izmišljujemo vira, ki ga ni mogoče preveriti — namesto tega uporabljamo preverljive javne vire in lastno uredniško kuracijo, ki je vedno tako označena.",
      en: "Our search for a public portal with structured, machine-readable national tourism data did not yield a verifiable result. We do not copy or invent a source that cannot be verified — instead we use verifiable public sources and our own editorial curation, always labelled as such.",
    },
    seeAlso: { sl: "Poglej tudi", en: "See also" },
    apiLabel: { sl: "API destinacij (JSON)", en: "Destinations API (JSON)" },
    trustLabel: { sl: "Zaupanje in varnost", en: "Trust & safety" },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const sources = [
    {
      name: "OpenStreetMap",
      desc: pick(l, {
        sl: "POI podatki (točke interesa) — atrakcije, muzeji, restavracije, hoteli, razgledišča, naravne znamenitosti. Licenca: ODbL.",
        en: "POI data (points of interest) — sights, museums, restaurants, hotels, viewpoints, natural features. Licence: ODbL.",
      }),
      url: "https://www.openstreetmap.org/copyright",
    },
    {
      name: "I feel Slovenia (STO) — slovenia.info",
      desc: pick(l, {
        sl: "Uradna turistična vsebina Slovenske turistične organizacije, ki jo AI uporablja kot uzemljenje odgovorov s citati.",
        en: "Official content of the Slovenian Tourist Board, used by the AI as grounding for cited answers.",
      }),
      url: "https://www.slovenia.info",
    },
    {
      name: "Wikipedia / Wikidata",
      desc: pick(l, {
        sl: "Opisi destinacij in POI-jev. Licenca: CC BY-SA.",
        en: "Descriptions of destinations and POIs. Licence: CC BY-SA.",
      }),
      url: "https://www.wikidata.org",
    },
    {
      name: "Open-Meteo",
      desc: pick(l, {
        sl: "Vremenski podatki v realnem času. Brezplačni API brez ključa.",
        en: "Real-time weather data. A free, keyless API.",
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
