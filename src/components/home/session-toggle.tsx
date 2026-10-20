'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { Download, Loader2, LogIn, Trash2, UserRound } from 'lucide-react';
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

type BusyAction = 'login' | 'export' | 'delete' | null;

const REQUEST_TIMEOUT_MS = 10_000;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return 'Strežnik se ni odzval — poskusi znova.';
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Prijava v demo profil: strežniška seja (opaque token, httpOnly) namesto
 * nepodpisanega piškotka. Gesla ni — to je še vedno demo identiteta, a
 * omogoča per-user rezervacije in resnična priporočila.
 *
 * Ker profila brez gesla ni mogoče obnoviti, UI ne ponuja gole odjave:
 * odjava bi pustila nedosegljive strežniške podatke. Namesto tega uporabnik
 * profil izvozi ali trajno izbriše (kar ga hkrati odjavi).
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
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);

  const busy = busyAction !== null;

  useEffect(() => {
    if (confirmDelete) {
      cancelDeleteRef.current?.focus();
    } else if (restoreDeleteFocus.current) {
      restoreDeleteFocus.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [confirmDelete]);

  function cancelDelete() {
    restoreDeleteFocus.current = true;
    setConfirmDelete(false);
  }

  function expireSession() {
    setConfirmDelete(false);
    setOpen(false);
    startTransition(() => router.refresh());
  }

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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Prijava ni uspela.');
        return;
      }
      setOpen(false);
      setName('');
      startTransition(() => router.refresh());
    } catch (err) {
      setError(errorMessage(err, 'Strežnik ni dosegljiv — poskusi znova.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function exportData() {
    setBusyAction('export');
    try {
      const res = await fetch('/api/account/export', {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status === 401) {
        expireSession();
        throw new Error('Seja je potekla — prijavi se znova.');
      }
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
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast({
        title: 'Podatki so preneseni',
        description: 'JSON datoteka je shranjena med prenosi.',
      });
    } catch (err) {
      toast({
        title: 'Izvoz ni uspel',
        description: errorMessage(err, 'Poskusi znova.'),
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteAccount() {
    setBusyAction('delete');
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status === 401) {
        expireSession();
        throw new Error('Seja je potekla — prijavi se znova.');
      }
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Izbris ni uspel.');
      setConfirmDelete(false);
      setOpen(false);
      toast({
        title: 'Profil je izbrisan — odjavljen si',
        description: 'Strežniški podatki in seja so odstranjeni. Lokalni vodič ostaja v tem brskalniku.',
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({
        title: 'Izbris ni uspel',
        description: errorMessage(err, 'Poskusi znova.'),
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
                  Demo prijava nima gesla, zato se po izbrisu v ta profil ne
                  moreš vrniti. Podatke lahko najprej preneseš. Izbris odstrani
                  ime, vodič, rezervacije in sejo; lokalni vodič v tem
                  brskalniku ostane. Deljene povezave niso vezane na profil in
                  ostanejo do poteka (90 dni).
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
                    <p className="text-sm font-medium">
                      Res izbrišeš profil in se odjaviš?
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Uporabnik, seje, vodič in rezervacije bodo trajno
                      odstranjeni. Deljene povezave ostanejo do poteka (90 dni).
                      Lokalni vodič ostane v tem brskalniku. Tega ni mogoče
                      razveljaviti.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        ref={cancelDeleteRef}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={cancelDelete}
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
                        Izbriši in se odjavi
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    ref={deleteButtonRef}
                    type="button"
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Izbriši profil in se odjavi
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
