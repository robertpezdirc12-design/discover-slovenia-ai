'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SharedTripError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Deljena pot
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Poti trenutno ni mogoče naložiti
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Povezava je videti veljavna, a se strežnik s podatki ni odzval. Poskusi
        znova; če se napaka ponovi, povezavo odpri nekoliko kasneje.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="size-4" aria-hidden />
          Poskusi znova
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Nazaj na začetek</Link>
        </Button>
      </div>
    </main>
  );
}
