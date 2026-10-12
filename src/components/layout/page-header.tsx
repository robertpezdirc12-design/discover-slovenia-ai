import { cn } from "@/lib/utils";

/**
 * GLAVA STRANI — naslov + opis (vrstica "kicker" nad naslovom po izbiri).
 * Čista predstavitvena komponenta: lokalizacijo (SL/EN) poda klicatelj.
 */
export function PageHeader({
  kicker,
  kickerClassName,
  title,
  lead,
  leadClassName,
  center = false,
  children,
  className,
}: {
  kicker?: string;
  /** POLIR14 (2.41.0): opcijski dopustni razredi vrstice kicker (cn spoj
   *  z osnovo — npr. „hidden sm:block" na /zemljevid skrije vejico nad
   *  naslovom na mobilnem, kjer je vsaka vrstica prvega zaslona draga).
   *  Privzeto nedoločeno = 0 sprememb za VSE ostale klicatelje. */
  kickerClassName?: string;
  title: string;
  lead?: string;
  /** POLIR14 (2.41.0): opcijski dopustni razredi opisa (lead) — cn spoj z
   *  osnovo (npr. „line-clamp-2 sm:line-clamp-none" na /zemljevid stisne
   *  opis na 2 vrstici na mobilnem; vsebina ostane v DOM za namizje). */
  leadClassName?: string;
  center?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", center && "text-center", className)}>
      {kicker && (
        <p
          className={cn(
            "text-xs font-bold tracking-[0.18em] text-primary uppercase",
            kickerClassName
          )}
        >
          {kicker}
        </p>
      )}
      {/* POLIR8 (2.35.0): break-words — dolge enobesedne nemške sestavljenke
          („Nutzungsbedingungen" 368 px → 64 px preliva, „Datenschutzerklärung"
          → 57 px @320) se prelomijo namesto da raznesejo stran; ena sprememba
          pokrije VSE PageHeader klicatelje; na širokih zaslonih se nič ne
          spremeni (break-words se aktivira SAMO ob prekoračitvi). */}
      <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-balance break-words sm:text-4xl">
        {title}
      </h1>
      {lead && (
        <p
          className={cn(
            "mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg",
            center && "mx-auto",
            leadClassName
          )}
        >
          {lead}
        </p>
      )}
      {children}
    </div>
  );
}
