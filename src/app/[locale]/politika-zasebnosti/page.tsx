"use client";

import { useLocale } from "next-intl";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pick } from "@/lib/i18n-pick";

/** Besedilo 1:1 iz produkcije (production-mirror/politika-zasebnosti, 2025). */
const SL: LegalSection[] = [
  {
    id: "splosno",
    heading: "Splošno",
    paragraphs: [
      "Discover Slovenia AI („platforma“) spoštuje vašo zasebnost. Ta politika opisuje, katere podatke zbiramo, kako jih uporabljamo in katere pravice imate.",
    ],
  },
  {
    id: "obiskovalci",
    heading: "Podatki obiskovalcev",
    paragraphs: [
      "Ne zbiramo osebnih podatkov obiskovalcev brez izrecne privolitve. Spremljamo samo anonimne analitične podatke (ogledi strani, kliki) za izboljšanje platforme.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "Če se prijavite na newsletter, shranimo vaš e-poštni naslov. Uporabimo ga izključno za pošiljanje turističnih vodnikov in nasvetov. Kadarkoli se lahko odjavite.",
    ],
  },
  {
    id: "ponudniki",
    heading: "Ponudniki (B2B)",
    paragraphs: [
      "Registrirani ponudniki zagotovijo: ime, e-pošto, ime podjetja in geslo. Gesla so shranjena z bcrypt zgoščevanjem (12 rund). Poslovni podatki (naslov, telefon, spletna stran) so javno prikazani na platformi.",
    ],
  },
  {
    id: "leadi",
    heading: "Leadi (obrazec Pridruži se)",
    paragraphs: [
      "Ko izpolnite obrazec „Pridruži se“, shranimo: ime, e-pošto, telefon, ime podjetja, tip, kraj in želen paket. Te podatke uporabimo izključno za kontaktiranje v zvezi z vašo prijavo.",
    ],
  },
  {
    id: "piskotki",
    heading: "Piškotki",
    paragraphs: [
      "Platforma uporablja nujno potrebne piškotke za delovanje (avtentikacija, jezikovne nastavitve). Ne uporabljamo marketinških ali sledilnih piškotkov.",
    ],
  },
  {
    id: "placila",
    heading: "Plačila (Stripe)",
    paragraphs: [
      "Plačila se obdelujejo prek Stripe. Ne shranjujemo podatkov o kreditnih karticah. Stripe je PCI-DSS certificiran.",
    ],
  },
  {
    id: "pravice",
    heading: "Vaše pravice",
    paragraphs: [
      "V skladu s GDPR imate pravico do: vpogleda, popravka, izbrisa in prenosa svojih podatkov. Pravice uveljavljate prek obrazca na kontaktni strani.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
  {
    id: "kontakt",
    heading: "Kontakt",
    paragraphs: [
      "Za vprašanja o zasebnosti pišite prek obrazca na kontaktni strani. Sporočila obrazca (ime, e-pošta, besedilo) obdelujemo izključno za odgovor vam in jih hranimo največ 12 mesecev.",
    ],
    links: [{ href: "/kontakt", label: "Kontakt" }],
  },
];

const EN: LegalSection[] = [
  {
    id: "general",
    heading: "General",
    paragraphs: [
      "Discover Slovenia AI (the “platform”) respects your privacy. This policy describes what data we collect, how we use it and what rights you have.",
    ],
  },
  {
    id: "visitors",
    heading: "Visitor data",
    paragraphs: [
      "We do not collect personal data from visitors without explicit consent. We track only anonymous analytics (page views, clicks) to improve the platform.",
    ],
  },
  {
    id: "newsletter",
    heading: "Newsletter",
    paragraphs: [
      "If you subscribe to the newsletter, we store your email address. We use it exclusively to send travel guides and tips. You can unsubscribe at any time.",
    ],
  },
  {
    id: "providers",
    heading: "Providers (B2B)",
    paragraphs: [
      "Registered providers supply: name, email, company name and password. Passwords are stored with bcrypt hashing (12 rounds). Business data (address, phone, website) is publicly displayed on the platform.",
    ],
  },
  {
    id: "leads",
    heading: "Leads (Join us form)",
    paragraphs: [
      "When you fill in the “Join us” form, we store: name, email, phone, company name, type, town and desired package. We use this data solely to contact you about your application.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    paragraphs: [
      "The platform uses strictly necessary cookies for operation (authentication, language settings). We do not use marketing or tracking cookies.",
    ],
  },
  {
    id: "payments",
    heading: "Payments (Stripe)",
    paragraphs: [
      "Payments are processed via Stripe. We do not store credit card data. Stripe is PCI-DSS certified.",
    ],
  },
  {
    id: "rights",
    heading: "Your rights",
    paragraphs: [
      "Under the GDPR you have the right to access, rectification, erasure and portability of your data. You can exercise your rights via the contact form.",
    ],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: [
      "For privacy questions, write via the contact form. Form messages (name, email, text) are processed solely to reply to you and are kept for at most 12 months.",
    ],
    links: [{ href: "/kontakt", label: "Contact" }],
  },
];

export default function PrivacyPage() {
  const l = useLocale();
  return (
    <LegalPage
      title={pick(l, { sl: "Politika zasebnosti", en: "Privacy policy" })}
      updated="2025"
      sections={l === "en" ? EN : SL}
    />
  );
}
