import { Mountain } from "lucide-react";

/**
 * KORENSKA 404 STRAN — zahteve, ki niso ujete v locale vejo niti
 * middlewarejem (npr. nepodatkovne poti). Lasten <html>/<body>, ker
 * je korenska postavitev minimalen prehod (next-intl kanon).
 * Dvojezična: slovenščina (privzeti) + angleščina.
 */
export default function RootNotFound() {
  return (
    <html lang="sl">
      <body className="bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Mountain className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-6 font-mono text-sm font-bold text-primary">404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Strani ni mogoče najti
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Pot, ki si jo odprl, ne obstaja. Nadaljuj na domači strani
            <span className="sr-only"> ali v angleščini: the page you opened does not
            exist. Continue on the home page.</span>
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/"
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Domov / Home
            </a>
            <a
              href="/en"
              className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-semibold hover:bg-accent"
            >
              English
            </a>
          </div>
          <p className="mt-10 font-mono text-xs text-muted-foreground">
            Discover Slovenia AI · v2.0.0-rc.1
          </p>
        </main>
      </body>
    </html>
  );
}
