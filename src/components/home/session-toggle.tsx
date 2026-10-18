'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * POLIR15-c — demo preklop prijave (cookie namesto next-auth).
 * router.refresh() ponovno zažene server render → pokaže Streaming
 * PersonalHomeSection brez layout premika (rezerviran skeleton).
 */
export function SessionToggle({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function toggle() {
    await fetch('/api/demo-session', {
      method: loggedIn ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana' }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <Button
      variant={loggedIn ? 'outline' : 'default'}
      size="sm"
      className="h-11 sm:h-8"
      onClick={toggle}
      disabled={pending}
      aria-label={loggedIn ? 'Odjava (demo)' : 'Prijava (demo)'}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : loggedIn ? (
        <LogOut className="size-4" aria-hidden />
      ) : (
        <LogIn className="size-4" aria-hidden />
      )}
      <span className="hidden sm:inline">
        {loggedIn ? 'Odjava (demo)' : 'Prijava (demo)'}
      </span>
    </Button>
  );
}
