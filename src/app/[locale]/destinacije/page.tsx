import type { Metadata } from "next";
import { Suspense } from "react";

import { DestinationsExplorer } from "@/components/destinations-explorer";
import { Skeleton } from "@/components/ui/skeleton";
import { pageMetadata } from "@/lib/page-metadata";

/**
 * /destinacije — raziskovalka vseh 74 destinacij.
 * Explorer je odjemalec (useSearchParams za ?q/?region/?type) — zato
 * Suspense ovoj (kanon App Routerja za iskalne parametre).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "/destinacije");
}

export default function DestinationsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-11 w-full" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/2] rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <DestinationsExplorer />
    </Suspense>
  );
}
