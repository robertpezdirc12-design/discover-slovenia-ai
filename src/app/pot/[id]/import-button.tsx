'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  GUIDE_EVENT,
  loadGuideState,
  saveGuideState,
  type GuideState,
} from '@/lib/guide-store';
import { hasOwnPlan, importSharedState, parseSharedTrip } from '@/lib/share-trip';

/**
 * Uvoz deljene poti v prejemnikov vodeni tok.
 *
 * Varnost: payload PONOVNO sanitiziramo na klientu (defense in depth —
 * strežnik ga je že sanitiziral, ne zaupamo pa niti sebi).
 * Če prejemnik že ima lasten načrt, vprašamo (nikoli tiho ne prepišemo).
 */
export function ImportSharedTripButton({ payload }: { payload: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const importTrip = () => {
    const incoming = parseSharedTrip(payload);
    if (!incoming) {
      toast({
        title: 'Pot ni več veljavna',
        description: 'Deljena pot je okvarjena — zaprosi za novo povezavo.',
      });
      return;
    }

    let current: GuideState | null = null;
    try {
      current = loadGuideState(window.localStorage);
    } catch {
      current = null;
    }

    if (hasOwnPlan(current)) {
      const proceed = window.confirm(
        'To bo zamenjalo tvoj trenutni načrt. Nadaljujem?',
      );
      if (!proceed) return;
    }

    try {
      saveGuideState(window.localStorage, importSharedState(current, incoming));
      window.dispatchEvent(new Event(GUIDE_EVENT));
    } catch {
      toast({
        title: 'Shramba ni na voljo',
        description:
          'Brskalnik ne dovoli shranjevanja. Omogoči shrambo ali poskusi v drugem brskalniku.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Pot uvožena',
      description: 'Tvoja pot je na zemljevidu — vodič te vodi naprej.',
    });
    setBusy(true);
    router.push('/#zemljevid');
  };

  return (
    <Button
      size="lg"
      className="h-11 w-full text-base sm:h-10"
      onClick={importTrip}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <MapIcon className="size-4" aria-hidden />
      )}
      {busy ? 'Odpiram zemljevid …' : 'Odpri to pot pri sebi'}
    </Button>
  );
}
