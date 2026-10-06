import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Navigation } from "@/components/layout/navigation";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { routing } from "@/i18n/routing";

import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Statične locale poti (sl brez predpone, /en/*).
 *  generateStaticParams omogoča statično izrisovanje obeh jezikovnih vej. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safe = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safe, namespace: "meta" });

  return {
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
      locale: safe === "en" ? "en_US" : "sl_SI",
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
  // Statično izrisovanje: instanca zahteve pozna locale brez dinamičnih API-jev.
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
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
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
