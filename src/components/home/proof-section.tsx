import { MousePointerClick, RefreshCw, Ruler, Trees } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const PROOFS = [
  {
    id: 'POLIR15-a',
    icon: MousePointerClick,
    title: 'Sticky preklop nad Leafletom',
    desc: 'Mapa je zaprta v stacking context (z-0 isolate); preklop ostane klikaben pri drsenju (z-30).',
  },
  {
    id: 'POLIR15-b',
    icon: Trees,
    title: 'Sezonska afiniteta heroja',
    desc: 'SSR resolver po MMDD oknih + izvorni SI mikro-dogodki (martinovanje, kurentovanje, december).',
  },
  {
    id: 'POLIR15-c',
    icon: RefreshCw,
    title: 'PersonalHomeSection brez premika',
    desc: 'Session enkrat (cache + Promise.all), sekcija streamirana prek Suspense z rezervirano višino.',
  },
  {
    id: 'POLIR15-d',
    icon: Ruler,
    title: 'CLS skeleta zemljevida = 0',
    desc: 'Enoten vir višine (h-[420px]/md:h-[520px]); skeleton in vsebina sta absolutna znotraj škatle.',
  },
] as const;

export function ProofSection() {
  return (
    <section id="polir15" aria-labelledby="polir15-heading" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="flex h-7 items-center">
        <h2 id="polir15-heading" className="text-lg font-semibold tracking-tight">
          Kaj ta stran dokazuje
        </h2>
        <Badge variant="outline" className="ml-3">
          cikel POLIR15
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROOFS.map((p) => (
          <Card key={p.id} className="h-[168px]">
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                  <p.icon className="size-4" aria-hidden />
                </span>
                <Badge variant="secondary">{p.id}</Badge>
              </div>
              <p className="font-medium leading-tight">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
