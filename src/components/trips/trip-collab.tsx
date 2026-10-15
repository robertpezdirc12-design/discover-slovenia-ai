"use client";

// ============================================================================
// TRIP COLLABORATION — rekonstrukcija Issue #4 §13 (val 2) iz PRISTNE izvorne
// kode (read_1790957761446): vloga, vabila, revokacija, javna/zasebna
// povezava + preimenovanje s compare-and-swap.
// ============================================================================
// Nahaja se na /pot/[shareId] (SL-only površina, enako kot SharedTrip).
//
// KAJ se izriše (nič ne moti običajnega obiskovalca javne pote):
//   - ?invite={token} → trak vabila (prijavljenim gumb Sprejmi, neprijavljenim
//     povezava na prijavo — iskreno, vloga se razkrije ŠELE ob sprejemu);
//   - vloga OWNER  → upravljanje sodelujočih (vabila/vloge/odvzem),
//     preklop javne povezave, preimenovanje (CAS);
//   - vloga EDITOR → preimenovanje (CAS);
//   - vloga VIEWER / anonimni obiskovalec javne pote → NIČ (čisto).
//
// MOSTOVNA prilagoditev 48-a: vloga se izračuna STREŽNIŠKO iz seje
// (ownerId / TripCollaborator) — žetoni editToken iz izvirnika tu ne
// obstojajo; vlog EDITOR/VIEWER (brez COMMENTER-ja, mostovni model).
//
// ISKRENOST: vsaka napaka API-ja se izpiše (brez tihih padcev); konflikt
// preimenovanja (409) pove, da je nekdo drug posodobil pot, in ponudi
// osvežitev; SMTP ni nastavljen → vabilo se kopira ročno (povedano).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  Link2,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  UserPlus,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

export type TripRoleName = "OWNER" | "EDITOR" | "VIEWER" | "NONE";

interface CollaboratorRow {
  id: string;
  role: string;
  status: string;
  kind: "collaborator" | "invite";
  inviteEmail: string | null;
  userId: string | null;
  invitedBy: string | null;
  createdAt: string;
  acceptedAt: string | null;
  accountEmail: string | null;
  accountName: string | null;
}

export interface TripAggregate {
  success: boolean;
  shareId: string;
  role: TripRoleName;
  isPublic: boolean;
  ownerName?: string;
  name: string | null;
  version: { renameVersion: number; updatedAt: string };
  /** ISO datum nastanka poti (GET /api/trips/[shareId] ga pošlje). */
  createdAt: string;
  /** Razčlenjen načrt poti (oblika SharedPlan). */
  plan: import("@/lib/shared-plan").SharedPlan;
  /** Realni datumi poti (P0-E) — lokalni "YYYY-MM-DD" | null. */
  tripDates?: { start: string; end: string } | null;
  collaborators?: CollaboratorRow[];
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Lastnik",
  EDITOR: "Urednik",
  VIEWER: "Gledalec",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "čaka sprejem",
  ACTIVE: "aktiven",
  REVOKED: "odvzet",
};

// TASK 8 / F3-B: placeholder nalaganja v L-pattern (SL/EN — D8-A §13
// „Nalagam…" uhodi so trdi predpogoj za F3-E EN razširitev).
const L = {
  loadingRevisions: { sl: "Nalagam sodelovanje …", en: "Loading collaboration …", it: "Caricamento della collaborazione …", de: "Zusammenarbeit wird geladen …", fr: "Chargement de la collaboration …", es: "Cargando la colaboración …" },
} as const;

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Pridobi agregat poti (vloga strežniško izračunana). 404 → null (tiho). */
export async function fetchTripAggregate(
  shareId: string
): Promise<TripAggregate | null> {
  const r = await fetch(`/api/trips/${encodeURIComponent(shareId)}`, {
    cache: "no-store",
  });
  if (!r.ok) return null;
  return (await r.json().catch(() => null)) as TripAggregate | null;
}

// ============================================================================
// TRAK VABILA (?invite=…) — vrh strani, kot v izvirniku
// ============================================================================

export function TripInviteBanner({
  shareId,
  inviteToken,
  onAccepted,
}: {
  shareId: string;
  inviteToken: string;
  onAccepted?: () => void;
}) {
  const { data: session, status: sessionStatus } = useSession();

  const [inviteState, setInviteState] = useState<
    "idle" | "accepting" | "accepted" | "error"
  >("idle");
  const [acceptedRole, setAcceptedRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptInvite = useCallback(async () => {
    if (!inviteToken) return;
    setInviteState("accepting");
    setError(null);
    try {
      const r = await fetch(
        `/api/invites/${encodeURIComponent(inviteToken)}`,
        { method: "PATCH", headers: { "content-type": "application/json" } }
      );
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        role?: string;
        error?: string;
        alreadyActive?: boolean;
        note?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setInviteState("error");
        setError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setInviteState("accepted");
      setAcceptedRole(data.role ?? null);
      if (data.note) setError(data.note);
      onAccepted?.();
    } catch (e) {
      setInviteState("error");
      setError(errText(e));
    }
  }, [inviteToken, onAccepted]);

  const loggedIn = sessionStatus === "authenticated" && Boolean(session?.user);

  return (
    <Card className="rounded-2xl border-primary/35 bg-gradient-to-br from-primary/[0.06] to-card shadow-sm ring-1 ring-primary/10">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">
            Povabljen si k sodelovanju na tej poti
          </p>
        </div>
        {inviteState === "accepted" ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Vabilo sprejeto — tvoja vloga:{" "}
            <strong>{ROLE_LABELS[acceptedRole ?? ""] ?? acceptedRole}</strong>
          </p>
        ) : !loggedIn ? (
          <p className="text-sm text-muted-foreground">
            Za sprejem vabila se prijavi z računom popotnika — vloga na
            poti je vezana na račun,{" "}
            <a
              className="font-medium underline underline-offset-2"
              href={`/prijava?next=${encodeURIComponent(
                `/pot/${shareId}?invite=${inviteToken}`
              )}`}
            >
              prijavi se
            </a>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void acceptInvite()}
              disabled={inviteState === "accepting"}
              className="min-h-11"
            >
              {inviteState === "accepting" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Sprejmi vabilo
            </Button>
            <p className="text-xs text-muted-foreground">
              Vloga se razkrije po sprejemu (klik na povezavo še ni sprejem).
            </p>
          </div>
        )}
        {inviteState === "error" && error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// UPRAVLJANJE SODELOVANJA (lastnik / urednik)
// ============================================================================

export function TripCollaboration({
  shareId,
  initialName,
}: {
  shareId: string;
  initialName: string | null;
}) {
  const { status: sessionStatus } = useSession();
  // TASK 8 / F3-B: jezik za L-pattern placeholder nalaganja (SL privzeto).
  const locale = useLocale();
  const lang: "sl" | "en" = locale === "en" ? "en" : "sl";

  const [agg, setAgg] = useState<TripAggregate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Upravljanje (lastnik)
  const [inviteRole, setInviteRole] = useState<string>("EDITOR");
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [copied, setCopied] = useState(false);

  // Preimenovanje (CAS)
  const [nameDraft, setNameDraft] = useState(initialName ?? "");
  const [renameState, setRenameState] = useState<"idle" | "saving" | "saved" | "conflict">(
    "idle"
  );
  const nameRef = useRef(initialName ?? "");

  const load = useCallback(async () => {
    try {
      const data = await fetchTripAggregate(shareId);
      if (!data) {
        // 404 = zasebna pot brez vloge → tiho skrijemo panel.
        setAgg(null);
        setLoadError(null);
        return;
      }
      setAgg(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(errText(e));
    }
  }, [shareId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── IZDAJA VABILA (lastnik) ───────────────────────────────────────────
  const issueInvite = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    setInviteUrl(null);
    setInviteNote(null);
    try {
      const r = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/collaborators`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          // P3 (2.26.0): e-pošta je NEOBVEZNA — prazna = samo povezava.
          body: JSON.stringify({
            role: inviteRole,
            ...(inviteEmail.trim() ? { email: inviteEmail.trim() } : {}),
          }),
        }
      );
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        inviteUrl?: string;
        emailSent?: boolean;
        emailHint?: string;
        error?: string;
      } | null;
      if (!r.ok || !data?.success) {
        setActionError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      setInviteUrl(data.inviteUrl ?? null);
      setInviteNote(data.emailHint ?? null);
      setInviteSent(Boolean(data.emailSent));
      if (data.emailSent) setInviteEmail("");
      void load();
    } catch (e) {
      setActionError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [shareId, inviteRole, inviteEmail, load]);

  // ── SPREMENBA VLOGE / ODVZEM / OŽIVITEV (lastnik) ─────────────────────
  const patchCollaborator = useCallback(
    async (id: string, patch: { role?: string; status?: string }) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/collaborators`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, ...patch }),
          }
        );
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        void load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [shareId, load]
  );

  const revokeCollaborator = useCallback(
    async (id: string) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/collaborators`,
          {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id }),
          }
        );
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        void load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [shareId, load]
  );

  // ── JAVNA/ZASEBNA POVEZAVA (lastnik) ──────────────────────────────────
  const togglePublic = useCallback(
    async (next: boolean) => {
      setBusy(true);
      setActionError(null);
      try {
        const r = await fetch(`/api/trips/${encodeURIComponent(shareId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isPublic: next }),
        });
        const data = (await r.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (!r.ok || !data?.success) {
          setActionError(data?.error ?? `Napaka ${r.status}`);
          return;
        }
        void load();
      } catch (e) {
        setActionError(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [shareId, load]
  );

  // ── PREIMENOVANJE s CAS (lastnik/urednik) ─────────────────────────────
  const saveName = useCallback(async () => {
    if (!agg) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === nameRef.current) {
      setRenameState(trimmed === nameRef.current ? "saved" : "idle");
      return;
    }
    setRenameState("saving");
    setActionError(null);
    try {
      const r = await fetch(`/api/trips/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseVersion: agg.version.renameVersion,
          name: trimmed,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        success?: boolean;
        renameVersion?: number;
        error?: string;
        conflict?: boolean;
      } | null;
      if (r.status === 409 || data?.conflict) {
        setRenameState("conflict");
        return;
      }
      if (!r.ok || !data?.success) {
        setRenameState("idle");
        setActionError(data?.error ?? `Napaka ${r.status}`);
        return;
      }
      nameRef.current = trimmed;
      setRenameState("saved");
      void load();
    } catch (e) {
      setRenameState("idle");
      setActionError(errText(e));
    }
  }, [agg, nameDraft, shareId, load]);

  const copyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${inviteUrl}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Kopiranje ni uspelo — povezavo prepiši ročno.");
    }
  }, [inviteUrl]);

  const role = agg?.role ?? "NONE";

  if (loadError) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Sodelovanje trenutno ni na voljo: {loadError}</span>
        </CardContent>
      </Card>
    );
  }

  if (sessionStatus === "loading" && !agg) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="p-4 text-sm text-muted-foreground" role="status">
          {L.loadingRevisions[lang]}
        </CardContent>
      </Card>
    );
  }

  // Gledalec / anonimni obiskovalec javne pote → čisto (brez panela).
  if (role !== "OWNER" && role !== "EDITOR") return null;
  if (!agg) return null;

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Users className="h-4 w-4" aria-hidden="true" />
          Sodelovanje na poti
          <Badge variant="secondary">{ROLE_LABELS[role] ?? role}</Badge>
          {!agg.isPublic && (
            <Badge className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Zasebna povezava
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {actionError && (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}

        {/* Preimenovanje (CAS) */}
        <div className="space-y-2">
          <Label htmlFor="trip-name" className="text-sm font-medium">
            Ime poti
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="trip-name"
              value={nameDraft}
              maxLength={120}
              onChange={(e) => {
                setNameDraft(e.target.value);
                setRenameState("idle");
              }}
              placeholder="Poletje na Bledu"
            />
            <Button
              onClick={() => void saveName()}
              disabled={
                renameState === "saving" ||
                !nameDraft.trim() ||
                nameDraft.trim() === nameRef.current
              }
              className="shrink-0"
            >
              {renameState === "saving" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Shrani ime
            </Button>
          </div>
          {renameState === "saved" && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Ime shranjeno (različica {agg.version.renameVersion}).
            </p>
          )}
          {renameState === "conflict" && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Pot je med tem spremenil nekdo drug (sočasno urejanje) —
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
                osveži
              </Button>
              in poskusi znova.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Zaporedno urejanje je zaklenjeno z različico (iskren 409 ob
            konfliktu — nikoli tiho ne prepišemo tučih sprememb).
          </p>
        </div>

        {/* Vabila (samo lastnik) */}
        {role === "OWNER" && (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <p className="text-sm font-medium">Povabi sodelujočega</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="invite-role" className="text-xs text-muted-foreground">
                  Vloga
                </Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EDITOR">
                      Urednik — ureja vsebino in ime
                    </SelectItem>
                    <SelectItem value="VIEWER">
                      Gledalec — vidi zasebno pot, glasuje in piše
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs text-muted-foreground">
                  E-pošta povabljenega (neobvezno — pošlje vabilo)
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ime@primer.si"
                  maxLength={160}
                  autoComplete="off"
                />
              </div>
              <Button
                onClick={() => void issueInvite()}
                disabled={busy}
                className="shrink-0"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Izdaj vabilo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Z e-pošto: vabilo prejme povabljeni naslov. Brez e-pošte (ali
              kadar pošiljanje ni konfigurirano) povezavo izdaš tu in deli
              ročno — iskreno povejemo, kaj je bilo poslano.
            </p>

            {inviteUrl && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {inviteSent ? "Vabilo poslano — povezava (tudi za ročno deljenje):" : "Povezava vabila (ročno deli):"}
                </p>
                <code className="block break-all rounded bg-background px-2 py-1 text-xs">
                  {inviteUrl}
                </code>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void copyInvite()}>
                    {copied ? (
                      <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copied ? "Skopirano" : "Kopiraj"}
                  </Button>
                  {inviteNote && (
                    <span className="text-xs text-muted-foreground">
                      {inviteNote}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seznam sodelujočih (samo lastnik) */}
        {role === "OWNER" && (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
            <p className="text-sm font-medium">Sodelujoči</p>
            {(!agg.collaborators || agg.collaborators.length === 0) && (
              <p className="text-xs text-muted-foreground">
                Še nihče ni povabljen — ta pot je tvoja (lastništvo: tvoj
                račun).
              </p>
            )}
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {(agg.collaborators ?? []).map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {c.accountEmail ?? c.accountName ?? "Povabljeni (povezava)"}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {ROLE_LABELS[c.role] ?? c.role}
                      </Badge>
                      <span>
                        {STATUS_LABELS[c.status] ?? c.status}
                        {c.acceptedAt
                          ? ` · sprejel ${new Date(c.acceptedAt).toLocaleDateString("sl-SI")}`
                          : ` · povabljen ${new Date(c.createdAt).toLocaleDateString("sl-SI")}`}
                        {c.invitedBy ? ` · povabil ${c.invitedBy}` : ""}
                      </span>
                    </p>
                  </div>
                  {c.status !== "REVOKED" && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Select
                        value={c.role}
                        onValueChange={(v) =>
                          void patchCollaborator(c.id, { role: v })
                        }
                      >
                        <SelectTrigger className="h-9 w-40" aria-label="Spremeni vlogo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Urednik</SelectItem>
                          <SelectItem value="VIEWER">Gledalec</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void revokeCollaborator(c.id)}
                        disabled={busy}
                      >
                        Odvzemi
                      </Button>
                    </div>
                  )}
                  {c.status === "REVOKED" && (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        vabilo umaknjeno
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void patchCollaborator(c.id, { status: "PENDING" })
                        }
                        disabled={busy}
                      >
                        Povabi znova
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Javna/zasebna povezava (samo lastnik) */}
        {role === "OWNER" && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Javna deljena povezava
                </p>
                <p className="text-xs text-muted-foreground">
                  Izklopljena povezava pomeni: pot vidijo samo prijavljeni
                  sodelujoči (ostali vidijo 404).
                </p>
              </div>
              <Switch
                checked={agg.isPublic}
                onCheckedChange={(v) => void togglePublic(v)}
                disabled={busy}
                aria-label="Javna povezava"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
