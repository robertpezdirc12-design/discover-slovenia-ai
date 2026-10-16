import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export interface SimpleSection {
  heading: string;
  body: string;
  links?: { href: string; label: string }[];
}

/**
 * Enotna vsebinska stran (pošteni stub-ovi temelja 45-a):
 * glava + uvodni odstavek + razdelki s povezavami + CTA.
 * Lokalizacijo (L {sl, en}) poda klicatelj — ta komponenta je čista.
 */
export function SimplePage({
  kicker,
  title,
  lead,
  cta,
  sections,
  children,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  cta?: { href: string; label: string };
  sections: SimpleSection[];
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={kicker} title={title} lead={lead} />

      {cta && (
        <div className="mt-6">
          <Link
            href={cta.href}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            {cta.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.heading} className="gap-3 rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{s.heading}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
              {s.links && s.links.length > 0 && (
                <ul className="space-y-1.5">
                  {s.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-6 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {children}
    </div>
  );
}
