'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  GUIDE_EVENT,
  emptyGuideState,
  isGuideSparse,
  loadGuideState,
  mergeGuideStates,
  sameGuideContent,
  sanitizeGuideState,
  saveGuideState,
  type GuideState,
} from '@/lib/guide-store';

// Tudi če strežnik ali povezava obvisi, serializirana vrsta ne sme čakati
// v nedogled — lokalno stanje ostane, naslednja sprememba poskusi znova.
const SYNC_TIMEOUT_MS = 8_000;

function isNewer(a: GuideState, b: GuideState): boolean {
  const aTime = Date.parse(a.updatedAt);
  const bTime = Date.parse(b.updatedAt);
  return Number.isFinite(aTime) && Number.isFinite(bTime) && aTime > bTime;
}

function isEmptyGuide(state: GuideState): boolean {
  return (
    state.interests.length === 0 &&
    state.region === null &&
    state.days === null &&
    state.pace === null &&
    state.answered.length === 0 &&
    state.stays.length === 0 &&
    state.completedAt === null &&
    !state.voiceEnabled
  );
}

/**
 * Sinhronizacija localStorage ↔ strežniški profil.
 *
 * Ob nalaganju primerja vsebino: enaka vsebina ne sproži nepotrebnega PUT
 * in dvojnega server renderja. Če je lokalno stanje novejše, ga pošlje;
 * če je strežniško novejše (npr. drug brskalnik), ga obnovi lokalno.
 *
 * Ob spremembi po zaključku vodenega toka osveži strežniški render, da se
 * PersonalHomeSection ne ujame s starimi priporočili. PUT-i so serializirani:
 * počasnejša stara zahteva ne more prepisati novejšega stanja.
 */
export function ProfileSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const suppress = useRef(false);
  const lastCompleted = useRef<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastCompleted.current = null;
      return;
    }

    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      return; // shramba blokirana — brez lokalnega stanja ni česa sinhronizirati
    }

    // Razlikujemo »nov brskalnik« (lokalnega stanja ni bilo) od izrecnega
    // »Začni znova« med čakanjem na GET. Slednji ne sme oživiti starega profila.
    const hadLocalAtStart = loadGuideState(storage) !== null;

    let cancelled = false;
    let sawGuideEvent = false;
    let resetDuringHydration = false;
    let hydrationDone = false;
    let hydrating = false;
    let hydrationAttempts = 0;
    let hydrationRetry: ReturnType<typeof setTimeout> | null = null;
    let queued: GuideState | null = null;
    let queuedForceRefresh = false;
    let pushing = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const send = async (state: GuideState): Promise<boolean> => {
      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ state }),
          signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    const requestRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (!cancelled) router.refresh();
      }, 120);
    };

    const afterSuccessfulPush = (state: GuideState, force: boolean) => {
      const complete = Boolean(state.completedAt);
      // Prvi push po prijavi vedno osveži stran; poznejši pushi pa takrat,
      // ko je uporabnik že zaključil (tudi če je odgovor pozneje spremenil).
      if (force || complete || lastCompleted.current === true) {
        requestRefresh();
      }
      lastCompleted.current = complete;
    };

    const drain = async () => {
      if (pushing) return;
      pushing = true;
      try {
        while (queued && !cancelled) {
          const state = queued;
          const force = queuedForceRefresh;
          queued = null;
          queuedForceRefresh = false;

          const ok = await send(state);
          if (!cancelled && ok) afterSuccessfulPush(state, force);
        }
      } finally {
        pushing = false;
      }
    };

    const enqueuePush = (state: GuideState, forceRefresh = false) => {
      queued = state;
      queuedForceRefresh = queuedForceRefresh || forceRefresh;
      void drain();
    };

    const schedulePush = () => {
      if (cancelled || suppress.current) return;
      sawGuideEvent = true;

      const local = loadGuideState(storage);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      if (!local) {
        // »Začni znova« je pobrisal localStorage — to je popoln namen in ne
        // sme čakati na prvo branje profila. Če se zgodi med hydrationom,
        // kasnejše spajanje ne sme oživiti starih strežniških odgovorov.
        if (!hydrationDone) resetDuringHydration = true;
        enqueuePush(emptyGuideState(), true);
        return;
      }

      // Prvo branje profila še teče. Lokalno stanje je lahko le delno
      // (npr. uporabnik je vklopil govor), zato ga ne pošiljamo, dokler ne
      // vemo, ali na strežniku že obstaja profil. Ob koncu branja ga spojimo.
      if (!hydrationDone) {
        if (!hydrating && !hydrationRetry) void hydrate();
        return;
      }

      timer.current = setTimeout(() => {
        timer.current = null;
        if (cancelled) return;
        const current = loadGuideState(storage);
        if (!current) {
          enqueuePush(emptyGuideState(), true);
        } else {
          enqueuePush(current);
        }
      }, 700);
    };

    const restore = (state: GuideState) => {
      // Prekliči morebitni odloženi lokalni push — strežniško stanje je novejše.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      suppress.current = true;
      try {
        saveGuideState(storage, state);
        window.dispatchEvent(new CustomEvent(GUIDE_EVENT));
      } catch {
        /* shramba je blokirana — strežniško stanje ostane vir resnice */
      } finally {
        suppress.current = false;
      }
      lastCompleted.current = Boolean(state.completedAt);
    };

    const finishHydration = (server: GuideState | null) => {
      // Med čakanjem na GET se je uporabnik lahko že odzval v vodiču —
      // zato znova preberemo lokalno stanje, ne pa začetnega posnetka.
      const local = loadGuideState(storage);

      // Uporabnik je med hydrationom kliknil »Začni znova«. Njegov novi
      // lokalni namen (tudi če je le vklop govora) je zdaj edini vir resnice.
      if (resetDuringHydration) {
        enqueuePush(local ?? emptyGuideState(), true);
        return;
      }

      if (!local) {
        // Lokalnega stanja ni bilo že ob začetku ali pa je izginilo brez
        // dogodka. Če je na začetku obstajalo, spoštujemo uporabnikov izbris;
        // sicer obnovimo strežniški profil.
        if (hadLocalAtStart || sawGuideEvent) {
          enqueuePush(emptyGuideState(), true);
          return;
        }
        if (server && !isEmptyGuide(server)) restore(server);
        return;
      }

      if (server && sameGuideContent(local, server)) {
        lastCompleted.current = Boolean(local.completedAt);
        return;
      }

      // Nov brskalnik: lokalno stanje je nastalo med branjem profila, zato
      // ne sme prepisati obstoječih strežniških odgovorov. Spojimo jih.
      // Enako velja za delno lokalno stanje (npr. samo vklop govora).
      const shouldMerge = (!hadLocalAtStart && sawGuideEvent) || isGuideSparse(local);
      if (server && !isEmptyGuide(server) && shouldMerge) {
        const merged = mergeGuideStates(server, local);
        restore(merged);
        enqueuePush(merged, true);
        return;
      }

      // Če se je uporabnik med GET že odzval, njegova sveža lokalna odločitev
      // premaga staro strežniško stanje. Tako tudi PUT, ki je morda že v teku,
      // ne more biti prepisan z starejšim odgovorom GET.
      if (server && isNewer(server, local) && !sawGuideEvent) {
        restore(server);
        return;
      }

      // Prvi push po prijavi vedno osveži strežniški render, tudi če je
      // profil še nedokončan. Tako se priporočila takoj vežejo na odgovore.
      enqueuePush(local, true);
    };

    window.addEventListener(GUIDE_EVENT, schedulePush);

    const hydrate = async () => {
      if (cancelled || hydrating || hydrationDone) return;
      hydrating = true;
      hydrationAttempts += 1;

      let server: GuideState | null = null;
      let ok = false;
      let retryable = true;
      try {
        const res = await fetch('/api/profile', {
          cache: 'no-store',
          signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
        });
        if (!res.ok) {
          // Brez seje nima smisla ponavljati; ob 503/429 pa poskusi pozneje.
          retryable = res.status !== 401;
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          ok?: boolean;
          profile?: { state?: unknown } | null;
        };
        if (json.ok !== true) throw new Error('Profil ni na voljo.');
        server = sanitizeGuideState(json.profile?.state);
        ok = true;
      } catch {
        /* offline ali baza ni dosegljiva — lokalno stanje ostane */
      } finally {
        hydrating = false;
      }
      if (cancelled) return;

      if (!ok) {
        if (retryable) {
          const delay = 3_000 * Math.min(10, hydrationAttempts);
          hydrationRetry = setTimeout(() => {
            hydrationRetry = null;
            void hydrate();
          }, delay);
        }
        return;
      }

      hydrationDone = true;
      finishHydration(server);
    };

    void hydrate();

    return () => {
      cancelled = true;
      window.removeEventListener(GUIDE_EVENT, schedulePush);
      if (timer.current) clearTimeout(timer.current);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (hydrationRetry) clearTimeout(hydrationRetry);
      timer.current = null;
      refreshTimer = null;
      hydrationRetry = null;
    };
  }, [enabled, router]);

  return null;
}
