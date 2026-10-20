'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { Download, Loader2, LogIn, LogOut, Mail, Trash2, UserRound } from 'lucide-react';
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
import type { SessionUser } from '@/lib/session';

type BusyAction = 'request' | 'logout' | 'export' | 'delete' | null;

const REQUEST_TIMEOUT_MS = 10_000;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return 'Strežnik se ni odzval — poskusi znova.';
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Prijava v profil z enkratno povezavo na e-pošto (magic link).
 *
 * Seja je opaque žeton v httpOnly piškotku; profil je z e-poštno prijavo
 * mogoče obnoviti, zato je odjava varna. Trajni izbris in izvoz ostaneta
 * ločeni, uničujoči dejanji.
 */
export function SessionToggle({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [loginSent, setLoginSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);

  const loggedIn = user !== null;
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
    setLoginSent(false);
    setSentTo('');
    setDevLink('');
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError('');
      setConfirmDelete(false);
      setLoginSent(false);
      setSentTo('');
      setDevLink('');
    }
    setOpen(next);
  }

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Vnesi e-poštni naslov.');
      return;
    }

    setBusyAction('request');
    setError('');
    setDevLink('');
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        devLink?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Povezave ni bilo mogoče poslati.');
        return;
      }

      setSentTo(targetEmail);
      setLoginSent(true);
      if (typeof json.devLink === 'string') setDevLink(json.devLink);
    } catch (err) {
      setError(errorMessage(err, 'Strežnik ni dosegljiv — poskusi znova.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function logout() {
    setBusyAction('logout');
    try {
      const res = await fetch('/api/session', {
        method: 'DELETE',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Odjava ni uspela.');

      setOpen(false);
      toast({
        title: 'Odjavljen si',
        description: 'Profil ostaja shranjen; znova se prijavi z e-poštno povezavo.',
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({
        title: 'Odjava ni uspela',
        description: errorMessage(err, 'Poskusi znova.'),
        variant: 'destructive',
      });
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
        title: 'Profil je izbrisan',
        description:
          'E-pošta, seje, vodič in rezervacije so odstranjeni. Lokalni vodič ostaja v tem brskalniku.',
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
        aria-label={loggedIn ? 'Odpri profil in podatke' : 'Prijava v profil'}
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
          {loggedIn && user ? (
            <>
              <DialogHeader>
                <DialogTitle>Tvoj profil</DialogTitle>
                <DialogDescription>
                  Prijavljen si kot {user.email ?? 'profil brez e-pošte'}. Odjava
                  profila ne izbriše; podatke lahko preneseš ali trajno izbrišeš.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="break-all text-xs text-muted-foreground">
                  {user.email ?? 'E-pošta ni povezana'}
                </p>
              </div>

              {!user.email && (
                <p className="text-xs leading-5 text-amber-700">
                  Ta profil je iz stare demo prijave brez e-pošte. Če želiš
                  uporabljati prijavo z e-pošto, profil izbriši in se znova
                  prijavi; lokalni vodič lahko pred tem preneseš.
                </p>
              )}

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
                      E-pošta, uporabnik, seje, vodič in rezervacije bodo trajno
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
                        Izbriši trajno
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
                    Izbriši profil trajno
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
          ) : loginSent ? (
            <>
              <DialogHeader>
                <DialogTitle>Preveri e-pošto</DialogTitle>
                <DialogDescription>
                  Če je naslov {sentTo} veljaven, smo poslali enkratno povezavo.
                  Velja 15 minut in je uporabna samo enkrat.
                </DialogDescription>
              </DialogHeader>

              <p className="text-sm leading-6 text-muted-foreground">
                Povezavo odpri v tem ali drugem brskalniku in na strani potrdi
                prijavo. Seja se ustvari šele po potrditvi. Preveri tudi
                vsiljeno pošto.
              </p>

              {devLink && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Razvojni način</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    E-poštni ponudnik ni nastavljen, zato je povezava prikazana
                    tukaj. V produkciji se nikoli ne prikaže.
                  </p>
                  <a
                    href={devLink}
                    className="mt-2 inline-block break-all font-medium text-emerald-700 underline underline-offset-2"
                  >
                    Odpri povezavo za prijavo
                  </a>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLoginSent(false);
                    setSentTo('');
                    setDevLink('');
                    setError('');
                  }}
                  disabled={busy}
                >
                  Uporabi drug naslov
                </Button>
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
            <form onSubmit={requestMagicLink} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Prijava v profil</DialogTitle>
                <DialogDescription>
                  Pošljemo ti enkratno povezavo na e-pošto. Gesla ne shranjujemo;
                  povezava velja 15 minut in je uporabna samo enkrat.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2">
                <Label htmlFor="login-email">E-poštni naslov</Label>
                <Input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  placeholder="ana@example.com"
                  spellCheck={false}
                  autoFocus
                  required
                  disabled={busy}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <p className="text-xs leading-5 text-muted-foreground">
                E-pošto hranimo za prijavo in sinhronizacijo profila.{' '}
                <Link
                  href="/zasebnost"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Več o zasebnosti
                </Link>
                .
              </p>

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
                  {busyAction === 'request' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Mail className="size-4" aria-hidden />
                  )}
                  Pošlji povezavo
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
