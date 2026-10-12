import { Heart, MapPin, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * POLIR15-c — PersonalHomeSection (server component, streamirana).
 *
 * Produkcija: parent počne `const session = await getSession()` ENKRAT
 * (React `cache()` dedup — brez waterfalla) in podaja le `userId`.
 * Sekcija je asinhrona in se lovi prek <Suspense> v page.tsx.
 *
 * CLS = 0 pogoj: skeleton (PersonalHomeSkeleton) in ta sekcija imata
 * IDENTIČNO strukturo in fiksne višine (h-7 naslov, h-[140px] kartice).
 */

const SUGGESTIONS = [
  { name: 'Bled', match: '94 %', note: 'Ker si si ogledal alpska jezera', icon: MapPin },
  { name: 'Dolina Soče', match: '88 %', note: 'Ker zanimajo te adrenalinske poti', icon: Sparkles },
  { name: 'Piran', match: '81 %', note: 'Ker si bral o solinah in zalivu', icon: Heart },
] as const;

async function loadSuggestions() {
  // simulacija DB/API klica (v produkciji: prisma query po userId)
  await new Promise((r) => setTimeout(r, 900));
  return SUGGESTIONS;
}

export async function PersonalHomeSection({ name }: { name: string }) {
  const suggestions = await loadSuggestions();

  return (
    <section id="osebno" aria-labelledby="personal-heading" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="rounded-xl border bg-card">
        <div className="p-6">
          <div className="flex h-7 items-center gap-2">
            <Sparkles className="size-5 text-emerald-600" aria-hidden />
            <h2 id="personal-heading" className="truncate text-lg font-semibold tracking-tight">
              Dobrodošli nazaj, {name}!
            </h2>
            <Badge variant="secondary" className="ml-auto shrink-0">
              osebno
            </Badge>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Priporočila na podlagi tvojih zadnjih ogledov.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {suggestions.map((s) => (
              <Card key={s.name} className="h-[140px]">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                      <s.icon className="size-4" aria-hidden />
                    </span>
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">{s.match} ujemanje</Badge>
                  </div>
                  <p className="font-medium leading-tight">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Rezerviran prostor z ISTO strukturo → zamenjava ne premakne ničesar (CLS 0). */
export function PersonalHomeSkeleton() {
  return (
    <section aria-hidden className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="rounded-xl border bg-card">
        <div className="p-6">
          <div className="flex h-7 items-center gap-2">
            <Skeleton className="size-5 rounded-md" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-64" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[140px] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
