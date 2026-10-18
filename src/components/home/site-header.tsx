import { Mountain } from 'lucide-react';
import { SessionToggle } from './session-toggle';

/**
 * Lepljiva glava (top-0, z-40) — višina h-14 je referenčni odmik za
 * sticky preklop v MapSection (top-14, z-30).
 */
export function SiteHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
          aria-label="Discover Slovenia AI — domov"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Mountain className="size-4.5" aria-hidden />
          </span>
          <span className="hidden xs:inline sm:inline">
            Discover Slovenia <span className="text-emerald-600">AI</span>
          </span>
        </a>

        <nav
          aria-label="Glavna navigacija"
          className="ml-auto flex items-center gap-3 text-xs text-muted-foreground md:ml-0 md:gap-5 md:text-sm"
        >
          <ul className="flex items-center gap-3 md:gap-5">
            <li>
              <a className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-foreground sm:min-h-9" href="#zemljevid">
                Zemljevid
              </a>
            </li>
            <li>
              <a className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-foreground sm:min-h-9" href={loggedIn ? '#osebno' : '#vodic'}>
                Za tebe
              </a>
            </li>
            <li>
              <a className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-foreground sm:min-h-9" href="#zmoznosti">
                Zmožnosti
              </a>
            </li>
          </ul>
        </nav>

        <div className="ml-auto md:ml-4">
          <SessionToggle loggedIn={loggedIn} />
        </div>
      </div>
    </header>
  );
}
