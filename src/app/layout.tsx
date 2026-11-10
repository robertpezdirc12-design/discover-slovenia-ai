import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  metadataBase: new URL("https://i-feel-slovenia.vercel.app"),
  title: "Discover Slovenia AI",
  description:
    "Odkrij Slovenijo in Balkan: vodič po zemljevidu, prenočišča z indikativnimi cenami, vreme in zrak, pot v enem mestu — na odprtih podatkih (OpenStreetMap, ARSO).",
  keywords: ["Slovenija", "Balkan", "potovanja", "zemljevid", "prenočišča", "Discover Slovenia"],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Discover Slovenia AI",
    description:
      "Vodič po zemljevidu, prenočišča, vreme in pot — Slovenija in Balkan na odprtih podatkih.",
    url: "https://i-feel-slovenia.vercel.app",
    locale: "sl_SI",
    type: "website",
    siteName: "Discover Slovenia AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Discover Slovenia AI",
    description:
      "Vodič po zemljevidu, prenočišča, vreme in pot — Slovenija in Balkan na odprtih podatkih.",
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
        className={`${sourceSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
