"use client";

import { useLocale } from "next-intl";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pick } from "@/lib/i18n-pick";

/** Besedilo 1:1 iz produkcije (production-mirror/pogoji-uporabe, 2025). */
const SL: LegalSection[] = [
  {
    id: "sprejem",
    heading: "Sprejem pogojev",
    paragraphs: ["Z uporabo platforme Discover Slovenia AI sprejemate te pogoje uporabe."],
  },
  {
    id: "storitev",
    heading: "Storitev",
    paragraphs: [
      "Platforma ponuja informacije o slovenskih turističnih destinacijah, AI načrtovanje potovanj in povezave do lokalnih ponudnikov. Platforma ne posreduje rezervacij — uporabniki rezervirajo neposredno pri ponudnikih.",
    ],
  },
  {
    id: "itinererji",
    heading: "Itinererji",
    paragraphs: [
      "Generirani itinererji so informativne narave. Platforma ne prevzema odgovornosti za točnost cen, razpoložljivost ali kakovost storitev tretjih oseb.",
    ],
  },
  {
    id: "affiliate",
    heading: "Affiliate povezave",
    paragraphs: [
      "Platforma vsebuje partnerske (affiliate) povezave (Booking.com, DiscoverCars, GetYourGuide, Skyscanner, World Nomads, SafetyWing, Airalo, Kiwitaxi, Omio, Tiqets in Viator). Če prek teh povezav opravite rezervacijo, lahko Discover Slovenia prejme partnersko provizijo. Cena za vas se zaradi tega ne poveča.",
    ],
  },
  {
    id: "ponudniki",
    heading: "Ponudniki (B2B)",
    paragraphs: [
      "Registrirani ponudniki so odgovorni za točnost svojih podatkov. Pavšalna naročnina (Premium €149/mes, Enterprise €499/mes) se obračuna mesečno. Odjava je možna kadarkoli s 30-dnevnim odpovednim rokom.",
    ],
  },
  {
    id: "beta",
    heading: "Beta obdobje",
    paragraphs: [
      "Med beta obdobjem (do 30 aktivnih lokalov) so vsi paketi brezplačni. Po vklopu monetizacije imajo beta uporabniki 6 mesecev brezplačnega dostopa.",
    ],
  },
  {
    id: "intelektualna",
    heading: "Intelektualna lastnina",
    paragraphs: [
      "Vsebina platforme je zaščitena z MIT licenco. Slike destinacij so pridobljene iz odprtih virov (Unsplash, OpenStreetMap). Spletna koda je odprtokodna.",
    ],
  },
  {
    id: "odgovornost",
    heading: "Omejitev odgovornosti",
    paragraphs: [
      "Platforma ne prevzema odgovornosti za škodo, ki bi izhajala iz uporabe informacij ali povezav do tretjih oseb.",
    ],
  },
  {
    id: "spremembe",
    heading: "Spremembe pogojev",
    paragraphs: [
      "Pogoji se lahko posodobijo. O pomembnih spremembah bomo obvestili registrirane uporabnike po e-pošti.",
    ],
  },
  {
    id: "kontakt",
    heading: "Kontakt",
    paragraphs: [
      "Vprašanja o pogojih pošljite prek obrazca na kontaktni strani.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
];

const EN: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Acceptance of terms",
    paragraphs: ["By using the Discover Slovenia AI platform you accept these terms of use."],
  },
  {
    id: "service",
    heading: "The service",
    paragraphs: [
      "The platform provides information about Slovenian tourist destinations, AI trip planning and links to local providers. The platform does not broker reservations — users book directly with providers.",
    ],
  },
  {
    id: "itineraries",
    heading: "Itineraries",
    paragraphs: [
      "Generated itineraries are informational. The platform is not responsible for the accuracy of prices, availability or quality of third-party services.",
    ],
  },
  {
    id: "affiliate",
    heading: "Affiliate links",
    paragraphs: [
      "The platform contains affiliate links (Booking.com, DiscoverCars, GetYourGuide, Skyscanner, World Nomads, SafetyWing, Airalo, Kiwitaxi, Omio, Tiqets and Viator). If you book through these links, Discover Slovenia may receive a partner commission. Your price does not increase because of this.",
    ],
  },
  {
    id: "providers",
    heading: "Providers (B2B)",
    paragraphs: [
      "Registered providers are responsible for the accuracy of their data. Flat subscriptions (Premium €149/mo, Enterprise €499/mo) are billed monthly. Cancellation is possible at any time with a 30-day notice period.",
    ],
  },
  {
    id: "beta",
    heading: "Beta period",
    paragraphs: [
      "During the beta period (up to 30 active local spots) all packages are free. Once monetization is switched on, beta users get 6 months of free access.",
    ],
  },
  {
    id: "ip",
    heading: "Intellectual property",
    paragraphs: [
      "Platform content is protected by the MIT licence. Destination images come from open sources (Unsplash, OpenStreetMap). The web code is open source.",
    ],
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    paragraphs: [
      "The platform is not liable for damages arising from the use of information or links to third parties.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to the terms",
    paragraphs: [
      "The terms may be updated. We will notify registered users about important changes by email.",
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: ["Questions about the terms can be sent via the contact form."],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
];

export default function TermsPage() {
  const l = useLocale();
  const title = pick(l, { sl: "Pogoji uporabe", en: "Terms of use" });
  return (
    <LegalPage
      title={title}
      updated="2025"
      sections={l === "en" ? EN : SL}
    />
  );
}
