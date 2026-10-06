"use client";

import { useLocale } from "next-intl";

import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pick } from "@/lib/i18n-pick";

/** Besedilo 1:1 iz produkcije (production-mirror/zaupanje-in-varnost). */
const SL: LegalSection[] = [
  {
    id: "partnerji",
    heading: "Kako preverjamo partnerje",
    paragraphs: [
      "Admin odobritev: vsak lokal mora biti ročno odobren s strani naše ekipe, preden je objavljen. Preverjamo pravilnost kontaktov, ustreznost kategorije, kakovost slik in opisa. Nepotrjeni lokalci niso vidni uporabnikom in AI jih ne more priporočati.",
      "Partner Quality Score (0–100): vsak lokal ima avtomatsko izračunan oceni profil iz 7 signalov — popolnost profila (30 %), kakovost fotografij (15 %), kakovost opisa (15 %), AI tagi (10 %), admin verifikacija (10 %), ocene (10 %), svežina podatkov (10 %). Znaki: Verified (Q > 40), Premium (plačnik), Featured (Q > 90 + Premium + Verified).",
      "VLM preverba slik: vse slike na platformi so preverjene z Vision Language Modelom — ujemanje z imenom lokalca, odsotnost vodnih žigov, kakovost in ustreznost vsebine.",
    ],
  },
  {
    id: "ranking",
    heading: "Kako deluje AI ranking",
    paragraphs: [
      "AI priporočila temeljijo na 5 dimenzijah z jasnimi utežmi. Plačilo ne more kupiti prvega mesta:",
      "① Ujemanje z uporabnikovim iskanjem (destinacija, interesi, kategorija) — 60 %. ② Kakovost profila lokalca (0–100). ③ Ocene uporabnikov (0–5 zvezdic). ④ Geografska bližina drugim lokacijam v itinererju. ⑤ Maksimalno 5 % boost za plačane partnerje — ne more preseči relevantnosti.",
      "Pravilo: AI nikoli ne priporoča slabega lokalca samo zato, ker plača. Lokalci z oceno pod 3,5 ne dobijo premium boost-a. Relevantnost (60 %) vedno dominira nad Premium (5 %).",
    ],
  },
  {
    id: "transparentnost",
    heading: "Transparentnost priporočil",
    paragraphs: [
      "Vsako AI priporočilo je jasno označeno — uporabnik ve, kaj je oglas in kaj organsko:",
      "Featured — preverjen partner z visoko kakovostjo profila in Premium članstvom (Quality Score > 90). Premium — partner podpira razvoj platforme in ima razširjen profil (boost max 5 %). Preverjeno — podatke je preverila ekipa Discover Slovenia AI. Affiliate — povezava, prek katere lahko Discover Slovenia AI prejme provizijo (vedno jasno označeno). Organsko — brezplačno priporočilo glede na relevantnost.",
    ],
  },
  {
    id: "podatki",
    heading: "Varstvo podatkov",
    paragraphs: [
      "GDPR skladnost: politika zasebnosti, piškotki, pravica do pozabe; DPA za premium partnerje.",
      "Brezplačno za uporabnike: uporabnik nikoli ne plača za AI funkcije — monetizacija samo prek ponudnikov.",
      "Brez posrednikov: AI poveže turista s ponudnikom; rezervacijo opravi turist direktno pri ponudniku.",
      "Audit log: vse admin akcije (odobritev, zavrnitev, sponzorstvo) so zabeležene in sledljive.",
    ],
  },
];

const EN: LegalSection[] = [
  {
    id: "partners",
    heading: "How we verify partners",
    paragraphs: [
      "Admin approval: every local spot must be manually approved by our team before publication. We check contact accuracy, category fit, image and description quality. Unapproved spots are invisible to users and cannot be recommended by the AI.",
      "Partner Quality Score (0–100): each spot gets an automatically computed score from 7 signals — profile completeness (30%), photo quality (15%), description quality (15%), AI tags (10%), admin verification (10%), ratings (10%), data freshness (10%). Badges: Verified (Q > 40), Premium (payer), Featured (Q > 90 + Premium + Verified).",
      "VLM image checks: all images are checked with a Vision Language Model — name matching, absence of watermarks, content quality and relevance.",
    ],
  },
  {
    id: "ranking",
    heading: "How AI ranking works",
    paragraphs: [
      "AI recommendations are based on 5 dimensions with clear weights. Payment cannot buy the top spot:",
      "① Match with the user's search (destination, interests, category) — 60%. ② Provider profile quality (0–100). ③ User ratings (0–5 stars). ④ Geographic proximity to other stops in the itinerary. ⑤ A maximum 5% boost for paying partners — it cannot outweigh relevance.",
      "Rule: the AI never recommends a bad spot just because it pays. Spots rated below 3.5 get no premium boost. Relevance (60%) always dominates Premium (5%).",
    ],
  },
  {
    id: "transparency",
    heading: "Recommendation transparency",
    paragraphs: [
      "Every AI recommendation is clearly labelled — users know what is an ad and what is organic:",
      "Featured — a verified partner with a high-quality profile and Premium membership (Quality Score > 90). Premium — a partner supporting the platform with an extended profile (max 5% boost). Verified — data checked by the Discover Slovenia AI team. Affiliate — a link through which Discover Slovenia AI may receive a commission (always clearly marked). Organic — a free recommendation based on relevance.",
    ],
  },
  {
    id: "data",
    heading: "Data protection",
    paragraphs: [
      "GDPR compliance: privacy policy, cookies, right to be forgotten; DPA for premium partners.",
      "Free for users: users never pay for AI features — monetization comes only from providers.",
      "No middlemen: the AI connects a traveller with a provider; the booking is made directly with the provider.",
      "Audit log: all admin actions (approval, rejection, sponsorship) are recorded and traceable.",
    ],
  },
];

export default function TrustSafetyPage() {
  const l = useLocale();
  return (
    <LegalPage
      title={pick(l, {
        sl: "Zaupanje in varnost",
        en: "Trust & safety",
      })}
      updated="2025"
      intro={pick(l, {
        sl: "Kako preverjamo partnerje, kako deluje AI ranking in kako varujemo tvoje podatke.",
        en: "How we verify partners, how AI ranking works and how we protect your data.",
      })}
      sections={l === "en" ? EN : SL}
    />
  );
}
