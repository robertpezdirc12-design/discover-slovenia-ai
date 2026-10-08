"use client";

/**
 * Skupne navigacijske skupine (kanon izvirnika: navigation.tsx → useNavLinks /
 * useMoreLinks / useToolLinks / useAccountLinks). En vir resnice za desktop
 * vrstico, "Več" dropdown, mobilni Sheet in MobileTabBar "Več".
 *
 * Jeziki: vseh 6 izvirnika (sl privzet + en/it/de/fr/es prek pick()).
 */

import { useLocale } from "next-intl";

import { pick } from "@/lib/i18n-pick";

export interface NavLink {
  href: string;
  label: string;
}

/** Primarna vrstica: ODKRIJ → ZEMLJEVID → NAČRTUJ → POJDI (mentalni model). */
export function usePrimaryLinks(): NavLink[] {
  const l = useLocale();
  return [
    {
      href: "/destinacije",
      label: pick(l, {
        sl: "Odkrij",
        en: "Discover",
        it: "Scopri",
        de: "Entdecken",
        fr: "Découvrir",
        es: "Descubre",
      }),
    },
    {
      href: "/zemljevid",
      label: pick(l, {
        sl: "Zemljevid",
        en: "Map",
        it: "Mappa",
        de: "Karte",
        fr: "Carte",
        es: "Mapa",
      }),
    },
    {
      href: "/nacrtuj",
      label: pick(l, {
        sl: "Načrtuj",
        en: "Plan",
        it: "Pianifica",
        de: "Planen",
        fr: "Planifier",
        es: "Planifica",
      }),
    },
    {
      href: "/na-poti",
      label: pick(l, {
        sl: "Pojdi",
        en: "Go",
        it: "Vai",
        de: "Los",
        fr: "Partir",
        es: "Ir",
      }),
    },
  ];
}

export interface NavGroup {
  id: string;
  label: string;
  links: NavLink[];
}

/** "Več" — vse ravni-2 povezave (progressive disclosure, ZERO feature loss). */
export function useMoreGroups(): NavGroup[] {
  const l = useLocale();
  return [
    {
      id: "discover-more",
      label: pick(l, {
        sl: "Odkrij več",
        en: "Discover more",
        it: "Scopri di più",
        de: "Mehr entdecken",
        fr: "Découvrir plus",
        es: "Descubre más",
      }),
      links: [
        {
          href: "/moja-potovanja",
          label: pick(l, {
            sl: "Moja potovanja",
            en: "My trips",
            it: "I miei viaggi",
            de: "Meine Reisen",
            fr: "Mes voyages",
            es: "Mis viajes",
          }),
        },
        {
          href: "/dozivetja",
          label: pick(l, {
            sl: "Doživetja",
            en: "Experiences",
            it: "Esperienze",
            de: "Erlebnisse",
            fr: "Expériences",
            es: "Experiencias",
          }),
        },
        {
          href: "/vodici",
          label: pick(l, {
            sl: "Vodiči",
            en: "Guides",
            it: "Guide",
            de: "Guides",
            fr: "Guides",
            es: "Guías",
          }),
        },
        {
          href: "/dogodki",
          label: pick(l, {
            sl: "Dogodki",
            en: "Events",
            it: "Eventi",
            de: "Veranstaltungen",
            fr: "Événements",
            es: "Eventos",
          }),
        },
        {
          href: "/lokali",
          label: pick(l, {
            sl: "Lokali",
            en: "Local spots",
            it: "Posti locali",
            de: "Lokale Orte",
            fr: "Adresses locales",
            es: "Lugares locales",
          }),
        },
        {
          href: "/trznica",
          label: pick(l, {
            sl: "Tržnica",
            en: "Marketplace",
            it: "Mercato",
            de: "Marktplatz",
            fr: "Marché",
            es: "Mercado",
          }),
        },
        {
          href: "/slovenia-pass",
          label: pick(l, { sl: "Slovenia Pass", en: "Slovenia Pass", it: "Slovenia Pass", de: "Slovenia Pass", fr: "Slovenia Pass", es: "Slovenia Pass" }),
        },
      ],
    },
    {
      id: "plan-tools",
      label: pick(l, {
        sl: "Načrtuj in orodja",
        en: "Plan & tools",
        it: "Pianifica e strumenti",
        de: "Planen & Werkzeuge",
        fr: "Planifier et outils",
        es: "Planifica y herramientas",
      }),
      links: [
        {
          href: "/potovanje",
          label: pick(l, {
            sl: "Celotno potovanje",
            en: "Full journey",
            it: "Viaggio completo",
            de: "Ganze Reise",
            fr: "Voyage complet",
            es: "Viaje completo",
          }),
        },
        {
          href: "/primerjava",
          label: pick(l, {
            sl: "Primerjava načrtovalcev",
            en: "Planner comparison",
            it: "Confronto pianificatori",
            de: "Planer-Vergleich",
            fr: "Comparaison des planificateurs",
            es: "Comparación de planificadores",
          }),
        },
        {
          href: "/go",
          label: pick(l, {
            sl: "Pojdi — partnerji",
            en: "Go — partners",
            it: "Vai — partner",
            de: "Los — Partner",
            fr: "Partir — partenaires",
            es: "Ir — socios",
          }),
        },
      ],
    },
    {
      id: "account",
      label: pick(l, {
        sl: "Račun",
        en: "Account",
        it: "Account",
        de: "Konto",
        fr: "Compte",
        es: "Cuenta",
      }),
      links: [
        {
          href: "/prijava",
          label: pick(l, {
            sl: "Prijava",
            en: "Sign in",
            it: "Accedi",
            de: "Anmelden",
            fr: "Connexion",
            es: "Iniciar sesión",
          }),
        },
        {
          // P1-A (issue #3 §1/§2): osebni profil — preference + spomin.
          href: "/moj-profil",
          label: pick(l, {
            sl: "Moj profil",
            en: "My profile",
            it: "Il mio profilo",
            de: "Mein Profil",
            fr: "Mon profil",
            es: "Mi perfil",
          }),
        },
        {
          href: "/za-ponudnike",
          label: pick(l, {
            sl: "Za ponudnike",
            en: "For providers",
            it: "Per i fornitori",
            de: "Für Anbieter",
            fr: "Pour les prestataires",
            es: "Para proveedores",
          }),
        },
      ],
    },
  ];
}
