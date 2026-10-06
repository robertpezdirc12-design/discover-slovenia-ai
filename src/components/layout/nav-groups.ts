"use client";

/**
 * Skupne navigacijske skupine (kanon izvirnika: navigation.tsx → useNavLinks /
 * useMoreLinks / useToolLinks / useAccountLinks). En vir resnice za desktop
 * vrstico, "Več" dropdown, mobilni Sheet in MobileTabBar "Več".
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
      label: pick(l, { sl: "Odkrij", en: "Discover" }),
    },
    {
      href: "/zemljevid",
      label: pick(l, { sl: "Zemljevid", en: "Map" }),
    },
    {
      href: "/nacrtuj",
      label: pick(l, { sl: "Načrtuj", en: "Plan" }),
    },
    {
      href: "/na-poti",
      label: pick(l, { sl: "Pojdi", en: "Go" }),
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
      label: pick(l, { sl: "Odkrij več", en: "Discover more" }),
      links: [
        { href: "/moja-potovanja", label: pick(l, { sl: "Moja potovanja", en: "My trips" }) },
        { href: "/dozivetja", label: pick(l, { sl: "Doživetja", en: "Experiences" }) },
        { href: "/vodici", label: pick(l, { sl: "Vodiči", en: "Guides" }) },
        { href: "/dogodki", label: pick(l, { sl: "Dogodki", en: "Events" }) },
        { href: "/lokali", label: pick(l, { sl: "Lokali", en: "Local spots" }) },
        { href: "/trznica", label: pick(l, { sl: "Tržnica", en: "Marketplace" }) },
        { href: "/slovenia-pass", label: pick(l, { sl: "Slovenia Pass", en: "Slovenia Pass" }) },
      ],
    },
    {
      id: "plan-tools",
      label: pick(l, { sl: "Načrtuj in orodja", en: "Plan & tools" }),
      links: [
        { href: "/potovanje", label: pick(l, { sl: "Celotno potovanje", en: "Full journey" }) },
        { href: "/primerjava", label: pick(l, { sl: "Primerjava načrtovalcev", en: "Planner comparison" }) },
        { href: "/go", label: pick(l, { sl: "Pojdi — partnerji", en: "Go — partners" }) },
      ],
    },
    {
      id: "account",
      label: pick(l, { sl: "Račun", en: "Account" }),
      links: [
        { href: "/prijava", label: pick(l, { sl: "Prijava", en: "Sign in" }) },
        { href: "/za-ponudnike", label: pick(l, { sl: "Za ponudnike", en: "For providers" }) },
      ],
    },
  ];
}
