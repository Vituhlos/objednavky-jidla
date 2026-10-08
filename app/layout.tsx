import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SwRegister from "./components/SwRegister";
import AppTopBar from "./components/AppTopBar";
import InstallHint from "./components/InstallHint";
import SheetDragManager from "./components/SheetDragManager";
import { getSettings } from "@/lib/settings";
import { IOS_SPLASH_SCREENS, PWA_BG, splashSizeParam } from "@/lib/pwa-assets";

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
    // „default", ne „black-translucent": s průsvitným stavovým řádkem kreslí
    // iOS 26+ přes horní okraj appky rozostření. Viz .status-bar-fill v globals.css.
    statusBarStyle: "default",
    startupImage: IOS_SPLASH_SCREENS.map((s) => ({
      url: `/pwa-splash/${splashSizeParam(s)}`,
      media: `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)`,
    })),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f4ef",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getSettings();
  const pizzaEnabled = settings.pizzaEnabled !== "false";
  return (
    // Barva pozadí rovnou v HTML: než se stáhne hlavní stylopis (~100 kB), byla
    // stránka bílá, což při startu appky z plochy vypadalo jako probliknutí.
    <html lang="cs" className={`${inter.variable} ${plusJakarta.variable}`} style={{ background: PWA_BG }}>
      <body className={inter.className}>
        <div className="stage-bg" aria-hidden>
          <div className="orb orb-sky" />
          <div className="orb orb-amber" />
          <div className="orb orb-mint" />
        </div>
        <div className="status-bar-fill" aria-hidden />
        <AppTopBar pizzaEnabled={pizzaEnabled} />
        {children}
        <InstallHint />
        <SheetDragManager />
        <SwRegister />
        {/* Self-hosted Noto Color Emoji, generated into public/fonts by
            tools/download-emoji-font. Ten slices with unicode-range, so a browser
            fetches only the slice holding an emoji actually on screen. Missing file
            just 404s and the system emoji font takes over.
            Až na konci body, ne v head: stylopis v head blokuje první vykreslení
            celé stránky, a tenhle jen deklaruje písmo pro emoji. */}
        {/* eslint-disable-next-line @next/next/no-css-tags -- generated file, deliberately
            outside the bundle graph: importing it would make a missing font break the build */}
        <link href="/fonts/noto-color-emoji.css" rel="stylesheet" />
      </body>
    </html>
  );
}
