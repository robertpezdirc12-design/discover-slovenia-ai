import { Mountain } from 'lucide-react';
import { SessionToggle } from './session-toggle';

/**
 * Lepljiva glava (top-0, z-40) — višina h-14 je referenčni odmik za
 * sticky preklop v MapSection (top-14, z-30).
 */
export function SiteHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border/80 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
          aria-label="Discover Slovenia AI — domov"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-emerald-900/15">
            <Mountain className="size-4.5" aria-hidden />
          </span>
          <span className="hidden font-display text-[0.95rem] leading-none sm:inline">
            Discover Slovenia <span className="text-primary">AI</span>
          </span>
        </a>

        <nav
          aria-label="Glavna navigacija"
          className="ml-auto flex items-center gap-1 text-sm text-muted-foreground md:ml-6"
        >
          <ul className="flex items-center gap-0.5">
            <li>
              <a
                className="inline-flex min-h-11 items-center rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground sm:min-h-9"
                href="#zemljevid"
              >
                Zemljevid
              </a>
            </li>
            <li>
              <a
                className="inline-flex min-h-11 items-center rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground sm:min-h-9"
                href={loggedIn ? '#osebno' : '#vodic'}
              >
                Za tebe
              </a>
            </li>
          </ul>
        </nav>

        <div className="ml-1 md:ml-3">
          <SessionToggle loggedIn={loggedIn} />
        </div>
      </div>
    </header>
  );
}
