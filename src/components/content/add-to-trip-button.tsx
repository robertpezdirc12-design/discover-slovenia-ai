"use client";

import { Check, Plus } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { MyTripItemKind } from "@/lib/types";
import { myTrip } from "@/lib/my-trip";

/**
 * GUMB „DODAJ V MOJO POT" — skupni otok za vsebine 45-b (dogodki, vodniki,
 * doživetja). Idempotenten (dvojnik ne napake), odziven stanju in posluša
 * spremembe zbirke iz drugih zavihkov.
 */
export function AddToTripButton({
  refId,
  name,
  kind = "custom",
  source,
  labels,
  className,
  size = "sm",
  variant = "outline",
}: {
  refId: string;
  name: string;
  kind?: MyTripItemKind;
  source?: string;
  labels: { add: string; added: string };
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const [added, setAdded] = React.useState(false);

  React.useEffect(() => {
    const refresh = () => setAdded(myTrip.has(refId));
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [refId]);

  const onAdd = React.useCallback(() => {
    const res = myTrip.add(refId, name, kind, source);
    if (res.ok || res.already) setAdded(true);
  }, [refId, name, kind, source]);

  return (
    <Button
      type="button"
      onClick={onAdd}
      size={size}
      variant={added ? "secondary" : variant}
      aria-pressed={added}
      className={className}
    >
      {added ? (
        <>
          <Check className="size-4" aria-hidden="true" />
          {labels.added}
        </>
      ) : (
        <>
          <Plus className="size-4" aria-hidden="true" />
          {labels.add}
        </>
      )}
    </Button>
  );
}
