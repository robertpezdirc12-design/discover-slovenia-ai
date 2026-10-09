"use client";

import {
  ChevronDown,
  Menu,
  Search,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  useMoreGroups,
  usePrimaryLinks,
} from "@/components/layout/nav-groups";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { pick } from "@/lib/i18n-pick";

/**
 * GLAVA — scroll-glass navigacija po vzorcu izvirnika (GYG/Airbnb):
 * - na domači strani nad zelenim herojem: prozorna, bela pisava
 * - po odscrollu (ali na vseh podstraneh): stekleno meglo ozadje + meja
 * - tanek zelen progress bar na dnu (branje dolžine strani)
 * - desktop: Odkrij · Zemljevid · Načrtuj · Pojdi + "Več" (dropdown)
 * - mobilni: Sheet z vsemi skupinami (progressive disclosure)
 */
export function Navigation() {
  const l = useLocale();
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const primaryLinks = usePrimaryLinks();
  const moreGroups = useMoreGroups();

  const L = {
    brand: { sl: "Discover Slovenia AI", en: "Discover Slovenia AI", it: "Discover Slovenia AI", de: "Discover Slovenia AI", fr: "Discover Slovenia AI", es: "Discover Slovenia AI" },
    tagline: { sl: "I Feel Slovenia", en: "I Feel Slovenia", it: "I Feel Slovenia", de: "I Feel Slovenia", fr: "I Feel Slovenia", es: "I Feel Slovenia" },
    home: {
      sl: "Discover Slovenia AI — domov",
      en: "Discover Slovenia AI — home",
      it: "Discover Slovenia AI — home",
      de: "Discover Slovenia AI — Startseite",
      fr: "Discover Slovenia AI — accueil",
      es: "Discover Slovenia AI — inicio",
    },
    mainNav: {
      sl: "Glavna navigacija",
      en: "Main navigation",
      it: "Navigazione principale",
      de: "Hauptnavigation",
      fr: "Navigation principale",
      es: "Navegación principal",
    },
    more: { sl: "Več", en: "More", it: "Altro", de: "Mehr", fr: "Plus", es: "Más" },
    search: {
      sl: "Iskanje destinacij",
      en: "Search destinations",
      it: "Cerca destinazioni",
      de: "Reiseziele suchen",
      fr: "Rechercher des destinations",
      es: "Buscar destinos",
    },
    openMenu: { sl: "Odpri meni", en: "Open menu", it: "Apri il menu", de: "Menü öffnen", fr: "Ouvrir le menu", es: "Abrir el menú" },
    mobileNav: { sl: "Mobilni meni", en: "Mobile menu", it: "Menu mobile", de: "Mobiles Menü", fr: "Menu mobile", es: "Menú móvil" },
    closeMenu: { sl: "Zapri meni", en: "Close menu", it: "Chiudi il menu", de: "Menü schließen", fr: "Fermer le menu", es: "Cerrar el menú" },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const isHome = pathname === "/";
  // Nad herojem je glava prozorna SAMO na domači strani (podstrani nimajo
  // fotografskega heroja — bela pisava na belem ozadju bi bila nevidna).
  const overHero = isHome && !scrolled;
  const glass = scrolled || !isHome;

  // Scroll: preklop stekla + progress branja (passive, rAF-throttled).
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(y / max, 1) : 0);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        glass
          ? "border-b border-border/70 bg-background/85 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <a
        href="#vsebina"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        {pick(l, {
          sl: "Preskoči na vsebino",
          en: "Skip to content",
          it: "Salta al contenuto",
          de: "Zum Inhalt springen",
          fr: "Aller au contenu",
          es: "Ir al contenido",
        })}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* Logotip */}
        <Link
          href="/"
          aria-label={t("home")}
          className={cn(
            "group flex items-center gap-2.5 transition-colors",
            overHero
              ? "text-white drop-shadow-md hover:text-white"
              : "text-foreground hover:text-primary"
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary shadow-md transition-transform group-hover:scale-105">
            {/* logo.svg — znak gore iz produkcije (30×30) */}
            <img
              src="/logo.svg"
              alt=""
              width={22}
              height={22}
              className="size-[22px]"
              aria-hidden="true"
            />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-sm font-bold tracking-tight sm:text-base">
              {t("brand")}
            </span>
            <span
              className={cn(
                "hidden text-[10px] font-semibold tracking-[0.18em] uppercase sm:block",
                overHero ? "text-white/70" : "text-muted-foreground"
              )}
            >
              {t("tagline")}
            </span>
          </span>
        </Link>

        {/* Desktop navigacija */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label={t("mainNav")}>
          {primaryLinks.map((link) => {
            const active =
              pathname === link.href ||
              (link.href === "/destinacije" && pathname.startsWith("/destinacija"));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active && !overHero && "text-primary",
                  overHero
                    ? active
                      ? "text-white underline-offset-4 hover:text-white"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}

          {/* "Več" — dropdown (progressive disclosure, ZERO feature loss) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                overHero
                  ? "text-white/85 hover:bg-white/10 hover:text-white"
                  : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {t("more")}
              <ChevronDown className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {moreGroups.map((group, gi) => (
                <React.Fragment key={group.id}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-muted-foreground">
                    {group.label}
                  </DropdownMenuLabel>
                  {group.links.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link href={link.href}>{link.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Desna skupina: iskanje, obvestila, jezik, tema + mobilni meni */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="tap-target rounded-full"
          >
            <Link href="/destinacije" aria-label={t("search")} title={t("search")}>
              <Search className="size-5" aria-hidden="true" />
            </Link>
          </Button>
          {/* P1-C (issue #3 §10): zvonček obvestil — samo prijavljenim. */}
          <NotificationBell />
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <ThemeToggle />

          {/* Mobilni meni (Sheet) */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="tap-target rounded-full lg:hidden"
                aria-label={t("openMenu")}
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[85vw] max-w-sm flex-col overflow-y-auto p-0"
            >
              <div className="border-b p-4">
                <SheetTitle className="text-left text-base font-bold">
                  {t("brand")}
                </SheetTitle>
                <div className="mt-2 sm:hidden">
                  <LanguageSwitcher />
                </div>
              </div>
              <nav className="flex-1 p-4" aria-label={t("mobileNav")}>
                <ul className="space-y-1">
                  {primaryLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground/90 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                {moreGroups.map((group) => (
                  <div key={group.id} className="mt-5">
                    <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className="block rounded-md px-3 py-2.5 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Tanek zelen progress bar (branje dolžine strani) */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary transition-opacity",
          progress > 0.005 ? "opacity-100" : "opacity-0"
        )}
        style={{ transform: `scaleX(${progress})` }}
      />
    </header>
  );
}
