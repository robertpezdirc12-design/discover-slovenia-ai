"use client";

import {
  ArrowRight,
  Building2,
  Castle,
  Check,
  Droplets,
  Flower2,
  Landmark,
  Milestone,
  Mountain,
  MountainSnow,
  Sailboat,
  Search,
  Send,
  Sparkles,
  Trees,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { DestinationCard } from "@/components/destination-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  DATA_STATS,
  DESTINATIONS,
  DEST_TYPES,
  getFeaturedDestinations,
  type DestinationType,
} from "@/lib/slovenia-data";

/** Ikone tipov (Razišči po temah). */
const TYPE_ICONS: Record<DestinationType, React.ComponentType<{ className?: string }>> = {
  castle: Castle,
  cave: Landmark,
  city: Building2,
  coast: Waves,
  gorge: Milestone,
  lake: Droplets,
  mountain: MountainSnow,
  river: Sailboat,
  spa: Flower2,
};

const L = {
  heroKicker: { sl: "I Feel Slovenia", en: "I Feel Slovenia" },
  heroTitle: {
    sl: "Kaj želiš doživeti v Sloveniji?",
    en: "What do you want to experience in Slovenia?",
  },
  heroLead: {
    sl: "Napiši, kaj te veseli — odkrij 38 kuriranih destinacij Slovenije in zahodnega Balkana, sestavi načrt in pojdi.",
    en: "Write what you enjoy — discover 38 curated destinations across Slovenia and the Western Balkans, build a plan, and go.",
  },
  searchPlaceholder: {
    sl: "Iskanje: Bled, jama, Soča, obala …",
    en: "Search: Bled, cave, Soča, coast …",
  },
  searchLabel: { sl: "Iskanje destinacij", en: "Search destinations" },
  searchSubmit: { sl: "Poišči", en: "Search" },
  ctaPlan: { sl: "Načrtuj pot", en: "Plan a trip" },
  ctaExplore: { sl: "Razišči destinacije", en: "Explore destinations" },
  stats: {
    sl: {
      d: `${DATA_STATS.destinations} destinacij`,
      c: `${DATA_STATS.countries} države`,
      r: `${DATA_STATS.regions} regij`,
    },
    en: {
      d: `${DATA_STATS.destinations} destinations`,
      c: `${DATA_STATS.countries} countries`,
      r: `${DATA_STATS.regions} regions`,
    },
  },
  themesKicker: { sl: "Razišči po temah", en: "Explore by theme" },
  themesLead: {
    sl: "Od srednjeveških gradov do jadranske obale — vsaka tema je vstop v drugo Slovenijo.",
    en: "From medieval castles to the Adriatic coast — each theme is an entrance into a different Slovenia.",
  },
  themesCount: {
    sl: (n: number) => `${n} destinacij`,
    en: (n: number) => `${n} destinations`,
  },
  popularTitle: { sl: "Priljubljene destinacije", en: "Popular destinations" },
  popularLead: {
    sl: "Šest izpostavljenih krajev, ki jih uredništvo najpogosteje priporoča.",
    en: "Six featured places our editors recommend most often.",
  },
  itinerariesKicker: {
    sl: "Sestavi načrt v 30 sekundah",
    en: "Build a plan in 30 seconds",
  },
  itinerariesTitle: {
    sl: "Ali izberi preverjen itinerer",
    en: "Or pick a proven itinerary",
  },
  itinerariesLead: {
    sl: "Predlagane izhodiščne izbire za načrtovalnik — vsako prilagodiš v naslednjem koraku.",
    en: "Suggested starting points for the planner — each one adapts in the next step.",
  },
  checkTitle: { sl: "Preveri svoj načrt", en: "Check your plan" },
  checkLead: {
    sl: "Načrtovalnik išče prekrivanja, nemogoče razdalje in časovne konflikte — preden greš na pot.",
    en: "The planner catches overlaps, impossible distances and timing conflicts — before you leave.",
  },
  checkCta: { sl: "Preveri svoj načrt", en: "Check your plan" },
  newsletterTitle: {
    sl: "Prejmi skrite bisere Slovenije",
    en: "Receive Slovenia's hidden gems",
  },
  newsletterLead: {
    sl: "Enkrat mesečno: manj znane destinacije, sezonski nasveti in praktični vodniki. Brez vsiljene pošte.",
    en: "Once a month: lesser-known destinations, seasonal tips and practical guides. No spam.",
  },
  newsletterPlaceholder: { sl: "tvoja@email.si", en: "you@email.com" },
  newsletterLabel: { sl: "E-poštni naslov", en: "Email address" },
  newsletterSubmit: { sl: "Prijavi me", en: "Subscribe" },
  newsletterOk: {
    sl: "Prijavljeno! Preveri e-pošto za dobrodošlico.",
    en: "Subscribed! Check your inbox for a welcome.",
  },
  newsletterErr: {
    sl: "Prijava ni uspela — preveri e-poštni naslov.",
    en: "Subscription failed — please check your email address.",
  },
  endlessTitle: {
    sl: "Neskončne možnosti doživetij",
    en: "Endless possibilities of experiences",
  },
  endlessLead: {
    sl: "Vsi vklopi istega kanonskega nabora destinacij — 38 krajev, 20 regij, 4 države.",
    en: "All paths draw from the same canonical set of destinations — 38 places, 20 regions, 4 countries.",
  },
} as const;

/** Števci destinacij po tipu (enkraten izračun — fiksni kanonski nabor). */
function countByType(): Record<DestinationType, number> {
  const out = {} as Record<DestinationType, number>;
  for (const key of Object.keys(DEST_TYPES) as DestinationType[]) out[key] = 0;
  for (const d of DESTINATIONS) out[d.type] += 1;
  return out;
}
const DESTINATION_COUNTS = countByType();

/** Predlogi itinererjev (izhod na /nacrtuj?preset=…). */
const PRESETS = [
  {
    slug: "mirni-vikend-reka",
    sl: { title: "Miren vikend ob reki", body: "Soča ali Krka — počasen tempo, sprehodi in lokalna hrana." },
    en: { title: "A calm weekend by the river", body: "Soča or Krka — slow pace, walks and local food." },
  },
  {
    slug: "druzinski-izlet",
    sl: { title: "Družinski izlet danes", body: "Krajše razdalje, varne atrakcije in sladki zastanki." },
    en: { title: "Family day trip today", body: "Shorter distances, safe sights and sweet stops." },
  },
  {
    slug: "romantika-vino",
    sl: { title: "Romantičen vikend z vinom", body: "Vinske gorice, razgledi in večerja za dva." },
    en: { title: "Romantic wine weekend", body: "Wine hills, viewpoints and dinner for two." },
  },
  {
    slug: "izlet-brez-guzve",
    sl: { title: "Cenejši izlet brez gužve", body: "Manj znane točke izven vrhov sezone — za manj košarke." },
    en: { title: "Cheaper trip without crowds", body: "Lesser-known spots off the seasonal peaks." },
  },
  {
    slug: "lokalna-hrana",
    sl: { title: "Najboljša lokalna hrana", body: "Od kremšnite do štrukljev — postanki, kjer kuhajo doma." },
    en: { title: "Best local food", body: "From cream cake to štruklji — stops that cook like home." },
  },
] as const;

/** Doživetjski blok: 6 tem (povezave v raziskovalco z delujočimi filtri). */
const ENDLESS = [
  { icon: Mountain, q: "/destinacije?type=mountain", sl: "Pohodništvo", en: "Hiking" },
  { icon: Waves, q: "/destinacije?type=river", sl: "Vodne avanture", en: "Water adventures" },
  { icon: Landmark, q: "/destinacije?type=castle", sl: "Zgodovina & kultura", en: "History & culture" },
  { icon: Trees, q: "/destinacije?type=gorge", sl: "Narava & parki", en: "Nature & parks" },
  { icon: UtensilsCrossed, q: "/destinacije?q=hrana", sl: "Kulinarija", en: "Culinary" },
  { icon: Sparkles, q: "/destinacije?type=cave", sl: "Skrite dragulje", en: "Hidden gems" },
] as const;

export default function HomePage() {
  const l = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const t = (k: keyof typeof L) => pick(l, L[k]);
  const featured = React.useMemo(() => getFeaturedDestinations().slice(0, 6), []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/destinacije?q=${encodeURIComponent(q)}` : "/destinacije");
  };

  const onNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || !sending) {
      try {
        setSending(true);
        const res = await fetch("/api/newsletter/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast({ title: t("newsletterOk") });
        setEmail("");
      } catch {
        toast({ title: t("newsletterErr"), variant: "destructive" });
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <div className="w-full">
      {/* ======== HERO ======== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[#1e4f2d] text-white">
        {/* Dekorativni vzorec (radialne lise, brez zunanjih slik) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_12%),radial-gradient(circle_at_80%_60%,white_0,transparent_16%)]"
        />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <p className="text-xs font-bold tracking-[0.22em] text-white/80 uppercase">
            {t("heroKicker")}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
            {t("heroLead")}
          </p>

          {/* Iskanje */}
          <form
            onSubmit={onSearch}
            role="search"
            aria-label={t("searchLabel")}
            className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-xl bg-white/95 p-1.5 shadow-xl backdrop-blur"
          >
            <Search
              className="ml-2 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="hero-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <Input
              id="hero-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-11 border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              autoComplete="off"
            />
            <Button type="submit" className="h-11 shrink-0 px-4 sm:px-6">
              {t("searchSubmit")}
            </Button>
          </form>

          {/* CTA gumba */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="tap-target font-semibold"
            >
              <Link href="/nacrtuj">
                {t("ctaPlan")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="tap-target border-white/50 bg-transparent font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/destinacije">{t("ctaExplore")}</Link>
            </Button>
          </div>

          {/* Statistika nabora */}
          <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-white/85">
            {(["d", "c", "r"] as const).map((k, i) => (
              <React.Fragment key={k}>
                {i > 0 && (
                  <span aria-hidden="true" className="hidden text-white/50 sm:inline">
                    ·
                  </span>
                )}
                <div className="flex items-baseline gap-1">
                  <dt className="sr-only">{k}</dt>
                  <dd>{pick(l, L.stats)[k]}</dd>
                </div>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </section>

      {/* ======== RAZIŠČI PO TEMAH ======== */}
      <section aria-labelledby="teme" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="teme" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("themesKicker")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("themesLead")}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9 lg:gap-2">
          {(Object.keys(DEST_TYPES) as DestinationType[]).map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <Link
                key={type}
                href={`/destinacije?type=${type}`}
                className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">{pick(l, DEST_TYPES[type])}</span>
                <span className="text-[11px] text-muted-foreground">
                  {pick(l, L.themesCount)(DESTINATION_COUNTS[type] ?? 0)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ======== PRILJUBLJENE DESTINACIJE ======== */}
      <section
        aria-labelledby="priljubljene"
        className="bg-muted/40 py-14"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="priljubljene" className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("popularTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">{t("popularLead")}</p>
            </div>
            <Link
              href="/destinacije"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t("ctaExplore")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((d, i) => (
              <DestinationCard key={d.slug} d={d} priority={i < 3} />
            ))}
          </div>
        </div>
      </section>

      {/* ======== PREVERJENI ITINERERJI ======== */}
      <section
        aria-labelledby="itinererji"
        className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
          {t("itinerariesKicker")}
        </p>
        <h2 id="itinererji" className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("itinerariesTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("itinerariesLead")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PRESETS.map((p) => (
            <Link
              key={p.slug}
              href={`/nacrtuj?preset=${p.slug}`}
              className="group flex min-h-36 flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div>
                <h3 className="text-base font-bold leading-snug group-hover:text-primary">
                  {p[l].title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{p[l].body}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                {t("ctaPlan")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ======== PREVERI SVOJ NAČRT (zamegljen blok) ======== */}
      <section aria-labelledby="preveri" className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 sm:p-10">
          {/* Zamegljena "predogledna" vsebina (dekoracija, ne berljiva) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 select-none blur-[3px] [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
          >
            <div className="flex h-full flex-col justify-center gap-3 px-6 opacity-40">
              <div className="h-3 w-3/5 rounded bg-primary/40" />
              <div className="h-3 w-4/5 rounded bg-muted-foreground/30" />
              <div className="h-3 w-2/3 rounded bg-muted-foreground/30" />
              <div className="h-3 w-1/2 rounded bg-muted-foreground/30" />
            </div>
          </div>
          <div className="relative max-w-xl">
            <h2 id="preveri" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("checkTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("checkLead")}</p>
            <Button asChild className="mt-6 tap-target font-semibold">
              <Link href="/nacrtuj">
                {t("checkCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ======== NEWSLETTER ======== */}
      <section aria-labelledby="newsletter" className="border-t bg-muted/40 py-14">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Send className="size-5" aria-hidden="true" />
          </span>
          <h2 id="newsletter" className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("newsletterTitle")}
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">{t("newsletterLead")}</p>
          <form
            onSubmit={onNewsletter}
            className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              {t("newsletterLabel")}
            </label>
            <Input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("newsletterPlaceholder")}
              autoComplete="email"
              className="h-11 flex-1"
            />
            <Button type="submit" disabled={sending} className="h-11 font-semibold">
              {sending ? "…" : t("newsletterSubmit")}
            </Button>
          </form>
        </div>
      </section>

      {/* ======== NESKONČNE MOŽNOSTI ======== */}
      <section
        aria-labelledby="neskoncne"
        className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <h2 id="neskoncne" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("endlessTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("endlessLead")}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ENDLESS.map((theme) => {
            const Icon = theme.icon;
            return (
              <Link
                key={theme.sl}
                href={theme.q}
                className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold">{l === "en" ? theme.en : theme.sl}</span>
              </Link>
            );
          })}
        </div>
        <Card className="mt-10 border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-5">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {pick(l, {
                sl: "Iskrenostni kanon: vsi prikazi (ocena, vir, cena) prihajajo iz kanonskega nabora 38 destinacij z zapisanim izvorom — nič ni izmišljeno.",
                en: "Honesty canon: every displayed value (rating, source, price) comes from the canonical set of 38 destinations with recorded provenance — nothing is invented.",
              })}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
