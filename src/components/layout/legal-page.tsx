"use client";

import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { pick } from "@/lib/i18n-pick";

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
  links?: { href: string; label: string; external?: boolean }[];
}

/**
 * PRAVNA/VSEBINSKA STRAN — naslov, datum posodobitve, oštevilčeni razdelki
 * z zasidranimi naslovi (dlje berljiv dokument, enoten izgled).
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  const l = useLocale();
  const updatedLabel = pick(l, {
    sl: "Zadnja posodobitev",
    en: "Last updated",
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={title} />
      <p className="mt-2 text-sm text-muted-foreground">
        {updatedLabel}: {updated}
      </p>
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>
      )}

      <div className="mt-10 space-y-8">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
            <h2
              id={`${s.id}-h`}
              className="text-lg font-bold tracking-tight sm:text-xl"
            >
              <span className="mr-2 text-primary">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {s.paragraphs.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {p}
                </p>
              ))}
              {s.links && s.links.length > 0 && (
                <ul className="space-y-1.5">
                  {s.links.map((link) =>
                    link.external ? (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {link.label}
                        </a>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
