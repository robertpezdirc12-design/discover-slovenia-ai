'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { GuideState } from '@/lib/guide-store';
import { tripHeadline } from '@/lib/share-trip';

/**
 * "Deli pot" — delitvena povezava za "Mojo pot" (Wanderlogov vzorec).
 *
 * POST na /api/pot/share → kratka povezava /pot/[koda] →
 * ① mobilni Web Share API, ② odložišče + toast, ③ če je odložišče
 * blokirano (iframe predogled, pravice) → pogovorno okno s povezavo za
 * ročno kopiranje. Nikoli slepa ulica: povezava je ustvarjena in VEDNO
 * dosegljiva uporabniku.
 */
export function ShareTripButton({
  state,
  className,
}: {
  state: GuideState;
  className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const writeClipboard = async (url: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false; // iframe/pravice — ročna pot spodaj
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/pot/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      const j = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!j.ok || !j.url) {
        toast({
          title: 'Deljenje ni uspelo',
          description: j.error ?? 'Poskusi znova čez trenutek.',
        });
        return;
      }
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (typeof nav.share === 'function') {
        try {
          await nav.share({
            title: `Moja pot po Sloveniji — ${tripHeadline(state)}`,
            url: j.url,
          });
          return; // sistemski delilnik je prevzel
        } catch {
          // preklic delilnika → mirno nadaljujemo z odložiščem
        }
      }
      if (await writeClipboard(j.url)) {
        toast({
          title: 'Povezava kopirana',
          description: 'Pošlji jo sopotnikom — videli bodo tvojo pot.',
        });
        return;
      }
      // Odložišče blokirano → pokaži povezavo (ročno kopiranje vedno deluje).
      setCopied(false);
      setSharedUrl(j.url);
    } catch {
      toast({
        title: 'Deljenje trenutno ni na voljo',
        description: 'Preveri povezavo in poskusi znova.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`h-11 w-full sm:h-8 ${className ?? ''}`}
        onClick={share}
        disabled={busy}
        aria-label="Deli povezavo do svoje poti"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Share2 className="size-3.5" aria-hidden />
        )}
        {busy ? 'Pripravljam povezavo …' : 'Deli pot'}
      </Button>

      <Dialog
        open={sharedUrl !== null}
        onOpenChange={(open) => {
          if (!open) setSharedUrl(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Povezava do tvoje poti</DialogTitle>
            <DialogDescription>
              Samodejno kopiranje ni na voljo v tem brskalniku. Označi povezavo
              in jo kopiraj ročno (Ctrl/Cmd + C), nato jo pošlji sopotnikom.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={sharedUrl ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
              aria-label="Povezava do deljene poti"
            />
            <Button
              variant="outline"
              className="h-11 shrink-0 sm:h-9"
              onClick={async () => {
                if (!sharedUrl) return;
                if (await writeClipboard(sharedUrl)) setCopied(true);
              }}
            >
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? 'Kopirano' : 'Kopiraj'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
