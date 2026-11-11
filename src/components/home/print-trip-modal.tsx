'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TripPrintInput } from '@/lib/print-trip';
import { buildTripPrintHtml, printTripFileName } from '@/lib/print-trip';
import type { TripStop } from '@/lib/trip-plan';

const EMPTY_STOPS: readonly TripStop[] = [];

type PrintTripModalProps = Omit<TripPrintInput, 'generatedAt' | 'stops'> & {
  stops: readonly TripStop[] | null;
};

export function PrintTripModal({
  stops,
  dayTrack,
  pois,
  budget,
  stays,
  regionLabel,
  localCurrencyNote,
}: PrintTripModalProps) {
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);
  const printStops = stops ?? EMPTY_STOPS;
  const html = useMemo(
    () => buildTripPrintHtml({ stops: printStops, dayTrack, pois, budget, stays, regionLabel, localCurrencyNote }),
    [printStops, dayTrack, pois, budget, stays, regionLabel, localCurrencyNote],
  );
  const previewReady = loadedHtml === html;

  const print = () => {
    const printWindow = printFrameRef.current?.contentWindow;
    if (!printWindow || !previewReady) return;
    printWindow.focus();
    printWindow.print();
  };

  const downloadHtml = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = printTripFileName();
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-11 w-full sm:h-8">
          <Printer className="size-3.5" aria-hidden />
          Natisni / shrani kot PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(92dvh,900px)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="size-4" aria-hidden />
            Predogled načrta poti
          </DialogTitle>
          <DialogDescription>
            Natisni ali v pogovornem oknu tiskalnika izberi »Shrani kot PDF«. HTML lahko preneseš za uporabo brez povezave.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 p-3">
          <iframe
            ref={printFrameRef}
            title="Predogled načrta poti po Sloveniji"
            srcDoc={html}
            onLoad={() => setLoadedHtml(html)}
            className="h-full min-h-0 w-full border bg-white"
          />
        </div>
        <DialogFooter className="border-t px-4 py-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={downloadHtml}>
            <Download className="size-4" aria-hidden />
            Prenesi HTML
          </Button>
          <Button type="button" onClick={print} disabled={!previewReady}>
            <Printer className="size-4" aria-hidden />
            Natisni / shrani kot PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
