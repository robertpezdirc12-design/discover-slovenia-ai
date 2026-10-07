"use client";

import { ArrowRight, Banknote, Building2, HardDrive, LineChart, Percent, Users } from "lucide-react";
import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

/**
 * /owner — vstop v portal za lastnike lokalov (produkcija: /owner/prijava).
 * Povezuje prijavo portala in stran za ponudnike + iskreno stanje.
 */
export default function OwnerPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Za lastnike lokalov", en: "For venue owners" },
    title: { sl: "Portal za lastnike lokalov", en: "Venue owner portal" },
    lead: {
      sl: "Upravljajte svoje lokale, spremljajte statistiko in bodite vidni obiskovalcem, ki načrtujejo potovanje z AI.",
      en: "Manage your venues, track statistics and be visible to travellers who plan their trips with AI.",
    },
    login: { sl: "Prijava v portal", en: "Sign in to the portal" },
    register: { sl: "Registracija", en: "Register" },
    featuresTitle: { sl: "Kaj portal omogoča", en: "What the portal enables" },
    features: {
      sl: [
        { h: "Upravljanje lokalov", b: "Urejajte podatke, odpiralne čase in ponudbo svojih lokalov." },
        { h: "Statistika obiskov", b: "Spremljajte, kako vaš lokal nastopa v načrtih in raziskovanju." },
        { h: "Vidnost v načrtih", b: "Bodite vidni obiskovalcem, ki z AI načrtujejo potovanja po Sloveniji." },
      ],
      en: [
        { h: "Venue management", b: "Edit the details, opening hours and offer of your venues." },
        { h: "Visit statistics", b: "Track how your venue performs in plans and exploration." },
        { h: "Visibility in plans", b: "Be visible to travellers planning trips around Slovenia with AI." },
      ],
    },
    partnersTitle: { sl: "Za ponudnike", en: "For providers" },
    partnersBody: {
      sl: "Portal je del ponudniške plasti platforme — vse o partnerstvu, paketih in prijavnici najdeš na strani za ponudnike.",
      en: "The portal is part of the platform's provider layer — everything about partnership, packages and the application form is on the providers page.",
    },
    partnersCta: { sl: "Stran za ponudnike", en: "Providers page" },
    provTitle: { sl: "Provizije in klikanja", en: "Commissions and clicks" },
    provBody: {
      sl: "Nadzorna plošča za skrbnike: statistika klikanja na partnerske povezave in provizijski dnevnik iz poročil partnerjev (dostop omejen na DSA_ADMIN_EMAILS).",
      en: "Admin dashboard: click statistics for partner links and the commission journal from partner reports (access limited to DSA_ADMIN_EMAILS).",
    },
    provCta: { sl: "Odpri ploščo", en: "Open the dashboard" },
    payoutTitle: { sl: "Izplačila lastne tržnice", en: "Own marketplace payouts" },
    payoutBody: {
      sl: "Življenjski cikel izplačil naročil (še ne zapadlo → zapadlo → v teku → izplačano), zahtevki kupca po preklicu in revizijski dnevnik.",
      en: "Order payout lifecycle (not yet due → due → processing → paid), customer cancellation requests and the audit log.",
    },
    statusTitle: { sl: "Stanje v tej rekonstrukciji", en: "Status in this reconstruction" },
    statusBody: {
      sl: "Prijava v portal (e-pošta + geslo) je v produkciji ločena stran; njeno podlogo smo rekonstruirali 1:1, a brez pravega avtentikacijskega strežnika v sandboxu — obrazec je prikaz, povezave in vsebine pa so resnične.",
      en: "The portal sign-in (email + password) is a separate page in production; we reconstructed its shell 1:1, but without a real authentication server in the sandbox — the form is a display, while links and content are real.",
    },
  } as const;

  const featureIcons = [Building2, LineChart, Users];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild className="tap-target font-semibold">
          <Link href="/owner/prijava">
            {pick(l, L.login)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="tap-target font-semibold">
          <Link href="/owner/prijava">{pick(l, L.register)}</Link>
        </Button>
      </div>

      <section aria-labelledby="owner-features" className="mt-12">
        <h2 id="owner-features" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.featuresTitle)}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {pick(l, L.features).map((f, i) => {
            const Icon = featureIcons[i] ?? Building2;
            return (
              <Card key={f.h}>
                <CardContent className="p-5">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-bold sm:text-base">{f.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.b}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="mt-12 border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            {pick(l, L.partnersTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>{pick(l, L.partnersBody)}</p>
          <Button asChild variant="outline" size="sm" className="mt-4 font-semibold">
            <Link href="/za-ponudnike">
              {pick(l, L.partnersCta)}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Skrbniška nadzorna plošča: provizije in klikanja (2.5.0) */}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Percent className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{pick(l, L.provTitle)}</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {pick(l, L.provBody)}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 font-semibold">
            <Link href="/owner/provizije">
              {pick(l, L.provCta)}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          <Banknote className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{pick(l, L.payoutTitle)}</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.payoutBody)}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 font-semibold">
            <Link href="/owner/izplacila">
              {pick(l, L.provCta)}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          <HardDrive className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{pick(l, L.statusTitle)}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {pick(l, L.statusBody)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
