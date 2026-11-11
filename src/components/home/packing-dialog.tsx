'use client';

import { useState } from 'react';
import { RotateCcw, ShoppingBag } from 'lucide-react';
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
import {
  PACKING_KEY,
  buildPackingList,
  packingProgress,
  parsePackingState,
  serializePackingList,
  type PackingItem,
  type PackingList,
} from '@/lib/packing';
import type { GuideInterest } from '@/lib/guide-store';

const GROUP_LABELS: Record<PackingItem['group'], string> = {
  dokumenti: 'Dokumenti',
  oblačila: 'Oblačila',
  toaletni: 'Toaletni pripomočki',
  tehnika: 'Tehnika',
  razno: 'Razno',
};

/**
 * PAKIRNI SEZNAM — predloge po tipu potovanja (gore/morje/mesto), s
 * shranjevanjem napredka za trenutno pot. Povsem skriptno.
 */

export function PackingDialog({
  routeKey,
  regionId,
  interests,
}: {
  routeKey: string;
  regionId: string | null;
  interests: readonly GuideInterest[];
}) {
  const [list, setList] = useState<PackingList>(() => {
    let stored: PackingList | null = null;
    try {
      stored = parsePackingState(window.localStorage.getItem(PACKING_KEY));
    } catch {
      stored = null;
    }
    if (stored && stored.routeKey === routeKey) return stored;
    return buildPackingList(routeKey, regionId, interests);
  });

  const persist = (next: PackingList) => {
    setList(next);
    try {
      window.localStorage.setItem(PACKING_KEY, serializePackingList(next));
    } catch {
      /* shranjevanje je prijetnost */
    }
  };

  const toggle = (id: string) => {
    const done = new Set(list.done);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    persist({ ...list, done });
  };

  const reset = () => {
    persist(buildPackingList(routeKey, regionId, interests));
  };

  const progress = packingProgress(list);
  const groups = ['dokumenti', 'oblačila', 'toaletni', 'tehnika', 'razno'] as const;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-11 w-full sm:h-8">
          <ShoppingBag className="size-3.5" aria-hidden />
          Pakirni seznam
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-primary" aria-hidden />
            Pakirni seznam
          </DialogTitle>
          <DialogDescription>
            Predloge glede na regijo in interese. Napredek se shrani za trenutno pot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Napredek pakirnega seznama"
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {list.done.size} od {list.items.length} · {progress} %
          </p>
        </div>

        <div className="nice-scroll max-h-[52dvh] space-y-4 overflow-y-auto pr-1">
          {groups.map((group) => {
            const items = list.items.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {GROUP_LABELS[group]}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={list.done.has(item.id)}
                          onChange={() => toggle(item.id)}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <span className={list.done.has(item.id) ? 'text-muted-foreground line-through' : ''}>
                          {item.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <DialogFooter className="justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" aria-hidden /> Ponastavi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
