import { Compass, Globe, MapPinned, Route } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Uporabniška sekcija "Vse v enem mestu":
 * Štiri konkretne zmožnosti platforme v jeziku uporabnika
 * (vodič, pot, prenočišča, odprti podatki). Višina kartic je
 * rezervirana (CLS 0).
 */
const ZMOZNOSTI = [
  {
    id: 'vodic',
    icon: Compass,
    title: 'Vodič po zemljevidu',
    desc: 'En klik: samodejna turneja po 31 krajih Balkana — z glasom, napredkom in filtri.',
  },
  {
    id: 'pot',
    icon: Route,
    title: 'Moja pot',
    desc: 'Shrani destinacije in prenočišča, nato se po dejanskih cestah (OSRM) pelji od točke do točke.',
  },
  {
    id: 'prenočišča',
    icon: MapPinned,
    title: 'Prenočišča v enem kliku',
    desc: 'Išči po celem Balkanu, filtriraj apartmaje in hotele, ceno poglej v lokalni valuti in shrani v pot.',
  },
  {
    id: 'odprti-podatki',
    icon: Globe,
    title: 'Odprti podatki',
    desc: 'Vreme in zrak, višine, Wikipedija, tečaji in prazniki — brez prijave, z navedenimi viri.',
  },
] as const;

export function ZmoznostiSection() {
  return (
    <section
      id="zmoznosti"
      aria-labelledby="zmoznosti-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 sm:px-6"
    >
      <h2 id="zmoznosti-heading" className="text-lg font-semibold tracking-tight">
        Vse v enem mestu
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ZMOZNOSTI.map((z) => (
          <Card key={z.id} className="h-[168px]">
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                <z.icon className="size-4" aria-hidden />
              </span>
              <p className="font-medium leading-tight">{z.title}</p>
              <p className="text-sm text-muted-foreground">{z.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
