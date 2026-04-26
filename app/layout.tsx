import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SwRegister from "./components/SwRegister";

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
  preload: false,
});


export const metadata: Metadata = {
  title: "Objednávky",
  description: "Objednávkový systém obědů a pizzy",
  appleWebApp: {
    capable: true,
    title: "Objednávky",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#32ADE6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${inter.variable} ${plusJakarta.variable}`}>
      <head />
      <body className={inter.className}>
        {/* Orby – kit OrbBackground */}
        <div aria-hidden className="orb-stage">
          <div className="orb orb-sky" />
          <div className="orb orb-purple" />
          <div className="orb orb-mint" />
          <div className="orb orb-warm" />
          <div className="orb orb-rose" />
        </div>
        {children}
        <SwRegister />
        <Script
          id="load-material-symbols"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400..500,0..1,0&text=calendar_today%2Bcheck_circle%2Bgroups%2Bhistory%2Bhome_work%2Binfo%2Blocal_pizza%2Block%2Bmenu_book%2Bmore_vert%2Brestaurant%2Brestaurant_menu%2Bschedule%2Bsend%2Bsettings%2Bshopping_basket%2Bwarning%2Bwifi_off&display=swap';document.head.appendChild(l);})()`,
          }}
        />
      </body>
    </html>
  );
}
