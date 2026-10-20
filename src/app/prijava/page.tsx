import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Prijava · Discover Slovenia AI',
  description: 'Prijava v Discover Slovenia AI z enkratno povezavo na e-pošto.',
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  neveljavna: 'Povezava ni veljavna ali je potekla. Zahtevaj novo povezavo na začetni strani.',
  streznik: 'Prijave trenutno ni mogoče dokončati. Poskusi znova čez nekaj trenutkov.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.napaka === 'string' ? params.napaka : null;
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.neveljavna) : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        ← Nazaj na začetek
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Prijava v profil</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Prijava poteka prek enkratne povezave, ki jo prejmeš na e-pošto. Povezava
        velja 15 minut in jo je mogoče uporabiti samo enkrat.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6"
        >
          {error}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm leading-6">
          Odpri povezavo iz e-pošte. Če je nimaš, jo zahtevaj na začetni strani.
        </div>
      )}

      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
      >
        Na začetno stran
      </Link>
    </main>
  );
}
