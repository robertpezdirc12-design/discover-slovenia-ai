import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Discover Slovenia AI — zemljevid in uradna prenočišča",
  description:
    "Interaktivni zemljevid: klikni državo, odpri Slovenijo, izberi »Apartmaji« in poglej vse apartmaje v Sloveniji na odprtih podatkih OpenStreetMap.",
  keywords: ["Slovenija", "apartmaji", "zemljevid", "potovanja", "OpenStreetMap", "Discover Slovenia"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Discover Slovenia AI — zemljevid in uradna prenočišča",
    description:
      "Klikni državo → odpri Slovenijo → spustni meni → apartmaji: vsi apartmaji v Sloveniji na odprtih podatkih.",
    locale: "sl_SI",
    type: "website",
    siteName: "Discover Slovenia AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl" suppressHydrationWarning>
      <body
        className={`${sourceSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
