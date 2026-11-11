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
} from '@/lib/guide-store';
import {
  hasOwnPlan,
  importSharedState,
  parseSharedTrip,
  sharedStopOrder,
} from '@/lib/share-trip';
import { TRIP_ORDER_EVENT, TRIP_ORDER_KEY, withRegionStopOrder } from '@/lib/trip-order';

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
    const current = loadGuideState(window.localStorage);
    if (hasOwnPlan(current)) {
      const proceed = window.confirm(
        'To bo zamenjalo tvoj trenutni načrt. Nadaljujem?',
      );
      if (!proceed) return;
    }
    saveGuideState(window.localStorage, importSharedState(current, incoming));
    const stopOrder = sharedStopOrder(payload);
    let orderSaved = true;
    if (incoming.region && stopOrder) {
      try {
        const next = withRegionStopOrder(
          window.localStorage.getItem(TRIP_ORDER_KEY),
          incoming.region,
          stopOrder,
        );
        if (next === null) window.localStorage.removeItem(TRIP_ORDER_KEY);
        else window.localStorage.setItem(TRIP_ORDER_KEY, next);
      } catch {
        orderSaved = false;
      }
      if (orderSaved) window.dispatchEvent(new Event(TRIP_ORDER_EVENT));
    }
    window.dispatchEvent(new Event(GUIDE_EVENT));
    toast({
      title: 'Pot uvožena',
      description: orderSaved
        ? 'Tvoja pot je na zemljevidu — vodič te vodi naprej.'
        : 'Pot je uvožena, vendar prilagojenega vrstnega reda postankov ni bilo mogoče shraniti.',
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
