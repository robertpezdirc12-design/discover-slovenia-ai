'use client';

import { useMemo, type CSSProperties } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Car, ChevronDown, ChevronUp, GripVertical, MapPin, RotateCcw } from 'lucide-react';
import { moveStopByName, nudgeStop } from '@/lib/trip-order';
import type { TripStop } from '@/lib/trip-plan';

/**
 * POSTANKE »TVOJE POTI« — povleci in spusti (@dnd-kit), z vsemi rezervnimi
 * potmi, ki jih profesionalna UI/UX zahteva:
 *
 *  • ročica za miško (MouseSensor, 6 px prag) in dotik (TouchSensor,
 *    150 ms zadržanje → seznam na mobilnem ostane DRSEČ, vlečenje ne krade
 *    potega prsta),
 *  • KeyboardSensor: presledek pobere postanek, puščici gor/dol ga premakneta,
 *    presledek odloži, Escape prekliče — vse s SLOVENSKIMI napovedmi,
 *  • izrecna gumba gor/dol za vsako postanko (delujeta tudi brez vlečenja,
 *    na dotiku in za uporabnike podpornih tehnologij),
 *  • oštevilčenje + dan + čas vožnje ostanejo vidni,
 *  • vrstni red se hrani pri klicatelju; ta komponenta ostaje brez `window`.
 *
 * Komponenta ne pozna localStorage niti Leafleta: prejme `stops` in javi
 * nov seznam imen prek `onOrderChange`.
 */

export interface SortableStopsProps {
  stops: readonly TripStop[];
  /** Dan (1-based) po imenu postanke — null, če pot ni razdeljena na dni. */
  dayByStop?: ReadonlyMap<string, number>;
  /** »25 min · 32 km« po imenu postanke (OSRM nožica do te postanke). */
  driveByStop?: ReadonlyMap<string, string>;
  /** Klik na ime → zemljevid pripotuje do postanke in odpre opis. */
  onFocus: (stop: TripStop) => void;
  /** Nov vrstni red (imena) — klicatelj shrani in osveži plan. */
  onOrderChange: (names: readonly string[]) => void;
  /** Ponastavi na privzeti vrstni red regije. */
  onReset: () => void;
  isCustomOrder: boolean;
}

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Pritisni presledek, da primeš postanek. S puščicama gor in dol ga premakni, ' +
    's presledkom odloži, z Escape prekliči.',
};

function stopNames(stops: readonly TripStop[]): string[] {
  return stops.map((s) => s.name);
}

interface RowProps {
  stop: TripStop;
  index: number;
  total: number;
  day: number | null;
  drive: string | null;
  onFocus: (stop: TripStop) => void;
  onNudge: (index: number, delta: -1 | 1) => void;
}

function SortableStopRow({ stop, index, total, day, drive, onFocus, onNudge }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.name, disabled: total < 2 });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-stop={stop.name}
      className={`relative rounded-lg border bg-background/80 ${
        isDragging ? 'z-30 border-primary/50 opacity-95 shadow-lg ring-2 ring-primary/30' : 'border-transparent'
      }`}
    >
      {drive && (
        <p className="flex items-center gap-1 px-2 pt-1 text-[11px] leading-tight text-muted-foreground">
          <Car className="size-3 shrink-0" aria-hidden />
          {drive}
        </p>
      )}
      <div className="flex min-h-11 items-center gap-0.5 px-0.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          disabled={total < 2}
          aria-label={`Premakni postanek ${stop.name} — povleci ali pritisni presledek in puščici`}
          className="flex min-h-11 min-w-11 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-35 sm:min-h-8 sm:min-w-8"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => onFocus(stop)}
          aria-label={`Prikaži ${stop.name} na zemljevidu`}
          className="min-h-11 min-w-0 flex-1 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-[11px] font-semibold text-emerald-700">{index + 1}.</span>
            {day !== null && (
              <span className="shrink-0 rounded bg-emerald-600/10 px-1 text-[10px] font-medium text-emerald-700">
                {day}. dan
              </span>
            )}
            <span className="min-w-0 truncate text-sm font-medium leading-tight">{stop.name}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{stop.note}</span>
        </button>

        <div className="flex shrink-0 items-center" role="group" aria-label={`Premakni ${stop.name}`}>
          <button
            type="button"
            onClick={() => onNudge(index, -1)}
            disabled={index === 0}
            aria-label={`Premakni ${stop.name} za eno mesto navzgor`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 sm:min-h-8 sm:min-w-8"
          >
            <ChevronUp className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onNudge(index, 1)}
            disabled={index === total - 1}
            aria-label={`Premakni ${stop.name} za eno mesto navzdol`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 sm:min-h-8 sm:min-w-8"
          >
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

export function SortableStops({
  stops,
  dayByStop,
  driveByStop,
  onFocus,
  onOrderChange,
  onReset,
  isCustomOrder,
}: SortableStopsProps) {
  const items = useMemo(() => stopNames(stops), [stops]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const label = (id: unknown): string => {
    const name = String(id);
    const at = items.indexOf(name);
    return at < 0 ? name : `${at + 1}. ${name}`;
  };

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Primeš postanek ${label(active.id)}. Uporabi puščici gor in dol.`,
      onDragOver: ({ active, over }) =>
        over ? `${label(active.id)} je zdaj pred ${label(over.id)}.` : `${label(active.id)} je zunaj seznama.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `Postanek ${label(active.id)} je odložen na mesto ${label(over.id)}.`
          : 'Preureditev je preklicana — vrstni red ostaja nespremenjen.',
      onDragCancel: () => 'Preureditev je preklicana — vrstni red ostaja nespremenjen.',
    }),
    // `label` uporablja trenutni `items`; ob spremembi reda se napovedi znova zgradijo.
    [items],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = moveStopByName(stops, String(active.id), String(over.id));
    if (next === stops) return;
    onOrderChange(stopNames(next));
  };

  const nudge = (index: number, delta: -1 | 1) => {
    const next = nudgeStop(stops, index, delta);
    if (next === stops) return;
    onOrderChange(stopNames(next));
  };

  return (
    <div className="space-y-1" aria-label="Vrstni red postankov">
      <div className="flex items-center justify-between gap-1 px-1">
        <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          Vrstni red postankov
        </p>
        {isCustomOrder && (
          <button
            type="button"
            onClick={onReset}
            className="flex min-h-8 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Ponastavi privzeti vrstni red postankov"
          >
            <RotateCcw className="size-3" aria-hidden />
            Ponastavi
          </button>
        )}
      </div>
      {stops.length > 1 && (
        <p className="px-1 text-[10px] leading-snug text-muted-foreground">
          Povleci ročico ali uporabi puščici — pot, GPX in zanimivosti se prilagodijo.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ol className="space-y-1" aria-label="Postanke poti">
            {stops.map((stop, i) => (
              <SortableStopRow
                key={stop.name}
                stop={stop}
                index={i}
                total={stops.length}
                day={dayByStop?.get(stop.name) ?? null}
                drive={driveByStop?.get(stop.name) ?? null}
                onFocus={onFocus}
                onNudge={nudge}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
