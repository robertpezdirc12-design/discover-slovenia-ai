"use client";

/**
 * NOTIFICATION-BELL — P1-C (issue #3 §10): zvonček z neprebranimi v glavi.
 * ============================================================================
 * - SAMO prijavljenim (gost → skrito — /api/notifications je 401);
 * - lahek GET /api/notifications?summary=1 (samo števec): ob prikazu,
 *   ob fokusu zavihka in na 60 s (ciklično) — brez strežniškega potiska
 *   (PWA push NI implementiran — iskrena odločitev, in-app inbox);
 * - badge 9+ nad 9; aria-label s številom; klik → /notifikacije.
 */

import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";

const POLL_MS = 60_000;

export function NotificationBell() {
  const l = useLocale();
  const { status } = useSession();
  const [unread, setUnread] = React.useState<number | null>(null);

  const label = pick(l, {
    sl: "Obvestila",
    en: "Notifications",
    it: "Notifiche",
    de: "Benachrichtigungen",
    fr: "Notifications",
    es: "Notificaciones",
  });

  React.useEffect(() => {
    if (status !== "authenticated") {
      setUnread(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications?summary=1");
        if (!res.ok) return; // 401/napaka → brez lažnega števca
        const body = (await res.json()) as { unreadCount?: number };
        if (alive && typeof body.unreadCount === "number") {
          setUnread(body.unreadCount);
        }
      } catch {
        // omrežna napaka → števec ostane (iskreno brez izmišljanja)
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [status]);

  if (status !== "authenticated") return null;

  const aria =
    unread !== null && unread > 0
      ? `${label}: ${unread} ${pick(l, { sl: "neprebranih", en: "unread" })}`
      : label;

  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="tap-target relative rounded-full"
    >
      <Link href="/notifikacije" aria-label={aria} title={aria}>
        <Bell className="size-5" aria-hidden="true" />
        {unread !== null && unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground shadow-sm"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
