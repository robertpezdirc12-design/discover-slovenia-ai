"use client";

import { Compass, Footprints, Map as MapIcon, MoreHorizontal, Route } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { useMoreGroups, usePrimaryLinks } from "@/components/layout/nav-groups";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { useMyTripCount } from "@/lib/my-trip";
import { cn } from "@/lib/utils";

/**
 * MOBILE TAB BAR (fiksno dno, samo mobilni) — kanon izvirnika:
 * Odkrij | Zemljevid | **MOJA POT** (sredinska izstopajoča krogla + badge
 * števca iz localStorage 'dai:my-trip') | Pojdi | Več (Sheet).
 *
 * A11y: aria-current za aktivni zavihek, ≥44px dotiki, safe-area obloga,
 * navigacijska oznaka za bralnik zaslona.
 */
/** Enostavni zavihek (ikona + napis, ≥44px dotik) — izven rendanja. */
function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-14 min-w-11 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

export function MobileTabBar() {
  const l = useLocale();
  const pathname = usePathname();
  const count = useMyTripCount();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const primary = usePrimaryLinks();
  const moreGroups = useMoreGroups();

  const L = {
    navLabel: {
      sl: "Mobilna navigacija po vrsti zavihkov",
      en: "Mobile tab navigation",
      it: "Navigazione mobile a schede",
      de: "Mobile Tab-Navigation",
      fr: "Navigation mobile par onglets",
      es: "Navegación móvil por pestañas",
    },
    discover: { sl: "Odkrij", en: "Discover", it: "Scopri", de: "Entdecken", fr: "Découvrir", es: "Descubre" },
    map: { sl: "Zemljevid", en: "Map", it: "Mappa", de: "Karte", fr: "Carte", es: "Mapa" },
    myTrip: { sl: "Moja pot", en: "My trip", it: "Il mio viaggio", de: "Meine Reise", fr: "Mon voyage", es: "Mi viaje" },
    myTripWith: {
      sl: (n: number) => `Moja pot (${n} postankov)`,
      en: (n: number) => `My trip (${n} stops)`,
      it: (n: number) => `Il mio viaggio (${n} tappe)`,
      de: (n: number) => `Meine Reise (${n} Stopps)`,
      fr: (n: number) => `Mon voyage (${n} étapes)`,
      es: (n: number) => `Mi viaje (${n} paradas)`,
    },
    go: { sl: "Pojdi", en: "Go", it: "Vai", de: "Los", fr: "Partir", es: "Ir" },
    more: { sl: "Več", en: "More", it: "Altro", de: "Mehr", fr: "Plus", es: "Más" },
    moreMenu: {
      sl: "Vse sekcije platforme",
      en: "All platform sections",
      it: "Tutte le sezioni della piattaforma",
      de: "Alle Bereiche der Plattform",
      fr: "Toutes les sections de la plateforme",
      es: "Todas las secciones de la plataforma",
    },
    badge99: { sl: "99+", en: "99+", it: "99+", de: "99+", fr: "99+", es: "99+" },
  } as const;

  const isActive = React.useCallback(
    (href: string) => {
      if (href === "/destinacije")
        return pathname === href || pathname.startsWith("/destinacija");
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname]
  );

  return (
    <nav
      aria-label={pick(l, L.navLabel)}
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <div className="border-t border-border/60 bg-background/95 shadow-[0_-8px_32px_-20px_rgba(0,0,0,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/88">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pt-1 pb-1 safe-area-bottom">
          <Tab href="/destinacije" label={pick(l, L.discover)} active={isActive("/destinacije")}>
            <Compass className="size-5" aria-hidden="true" />
            <span className="truncate">{pick(l, L.discover)}</span>
          </Tab>

          <Tab href="/zemljevid" label={pick(l, L.map)} active={isActive("/zemljevid")}>
            <MapIcon className="size-5" aria-hidden="true" />
            <span className="truncate">{pick(l, L.map)}</span>
          </Tab>

          {/* MOJA POT — sredinska izstopajoča krogla + badge števec */}
          <Link
            href="/moja-potovanja"
            aria-current={isActive("/moja-potovanja") ? "page" : undefined}
            aria-label={
              count > 0
                ? pick(l, L.myTripWith)(count)
                : pick(l, L.myTrip)
            }
            className="relative -mt-7 flex size-14 items-center justify-center self-start rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Route className="size-6" aria-hidden="true" />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background"
              >
                {count > 99 ? pick(l, L.badge99) : count}
              </span>
            )}
          </Link>

          <Tab href="/go" label={pick(l, L.go)} active={isActive("/go")}>
            <Footprints className="size-5" aria-hidden="true" />
            <span className="truncate">{pick(l, L.go)}</span>
          </Tab>

          {/* Več — Sheet z vsemi sekcijami */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              className={cn(
                "flex h-14 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                moreOpen
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              <span className="truncate">{pick(l, L.more)}</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[75dvh] overflow-y-auto rounded-t-2xl p-0 safe-area-bottom"
            >
              {/* POLIR11: dvh namesto vh — dolgi list „Več" se ne skrije več za
                  mobilno naslovno vrstico brskalnika (enako vh na namizju). */}
              <div className="sticky top-0 border-b bg-background p-4">
                <SheetTitle className="text-left text-base font-bold">
                  {pick(l, L.moreMenu)}
                </SheetTitle>
              </div>
              <div className="p-4">
                <ul className="mb-4 grid grid-cols-2 gap-1">
                  {primary.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMoreOpen(false)}
                        className="flex min-h-11 items-center rounded-md px-3 py-2.5 text-sm font-medium text-foreground/90 hover:bg-accent hover:text-accent-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                {moreGroups.map((group) => (
                  <div key={group.id} className="mb-4 last:mb-0">
                    <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </p>
                    <ul className="mt-1 grid grid-cols-2 gap-1">
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setMoreOpen(false)}
                            className="flex min-h-11 items-center rounded-md px-3 py-2.5 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
