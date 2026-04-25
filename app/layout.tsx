import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
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
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
  preload: true,
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
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
      </body>
    </html>
  );
}
