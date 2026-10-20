import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Zasebnost in podatki · Discover Slovenia AI',
  description:
    'Katere podatke shranjuje Discover Slovenia AI, kje so shranjeni, kako jih izvoziš ali izbrišeš in kateri zunanji viri se uporabljajo.',
  alternates: { canonical: '/zasebnost' },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        ← Nazaj na začetek
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Zasebnost in podatki</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Ta stran opisuje, katere podatke shranjuje Discover Slovenia AI in kaj
        lahko z njimi storiš. Aplikacija je zasnovana local-first: brez prijave
        vodeni tok in rezervacije ostanejo v tvojem brskalniku.
      </p>

      <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm leading-6">
        <strong className="font-medium">Demo različica.</strong> Prijava z
        e-poštno povezavo deluje, a to še ni pravno dokončana politika
        zasebnosti. Pred javnim zagonom je treba dopolniti upravljavca, kontakt
        in pravno podlago obdelave.
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Kaj ostane v brskalniku</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>odgovori vodenega toka (interesi, regija, dnevi, tempo),</li>
          <li>rezervirana prenočišča in nastavitev govornih nasvetov,</li>
          <li>lokalna nastavitev prikaza lidarja.</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Vodič je v <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code>{' '}
          pod ključem <code className="rounded bg-muted px-1 py-0.5 text-xs">dsa.guide.v1</code>;
          nastavitev lidarja je shranjena ločeno. Vodič in rezervacije počistiš z
          »Začni znova« v vodenem toku; vse lokalne nastavitve pa z nastavitvami
          brskalnika.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Kaj shranimo na strežniku</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Šele ko se prijaviš, se v PostgreSQL shranijo:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>e-poštni naslov, uporabljen za prijavo,</li>
          <li>prikazno ime (privzeto del e-poštnega naslova pred @),</li>
          <li>sanitizirano stanje vodenega toka in rezervacije,</li>
          <li>nastavitev govornih nasvetov (del stanja vodiča),</li>
          <li>naključni sejni žeton v piškotku in njegov SHA-256 hash v bazi,</li>
          <li>hash enkratne prijavne povezave; po uporabi ali poteku ga odstranimo, najpozneje z dnevnim čiščenjem.</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ne shranjujemo gesla, telefonske številke ali podatkov o plačilu.
          E-pošte ne uporabljamo za oglaševanje. V profil ne vnašaj občutljivih
          podatkov.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Prijava in e-pošta</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Prijava poteka z enkratno povezavo, ki jo prejmeš na e-pošto. Povezava
          velja 15 minut in jo je mogoče uporabiti samo enkrat. V bazi hranimo le
          njen hash, ne surovega žetona. Za dostavo sporočila uporabljamo
          ponudnika Resend, ki prejme tvoj e-poštni naslov in vsebino sporočila.
          Če povezave ne zahtevaš, je ne odpri; povezava sama poteče.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Piškotki in seja</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Uporabljamo en piškotek, <code className="rounded bg-muted px-1 py-0.5 text-xs">dsa_session</code>.
          Je <code className="rounded bg-muted px-1 py-0.5 text-xs">httpOnly</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">SameSite=Lax</code>, v produkciji{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">Secure</code> in velja 30 dni.
          Oglaševalskih ali analitičnih sledilcev ni.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Zunanji viri</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Za zemljevid, iskanje, pot, vreme in kakovost zraka uporabljamo
          OpenStreetMap/Nominatim, OSRM, ARSO in Open-Meteo. Poizvedbe lahko
          vsebujejo iskalni niz ali koordinate, ne pa tvojega imena ali seje.
          Fotografije prenočišč se v demo okolju posredujejo prek strežniškega
          proxyja. Prijavno e-pošto dostavlja Resend.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Deljene poti</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ko ustvariš deljeno pot, se posnetek načrta shrani pod kratko kodo.
          Vsak, ki ima povezavo, jo lahko vidi. Deljena pot ni vezana na tvoj
          profil in se z izbrisom profila ne odstrani. Povezava samodejno
          poteče po 90 dneh; potekel zapis počisti dnevno čiščenje, obisk
          potekle povezave ali naslednje deljenje. Ne deli poti z občutljivimi
          podatki.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Izvoz in izbris</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          V odprtem profilu lahko preneseš svoje strežniške podatke v JSON ali
          trajno izbrišeš profil. Izbris odstrani e-pošto, uporabnika, seje,
          prijavne povezave, vodič in rezervacije iz baze. Lokalni vodič v
          brskalniku ostane, dokler ga ne počistiš sam. Odjava prekliče samo
          sejo v tem brskalniku; profil ostane in se z e-poštno prijavo obnovi.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Profili z e-pošto ostanejo, dokler jih ne izbrišeš. Stari demo
          profili brez e-pošte, ki nimajo več veljavne seje, se počistijo po
          največ 60 dneh od zadnje aktivnosti.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Vprašanja</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Aplikacija je v demo fazi. Kontakt za vprašanja o podatkih bo objavljen
          pred javnim zagonom; do takrat ne objavljaj osebnih podatkov v javnih
          kanalih projekta.
        </p>
      </section>

      <p className="mt-10 border-t pt-5 text-xs text-muted-foreground">
        Nazadnje posodobljeno: 20. oktober 2026
      </p>
    </main>
  );
}
