"use client";

import { Check, Sparkles } from "lucide-react";
import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /za-ponudnike — 1:1 po produkciji (kako deluje, paketi, beta ugodnosti).
 * Prijavnica (Lead) pride v vsebinski fazi; CTA vodi na /kontakt.
 */
export default function ForProvidersPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Brezplačno v beta fazi", en: "Free during beta" },
    title: { sl: "Za ponudnike", en: "For providers" },
    lead: {
      sl: "Ko turist vpraša AI, najde vas. Discover Slovenia AI je med prvimi AI-poganjanimi turističnimi platformami za Slovenijo — turist napiše, kaj želi, AI sestavi dan in priporoči vaš lokal. Rezervacijo opravi turist direktno pri vas.",
      en: "When a traveller asks the AI, it finds you. Discover Slovenia AI is among the first AI-powered tourism platforms for Slovenia — the traveller writes what they want, the AI builds the day and recommends your venue. The booking is made directly with you.",
    },
    howTitle: { sl: "Kako AI prinese goste", en: "How the AI brings guests" },
    steps: {
      sl: [
        "Turist vpraša — napiše, kaj želi doživeti v Sloveniji.",
        "AI najde vas — ranking engine primerja in priporoči.",
        "Turist klikne — vidi vaš profil, zgodbo, kontakt.",
        "Kontakt — turist vas pokliče ali obišče spletno stran; rezervacija pri vas.",
      ],
      en: [
        "The traveller asks — writes what they want to experience in Slovenia.",
        "The AI finds you — the ranking engine compares and recommends.",
        "The traveller clicks — sees your profile, story, contact.",
        "Contact — the traveller calls or visits your website; the booking is yours.",
      ],
    },
    packagesTitle: { sl: "Paketi", en: "Packages" },
    packagesLead: {
      sl: "Registracija in osnovni paket sta brezplačna — turisti nikoli ne plačujejo. Med beta obdobjem so vsi paketi brezplačni.",
      en: "Registration and the basic package are free — travellers never pay. During the beta period all packages are free.",
    },
    contactCta: { sl: "Prijavi svoj lokal", en: "Register your venue" },
    benefitsTitle: { sl: "Kaj dobite kot partner", en: "What you get as a partner" },
    benefits: {
      sl: [
        "Verified Badge — znak „Preverjen partner“, ki ga podelijo uredniki po pregledu",
        "AI optimizacija — avtomatski SEO meta, ključne besede in tagi",
        "Statistika — ogledi, kliki, AI priporočila, kontakti, ROI",
        "Povpraševanja gostov — obrazec na vašem profilu, viden v statistiki",
        "Atribucija rezervacij — rezervacije iz AI konzultacij se zapišejo vam",
        "AI zgodba — čustvena zgodba o vašem podjetju",
      ],
      en: [
        "Verified Badge — the “Verified partner” badge awarded by our editors after review",
        "AI optimisation — automatic SEO meta, keywords and tags",
        "Analytics — views, clicks, AI recommendations, contacts, ROI",
        "Guest enquiries — a form on your profile, visible in your statistics",
        "Booking attribution — bookings from AI consultations are attributed to you",
        "AI story — an emotive story about your business",
      ],
    },
    betaTitle: { sl: "Postani ustanovni partner", en: "Become a founding partner" },
    betaLead: {
      sl: "Med beta obdobjem je platforma brezplačna — prvih 30 lokalov gradi temelje in obdrži ugodnosti (brezplačen premium paket, vrednost €149/mes, brez obveznosti).",
      en: "During the beta period the platform is free — the first 30 venues build the foundations and keep the benefits (a free premium package worth €149/mo, no obligation).",
    },
    ruleTitle: { sl: "Naša obljuba", en: "Our promise" },
    ruleBody: {
      sl: "Zaupanje gradimo z dejstvi, ne z izmišljenimi pričevanji: mnenja gostov bomo objavili samo z dokazano rezervacijo. 0 % provizije na direktnih rezervacijah; 12 % samo na AI-generiranih — vsak obračun vsebuje podrobnosti posamezne rezervacije.",
      en: "We build trust with facts, not invented testimonials: guest reviews are published only with a proven booking. 0% commission on direct bookings; 12% only on AI-generated ones — every statement lists the details of each booking.",
    },
  } as const;

  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);
  const S = pick(l, L.steps);
  const B = pick(l, L.benefits);
  // Paketi imajo le { sl, en } vnose — za it/de/fr/es varno nazaj na sl.
  const lang = l === "en" ? ("en" as const) : ("sl" as const);

  const packages = [
    {
      name: { sl: "Osnovni", en: "Basic" },
      price: "€0",
      note: { sl: "za vedno brezplačno", en: "free forever" },
      features: {
        sl: ["Osnovni profil lokala", "Prikaz v AI konzultacijah", "12 % provizija na AI rezervacije", "Mesečni račun (PDF)"],
        en: ["Basic venue profile", "Listed in AI consultations", "12% commission on AI bookings", "Monthly statement (PDF)"],
      },
      featured: false,
    },
    {
      name: { sl: "Premium", en: "Premium" },
      price: "€149",
      note: { sl: "/mesec — brezplačno med beto", en: "/mo — free during beta" },
      features: {
        sl: ["0 % provizija — vključeno", "5 % rangirni boost", "Premium znak", "Citiranje v AI konzultacijah", "Polna statistika", "AI vpogledi"],
        en: ["0% commission — included", "5% ranking boost", "Premium badge", "Quoted in AI consultations", "Full statistics", "AI insights"],
      },
      featured: true,
    },
    {
      name: { sl: "Enterprise", en: "Enterprise" },
      price: "€499",
      note: { sl: "/mesec — brezplačno med beto", en: "/mo — free during beta" },
      features: {
        sl: ["Vse iz Premium", "0 % provizija", "Več lokalov na enem računu", "Namenska podpora", "API dostop"],
        en: ["Everything in Premium", "0% commission", "Multiple venues on one account", "Dedicated support", "API access"],
      },
      featured: false,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        kicker={t("kicker")}
        title={t("title")}
        lead={t("lead")}
      />

      <div className="mt-8">
        <Button asChild size="lg" className="tap-target font-semibold">
          <Link href="/kontakt">{t("contactCta")}</Link>
        </Button>
      </div>

      {/* Kako deluje */}
      <h2 className="mt-12 text-xl font-bold tracking-tight">{t("howTitle")}</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {S.map((step, i) => (
          <li key={i} className="rounded-xl border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step}</p>
          </li>
        ))}
      </ol>

      {/* Paketi */}
      <h2 className="mt-12 text-xl font-bold tracking-tight">{t("packagesTitle")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("packagesLead")}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {packages.map((p) => (
          <Card
            key={p.name[lang]}
            className={p.featured ? "border-primary shadow-md ring-1 ring-primary/30" : undefined}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{p.name[lang]}</CardTitle>
                {p.featured && (
                  <Badge className="bg-primary text-primary-foreground">
                    <Sparkles className="mr-1 size-3" aria-hidden="true" />
                    {pick(l, { sl: "Priljubljen", en: "Popular" })}
                  </Badge>
                )}
              </div>
              <p className="mt-2">
                <span className="text-3xl font-bold">{p.price}</span>{" "}
                <span className="text-xs text-muted-foreground">{p.note[lang]}</span>
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {p.features[lang].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Koristi */}
      <h2 className="mt-12 text-xl font-bold tracking-tight">{t("benefitsTitle")}</h2>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {B.map((b) => (
          <li key={b} className="flex items-start gap-2 rounded-lg border bg-card p-3.5 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">{b}</span>
          </li>
        ))}
      </ul>

      {/* Beta + obljuba */}
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">{t("betaTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("betaLead")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ruleTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("ruleBody")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
