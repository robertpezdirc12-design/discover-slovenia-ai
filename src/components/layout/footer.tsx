"use client";

import { useLocale } from "next-intl";

import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { DATA_STATS } from "@/lib/slovenia-data";

/**
 * NOGA — 4 stolpci kot v produkciji (Razišči · Načrtuj · Za ponudnike ·
 * Pravno) + vrstica z verzijo rekonstrukcije.
 *
 * LEPLJIVA NA DNO: postavljena je kot zadnji otrok flex-col korena
 * ([locale]/layout) z razredom mt-auto — pri kratki vsebini se prilepi na
 * dno vidnega polja, ob prekoračitvi pa se naravno porine navzdol.
 */
export function Footer() {
  const l = useLocale();

  const L = {
    brand: { sl: "Discover Slovenia AI", en: "Discover Slovenia AI", it: "Discover Slovenia AI", de: "Discover Slovenia AI", fr: "Discover Slovenia AI", es: "Discover Slovenia AI" },
    lead: {
      sl: `Načrtovalec potovanj za Slovenijo in zahodni Balkan z realnimi podatki in determinističnim motorjem. Odkrij ${DATA_STATS.destinations} destinacij — Bled, Ljubljana, Piran in več.`,
      en: `Travel planner for Slovenia and the Western Balkans with real data and a deterministic engine. Discover ${DATA_STATS.destinations} destinations — Bled, Ljubljana, Piran and more.`,
      it: `Pianificatore di viaggi per la Slovenia e i Balcani occidentali con dati reali e un motore deterministico. Scopri ${DATA_STATS.destinations} destinazioni — Bled, Lubiana, Pirano e oltre.`,
      de: `Reiseplaner für Slowenien und den westlichen Balkan mit echten Daten und einer deterministischen Engine. Entdecke ${DATA_STATS.destinations} Reiseziele — Bled, Ljubljana, Piran und mehr.`,
      fr: `Planificateur de voyage pour la Slovénie et les Balkans occidentaux avec des données réelles et un moteur déterministe. Découvrez ${DATA_STATS.destinations} destinations — Bled, Ljubljana, Piran et plus.`,
      es: `Planificador de viajes para Eslovenia y los Balcanes occidentales con datos reales y un motor determinista. Descubre ${DATA_STATS.destinations} destinos — Bled, Liubliana, Pirán y más.`,
    },
    explore: { sl: "Razišči", en: "Explore", it: "Esplora", de: "Entdecken", fr: "Explorer", es: "Explora" },
    plan: { sl: "Načrtuj", en: "Plan", it: "Pianifica", de: "Planen", fr: "Planifier", es: "Planifica" },
    providers: { sl: "Za ponudnike", en: "For providers", it: "Per i fornitori", de: "Für Anbieter", fr: "Pour les prestataires", es: "Para proveedores" },
    legal: { sl: "Pravno", en: "Legal", it: "Legale", de: "Rechtliches", fr: "Mentions légales", es: "Legal" },
    destinations: { sl: "Destinacije", en: "Destinations", it: "Destinazioni", de: "Reiseziele", fr: "Destinations", es: "Destinos" },
    map: { sl: "Zemljevid", en: "Map", it: "Mappa", de: "Karte", fr: "Carte", es: "Mapa" },
    listings: { sl: "Lokalni ponudniki", en: "Local providers", it: "Fornitori locali", de: "Lokale Anbieter", fr: "Prestataires locaux", es: "Proveedores locales" },
    guides: { sl: "Vodiči", en: "Guides", it: "Guide", de: "Guides", fr: "Guides", es: "Guías" },
    events: { sl: "Dogodki", en: "Events", it: "Eventi", de: "Veranstaltungen", fr: "Événements", es: "Eventos" },
    experiences: { sl: "Doživetja", en: "Experiences", it: "Esperienze", de: "Erlebnisse", fr: "Expériences", es: "Experiencias" },
    planTrip: { sl: "Načrtuj pot", en: "Plan a trip", it: "Pianifica un viaggio", de: "Reise planen", fr: "Planifier un voyage", es: "Planifica un viaje" },
    myTrips: { sl: "Moja potovanja", en: "My trips", it: "I miei viaggi", de: "Meine Reisen", fr: "Mes voyages", es: "Mis viajes" },
    goMode: { sl: "Na poti (Go Mode)", en: "On the go (Go Mode)", it: "In viaggio (Go Mode)", de: "Unterwegs (Go Mode)", fr: "En route (Go Mode)", es: "En camino (Go Mode)" },
    pass: { sl: "Slovenia Pass", en: "Slovenia Pass", it: "Slovenia Pass", de: "Slovenia Pass", fr: "Slovenia Pass", es: "Slovenia Pass" },
    marketplace: { sl: "Tržnica", en: "Marketplace", it: "Mercato", de: "Marktplatz", fr: "Marché", es: "Mercado" },
    forProviders: { sl: "Za ponudnike", en: "For providers", it: "Per i fornitori", de: "Für Anbieter", fr: "Pour les prestataires", es: "Para proveedores" },
    dataSource: { sl: "Vir podatkov", en: "Data source", it: "Fonte dei dati", de: "Datenquelle", fr: "Source des données", es: "Fuente de datos" },
    trust: { sl: "Zaupanje in varnost", en: "Trust & safety", it: "Fiducia e sicurezza", de: "Vertrauen & Sicherheit", fr: "Confiance et sécurité", es: "Confianza y seguridad" },
    terms: { sl: "Pogoji uporabe", en: "Terms of use", it: "Termini di utilizzo", de: "Nutzungsbedingungen", fr: "Conditions d’utilisation", es: "Términos de uso" },
    privacy: { sl: "Politika zasebnosti", en: "Privacy policy", it: "Informativa sulla privacy", de: "Datenschutzerklärung", fr: "Politique de confidentialité", es: "Política de privacidad" },
    contact: { sl: "Kontakt", en: "Contact", it: "Contatti", de: "Kontakt", fr: "Contact", es: "Contacto" },
    madeIn: { sl: "Narejeno v Sloveniji", en: "Made in Slovenia", it: "Fatto in Slovenia", de: "Hergestellt in Slowenien", fr: "Fait en Slovénie", es: "Hecho en Eslovenia" },
    affiliate: {
      sl: "Affiliate povezave — zaslužimo provizijo pri rezervacijah.",
      en: "Affiliate links — we earn a commission on bookings.",
      it: "Link affiliati — guadagniamo una commissione sulle prenotazioni.",
      de: "Affiliate-Links — wir erhalten eine Provision bei Buchungen.",
      fr: "Liens affiliés — nous percevons une commission sur les réservations.",
      es: "Enlaces de afiliados — ganamos una comisión en las reservas.",
    },
    footerNav: { sl: "Navigacija v nogi", en: "Footer navigation", it: "Navigazione a piè di pagina", de: "Fußzeilen-Navigation", fr: "Navigation de pied de page", es: "Navegación del pie de página" },
    reconstruction: { sl: "Rekonstrukcija", en: "Reconstruction", it: "Ricostruzione", de: "Rekonstruktion", fr: "Reconstruction", es: "Reconstrucción" },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const columns: {
    id: string;
    title: string;
    links: { href: string; label: string }[];
  }[] = [
    {
      id: "explore",
      title: t("explore"),
      links: [
        { href: "/destinacije", label: t("destinations") },
        { href: "/zemljevid", label: t("map") },
        { href: "/lokali", label: t("listings") },
        { href: "/vodici", label: t("guides") },
        { href: "/dogodki", label: t("events") },
        { href: "/dozivetja", label: t("experiences") },
      ],
    },
    {
      id: "plan",
      title: t("plan"),
      links: [
        { href: "/nacrtuj", label: t("planTrip") },
        { href: "/moja-potovanja", label: t("myTrips") },
        { href: "/na-poti", label: t("goMode") },
        { href: "/slovenia-pass", label: t("pass") },
        { href: "/trznica", label: t("marketplace") },
      ],
    },
    {
      id: "providers",
      title: t("providers"),
      links: [
        { href: "/za-ponudnike", label: t("forProviders") },
        { href: "/vir-podatkov", label: t("dataSource") },
        { href: "/zaupanje-in-varnost", label: t("trust") },
      ],
    },
    {
      id: "legal",
      title: t("legal"),
      links: [
        { href: "/pogoji-uporabe", label: t("terms") },
        { href: "/politika-zasebnosti", label: t("privacy") },
        { href: "/kontakt", label: t("contact") },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto w-full max-w-7xl px-4 pt-12 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Znamka */}
          <div className="lg:col-span-1">
            <p className="text-sm font-bold">{t("brand")}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("lead")}
            </p>
          </div>

          {/* 4 stolpci povezav */}
          <nav
            aria-label={t("footerNav")}
            className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4"
          >
            {columns.map((col) => (
              <div key={col.id}>
                <h3 className="text-sm font-semibold tracking-wide text-foreground">
                  {col.title}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      {/* POLIR8 (2.35.0): break-words + max-w-full — nemške
                          sestavljenke („Nutzungsbedingungen“ 158 px,
                          „Datenschutzerklärung“ 155 px) se prelomijo v
                          128 px stolpcu namesto da raznesejo stran (14 px
                          preliva na VSEH straneh v DE @320, WCAG 1.4.10).
                          EMPIRIČNO (agent-browser @320): break-words SAMO na
                          inline-flex NE deluje — anonymous flex item ima
                          min-width:auto = min-content besede (break-word ne
                          vpliva na min-content), zato inline-flex →
                          inline-block (besedilo živi v vrsticah BFC),
                          max-w-full ga omeji na stolpec, break-words prelomi
                          besedo; večbesedne povezave se ovijejo kot prej;
                          min-h-6 ohrani tap-target. */}
                      <Link
                        href={link.href}
                        className="inline-block max-w-full min-h-6 text-sm break-words text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 Discover Slovenia AI. {t("madeIn")}. {t("affiliate")}
          </p>
          <p className="font-mono">
            v2.36.0 · {t("reconstruction")} 2026-10-12
          </p>
        </div>
      </div>

      {/* Prostor za fiksno MobilnoTabBar (vsebina ne sme biti pokrita). */}
      <div aria-hidden="true" className="h-16 lg:hidden" />
    </footer>
  );
}
