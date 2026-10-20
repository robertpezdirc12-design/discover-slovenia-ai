import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Potrdi prijavo · Discover Slovenia AI',
  description: 'Potrditev enkratne prijavne povezave za Discover Slovenia AI.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

function isValidToken(value: string): boolean {
  return value.length >= 20 && value.length <= 200 && /^[A-Za-z0-9_-]+$/.test(value);
}

export default async function ConfirmLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  const valid = isValidToken(token);

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        ← Nazaj na začetek
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Potrdi prijavo</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Povezava je veljavna 15 minut in jo je mogoče uporabiti samo enkrat.
      </p>

      {valid ? (
        <form action="/api/auth/verify" method="post" className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Dokončaj prijavo
          </button>
        </form>
      ) : (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6"
        >
          Povezava ni veljavna ali je potekla. Zahtevaj novo povezavo na
          začetni strani.
        </div>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Če povezave nisi zahteval ti, stran zapri in ne nadaljuj.
      </p>
    </main>
  );
}
