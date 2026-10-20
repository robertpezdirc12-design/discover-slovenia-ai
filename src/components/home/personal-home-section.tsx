import { Heart, MapPin, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { sanitizeGuideState } from '@/lib/guide-store';
import { buildPersonalSuggestions } from '@/lib/personalization';

/**
 * PersonalHomeSection (server component, streamirana).
 *
 * Priporočila se izračunajo iz RESNIČNEGA profila (interesi, regija, tempo,
 * rezervacije), sinhroniziranega prek /api/profile. Ni več umetnega čakanja
 * ali fiksnih odstotkov.
 *
 * CLS = 0 pogoj: skeleton (PersonalHomeSkeleton) in ta sekcija imata
 * IDENTIČNO strukturo in fiksne višine (h-7 naslov, h-[164px] kartice).
 */

const CARD_ICONS = [MapPin, Sparkles, Heart] as const;

async function loadPersonalData(userId: string) {
  try {
    const [profile, reservations] = await withDbTimeout(
      Promise.all([
        db.userProfile.findUnique({ where: { userId } }),
        db.stayReservation.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { name: true },
        }),
      ]),
      3_500,
    );

    return {
      ok: true,
      guide: sanitizeGuideState(profile?.guideData ?? null),
      reservedNames: reservations.map((r) => r.name),
    };
  } catch {
    return { ok: false, guide: null, reservedNames: [] as string[] };
  }
}

export async function PersonalHomeSection({
  name,
  userId,
}: {
  name: string;
  userId: string;
}) {
  const { ok, guide, reservedNames } = await loadPersonalData(userId);
  const suggestions = buildPersonalSuggestions({ guide, reservedNames, limit: 3 });

  return (
    <section id="osebno" aria-labelledby="personal-heading" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 sm:px-6">
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

          <p className="mt-1 min-h-10 text-sm text-muted-foreground sm:min-h-5">
            Priporočila iz tvojih odgovorov v vodenem toku.
          </p>

          {suggestions.length > 0 ? (
            <div className="mt-4 grid min-h-[524px] gap-4 sm:min-h-[164px] sm:grid-cols-3">
              {suggestions.map((s, i) => {
                const Icon = CARD_ICONS[i % CARD_ICONS.length];
                return (
                  <Card key={s.id} className="h-[164px] gap-0 py-0">
                    <CardContent className="flex h-full flex-col gap-1 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">
                          {s.match} % ujemanje
                        </Badge>
                      </div>
                      <p className="font-medium leading-tight">
                        {s.name}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          · {s.regionLabel}
                        </span>
                      </p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{s.note}</p>
                      {s.reasons.length > 0 && (
                        <p className="mt-auto line-clamp-1 text-xs text-emerald-700">
                          {s.reasons.join(' · ')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 grid min-h-[524px] gap-4 sm:min-h-[164px] sm:grid-cols-3">
              <Card className="h-full min-h-[164px] gap-0 py-0 sm:col-span-3">
                <CardContent className="flex h-full flex-col justify-center gap-2 p-4">
                  <p className="font-medium">
                    {ok ? 'Tvoja priporočila se še gradijo.' : 'Priporočil trenutno ni mogoče naložiti.'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ok
                      ? 'Izberi interese in regijo v vodenem toku — nato jih povežem s tvojo potjo in rezervacijami.'
                      : 'Baza je trenutno nedosegljiva. Osveži stran ali poskusi pozneje.'}
                  </p>
                  {ok && (
                    <Button asChild size="sm" variant="outline" className="w-fit">
                      <a href="#vodic">Odpri vodeni tok</a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
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
          <Skeleton className="mt-1 h-10 w-64 sm:h-5" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[164px] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
