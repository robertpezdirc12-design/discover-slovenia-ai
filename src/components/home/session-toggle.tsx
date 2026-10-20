'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

/**
 * Prijava v demo profil: strežniška seja (opaque token, httpOnly) namesto
 * nepodpisanega piškotka. Gesla ni — to je še vedno demo identiteta, a
 * omogoča per-user rezervacije in resnična priporočila.
 */
export function SessionToggle({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Prijava ni uspela.');
        return;
      }
      setOpen(false);
      setName('');
      startTransition(() => router.refresh());
    } catch {
      setError('Strežnik ni dosegljiv — poskusi znova.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const res = await fetch('/api/session', { method: 'DELETE' });
      if (!res.ok) throw new Error('logout-failed');
    } catch {
      toast({
        title: 'Odjava ni uspela',
        description: 'Povezava s strežnikom ni uspela. Poskusi znova.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <>
      <Button
        variant={loggedIn ? 'outline' : 'default'}
        size="sm"
        className="h-11 sm:h-8"
        onClick={() => (loggedIn ? void logout() : setOpen(true))}
        disabled={pending || busy}
        aria-label={loggedIn ? 'Odjava' : 'Prijava v demo profil'}
      >
        {pending || busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : loggedIn ? (
          <LogOut className="size-4" aria-hidden />
        ) : (
          <LogIn className="size-4" aria-hidden />
        )}
        <span className="hidden sm:inline">{loggedIn ? 'Odjava' : 'Prijava'}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={login} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Demo profil</DialogTitle>
              <DialogDescription>
                Ime uporabimo za pozdrav v tvojem profilu. Demo prijava brez gesla
                — seja je shranjena v tem brskalniku 30 dni. Ne vnašaj občutljivih
                podatkov.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="display-name">Ime</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="npr. Ana"
                autoComplete="nickname"
                autoFocus
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Prekliči
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Prijavi se
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
