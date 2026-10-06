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
    brand: { sl: "Discover Slovenia AI", en: "Discover Slovenia AI" },
    lead: {
      sl: `Načrtovalec potovanj za Slovenijo in zahodni Balkan z realnimi podatki in determinističnim motorjem. Odkrij ${DATA_STATS.destinations} destinacij — Bled, Ljubljana, Piran in več.`,
      en: `Travel planner for Slovenia and the Western Balkans with real data and a deterministic engine. Discover ${DATA_STATS.destinations} destinations — Bled, Ljubljana, Piran and more.`,
    },
    explore: { sl: "Razišči", en: "Explore" },
    plan: { sl: "Načrtuj", en: "Plan" },
    providers: { sl: "Za ponudnike", en: "For providers" },
    legal: { sl: "Pravno", en: "Legal" },
    destinations: { sl: "Destinacije", en: "Destinations" },
    map: { sl: "Zemljevid", en: "Map" },
    listings: { sl: "Lokalni ponudniki", en: "Local providers" },
    guides: { sl: "Vodiči", en: "Guides" },
    events: { sl: "Dogodki", en: "Events" },
    experiences: { sl: "Doživetja", en: "Experiences" },
    planTrip: { sl: "Načrtuj pot", en: "Plan a trip" },
    myTrips: { sl: "Moja potovanja", en: "My trips" },
    goMode: { sl: "Na poti (Go Mode)", en: "On the go (Go Mode)" },
    pass: { sl: "Slovenia Pass", en: "Slovenia Pass" },
    marketplace: { sl: "Tržnica", en: "Marketplace" },
    forProviders: { sl: "Za ponudnike", en: "For providers" },
    dataSource: { sl: "Vir podatkov", en: "Data source" },
    trust: { sl: "Zaupanje in varnost", en: "Trust & safety" },
    terms: { sl: "Pogoji uporabe", en: "Terms of use" },
    privacy: { sl: "Politika zasebnosti", en: "Privacy policy" },
    contact: { sl: "Kontakt", en: "Contact" },
    madeIn: { sl: "Narejeno v Sloveniji", en: "Made in Slovenia" },
    affiliate: {
      sl: "Affiliate povezave — zaslužimo provizijo pri rezervacijah.",
      en: "Affiliate links — we earn a commission on bookings.",
    },
    footerNav: { sl: "Navigacija v nogi", en: "Footer navigation" },
  } as const;

  const t = (k: keyof typeof L) => pick(l, L[k]);

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
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
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
            v2.0.0-rc.1 · {pick(l, { sl: "Rekonstrukcija", en: "Reconstruction" })} 2026-10-06
          </p>
        </div>
      </div>

      {/* Prostor za fiksno MobilnoTabBar (vsebina ne sme biti pokrita). */}
      <div aria-hidden="true" className="h-16 lg:hidden" />
    </footer>
  );
}
