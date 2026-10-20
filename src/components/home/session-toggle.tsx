'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Download, Loader2, LogIn, LogOut, Trash2, UserRound } from 'lucide-react';
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

type BusyAction = 'login' | 'logout' | 'export' | 'delete' | null;

/**
 * Prijava v demo profil: strežniška seja (opaque token, httpOnly) namesto
 * nepodpisanega piškotka. Gesla ni — to je še vedno demo identiteta, a
 * omogoča per-user rezervacije in resnična priporočila.
 *
 * Ko je uporabnik prijavljen, gumb odpre profil z izvozom in izbrisom
 * podatkov; odjava je zdaj namerna izbira v tem oknu.
 */
export function SessionToggle({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const busy = busyAction !== null;

  function openDialog() {
    setError('');
    setConfirmDelete(false);
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError('');
      setConfirmDelete(false);
    }
    setOpen(next);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction('login');
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
      setBusyAction(null);
    }
  }

  async function logout() {
    setBusyAction('logout');
    try {
      const res = await fetch('/api/session', { method: 'DELETE' });
      if (!res.ok) throw new Error('logout-failed');
      setOpen(false);
      toast({
        title: 'Odjavljen',
        description: 'Lokalni vodič ostaja v tem brskalniku. Znova se prijavi, ko ga želiš sinhronizirati.',
      });
      startTransition(() => router.refresh());
    } catch {
      toast({
        title: 'Odjava ni uspela',
        description: 'Povezava s strežnikom ni uspela. Poskusi znova.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function exportData() {
    setBusyAction('export');
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Izvoz ni uspel.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'discover-slovenia-podatki.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast({
        title: 'Podatki so preneseni',
        description: 'JSON datoteka je shranjena med prenosi.',
      });
    } catch (err) {
      toast({
        title: 'Izvoz ni uspel',
        description: err instanceof Error ? err.message : 'Poskusi znova.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteAccount() {
    setBusyAction('delete');
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Izbris ni uspel.');
      setConfirmDelete(false);
      setOpen(false);
      toast({
        title: 'Profil je izbrisan',
        description: 'Strežniški podatki in seja so odstranjeni. Lokalni vodič ostaja v tem brskalniku.',
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({
        title: 'Izbris ni uspel',
        description: err instanceof Error ? err.message : 'Poskusi znova.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <Button
        variant={loggedIn ? 'outline' : 'default'}
        size="sm"
        className="h-11 sm:h-8"
        onClick={openDialog}
        disabled={pending || busy}
        aria-label={loggedIn ? 'Odpri profil in podatke' : 'Prijava v demo profil'}
      >
        {pending || busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : loggedIn ? (
          <UserRound className="size-4" aria-hidden />
        ) : (
          <LogIn className="size-4" aria-hidden />
        )}
        <span className="hidden sm:inline">{loggedIn ? 'Profil' : 'Prijava'}</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {loggedIn ? (
            <>
              <DialogHeader>
                <DialogTitle>Tvoj profil</DialogTitle>
                <DialogDescription>
                  Tu lahko preneseš svoje strežniške podatke ali izbrišeš profil.
                  Izbris odstrani ime, vodič, rezervacije in sejo; lokalni vodič v
                  tem brskalniku ostane.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => void exportData()}
                  disabled={busy}
                >
                  {busyAction === 'export' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-4" aria-hidden />
                  )}
                  Prenesi moje podatke (JSON)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => void logout()}
                  disabled={busy}
                >
                  {busyAction === 'logout' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <LogOut className="size-4" aria-hidden />
                  )}
                  Odjava
                </Button>
              </div>

              <Link
                href="/zasebnost"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Kaj hranimo in zakaj?
              </Link>

              <div className="border-t pt-4">
                {confirmDelete ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                  >
                    <p className="text-sm font-medium">Res trajno izbrišeš profil?</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Strežniški podatki in seja bodo odstranjeni. Lokalni vodič
                      ostane v tem brskalniku. Tega ni mogoče razveljaviti.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                        disabled={busy}
                      >
                        Prekliči
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void deleteAccount()}
                        disabled={busy}
                      >
                        {busyAction === 'delete' && (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        )}
                        Izbriši trajno
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Izbriši profil
                  </Button>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Zapri
                </Button>
              </DialogFooter>
            </>
          ) : (
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
                  {busyAction === 'login' && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  Prijavi se
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
