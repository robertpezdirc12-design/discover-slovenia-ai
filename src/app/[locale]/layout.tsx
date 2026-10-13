import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Navigation } from "@/components/layout/navigation";
import { Providers } from "@/components/layout/providers";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { Toaster } from "@/components/ui/toaster";
import { routing } from "@/i18n/routing";
import { OG_LOCALES } from "@/lib/page-metadata";

import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Locale poti (sl brez predpone, /en/*) — generateStaticParams ostaja
 *  (dokumentira kanon locale veje), a je izrisovanje DINAMIČNO (glej
 *  force-dynamic spodaj). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** CSP nonce zahteva dinamično izrisovanje: middleware postavi svež nonce
 *  na vsako zahtevo, SSG HTML pa bi vseboval zastarelega (blokirane
 *  skripte). Kanon Next.js CSP vodic (issue #2 §9, PRODUCT-AUDIT). */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safe = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safe, namespace: "meta" });

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: {
      default: t("title"),
      template: `%s · Discover Slovenia AI`,
    },
    description: t("description"),
    applicationName: "Discover Slovenia AI",
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    keywords: [
      "Slovenija",
      "Slovenia",
      "potovanja",
      "travel planner",
      "Bled",
      "Ljubljana",
      "itinerer",
    ],
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: "Discover Slovenia AI",
      type: "website",
      locale: OG_LOCALES[safe] ?? "sl_SI",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#2d6a3e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * LOCALE POSTAVITEV — nosi jezik strani:
 * - <html lang> glede na segment (/ = sl, /en/* = en)
 * - ThemeProvider (next-themes, class, suppressHydrationWarning)
 * - Navigation (sticky scroll-glass) + main#vsebina + Footer (mt-auto,
 *   LEPLJIV na dno v flex-col korenu) + MobileTabBar (fiksno dno, mobilni)
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // setRequestLocale ostaja (locale znana brez dinamičnega API-ja);
  // dinamičnost zdaj narekuje CSP nonce (glej export const dynamic zgoraj).
  setRequestLocale(locale);

  // CSP nonce z zahteve (middleware) → next-themes inline skripta.
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang={locale} suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <NextIntlClientProvider>
          <Providers>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              nonce={nonce}
            >
              <div className="flex min-h-screen flex-col">
                <Navigation />
                <main id="vsebina" className="flex-1">
                  {children}
                </main>
                {/* mt-auto v flex-col korenu = lepljiva noga */}
                <Footer />
              </div>
              {/* Fiksni mobilni tab bar (fiksno dno, safe-area, ≥44px) */}
              <MobileTabBar />
              {/* PWA offline — registracija SW + offline banner + osvežitev (2.4.0) */}
              <ServiceWorkerRegister />
              <Toaster />
            </ThemeProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
