'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { buildGpx, gpxFileName, type GpxPoint } from '@/lib/gpx-export';

/**
 * "Izvozi GPX" — pot za offline uporabo (Komoot/Outdooractive vzorec).
 *
 * Vse se zgodi v brskalniku: ni strežnika, ni API ključa, ni sledenja.
 * Poleg samodejnega prenosa VEDNO pustimo ročno povezavo — predogledi v
 * iframe in strožji brskalniki včasih blokirajo programski `a.click()`.
 */
export function ExportTripButton({
  points,
  className,
}: {
  points: readonly GpxPoint[];
  className?: string;
}) {
  const { toast } = useToast();
  const [manual, setManual] = useState<{ url: string; name: string } | null>(null);

  // Počistimo Blob URL ob zamenjavi/odstranitvi (brez uhajanja pomnilnika).
  useEffect(() => {
    return () => {
      if (manual) URL.revokeObjectURL(manual.url);
    };
  }, [manual]);

  const exportGpx = () => {
    const xml = buildGpx(points);
    if (!xml) {
      toast({
        title: 'Izvoz ni mogoč',
        description: 'Dodaj vsaj eno destinacijo ali prenočišče na svojo pot.',
      });
      return;
    }
    try {
      const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const name = gpxFileName();
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setManual({ url, name });
      toast({
        title: 'Pot izvožena v GPX',
        description: `${points.length} točk · uvozi datoteko v navigacijo, OsmAnd ali Komoot.`,
      });
    } catch {
      toast({
        title: 'Prenos trenutno ni na voljo',
        description: 'Poskusi znova ali odpri stran v novem zavihku.',
      });
    }
  };

  return (
    <div className={className}>
      <Button
        size="sm"
        variant="outline"
        className="h-11 w-full sm:h-8"
        onClick={exportGpx}
        disabled={points.length === 0}
        aria-label="Izvozi svojo pot kot GPX datoteko"
      >
        <Download className="size-3.5" aria-hidden />
        Izvozi GPX
      </Button>
      {manual && (
        <a
          href={manual.url}
          download={manual.name}
          className="mt-1 block px-1 text-[11px] text-primary underline underline-offset-2 hover:no-underline"
        >
          Prenos se ni začel? Odpri datoteko ročno
        </a>
      )}
    </div>
  );
}
