import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Discover Slovenia AI",
  description:
    "Odkrij Slovenijo in Balkan: vodič po zemljevidu, prenočišča z indikativnimi cenami, vreme in zrak, pot v enem mestu — na odprtih podatkih (OpenStreetMap, ARSO).",
  keywords: ["Slovenija", "Balkan", "potovanja", "zemljevid", "prenočišča", "Discover Slovenia"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Discover Slovenia AI",
    description:
      "Vodič po zemljevidu, prenočišča, vreme in pot — Slovenija in Balkan na odprtih podatkih.",
    locale: "sl_SI",
    type: "website",
    siteName: "Discover Slovenia AI",
  },
  twitter: {
    card: "summary",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
