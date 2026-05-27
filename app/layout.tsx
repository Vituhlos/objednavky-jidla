import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SwRegister from "./components/SwRegister";
import AppTopBar from "./components/AppTopBar";
import SessionProvider from "./components/SessionProvider";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
  preload: true,
});


export const metadata: Metadata = {
  title: "Kantýna",
  description: "Objednávkový systém obědů a pizzy",
  appleWebApp: {
    capable: true,
    title: "Kantýna",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EA580C",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getSettings();
  const pizzaEnabled = settings.pizzaEnabled !== "false";
  const session = await auth();
  const showSettings = session?.user?.role === "admin";
  return (
    <html lang="cs" className={`${inter.variable} ${plusJakarta.variable}`}>
      <head />
      <body className={inter.className}>
        <SessionProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-stone-900 focus:rounded-xl focus:shadow-lg focus:text-sm focus:font-semibold focus:outline-none"
        >
          Přeskočit na obsah
        </a>
        <div className="stage-bg" aria-hidden>
          <div className="orb orb-sky" />
          <div className="orb orb-amber" />
          <div className="orb orb-mint" />
        </div>
        <AppTopBar pizzaEnabled={pizzaEnabled} showSettings={showSettings} isLoggedIn={!!session} />
        <main id="main-content">
          {children}
        </main>
        <SwRegister />
        </SessionProvider>
      </body>
    </html>
  );
}
