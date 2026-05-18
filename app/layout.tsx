import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import SwRegister from "./components/SwRegister";
import AppTopBar from "./components/AppTopBar";
import OfflineBanner from "./components/OfflineBanner";
import { getCurrentUser } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
  preload: false,
});


export const metadata: Metadata = {
  title: "Kantýna",
  description: "Objednávkový systém obědů a pizzy",
  appleWebApp: {
    capable: true,
    title: "Kantýna",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#32ADE6",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const hideSidebar = h.get("x-is-super-admin") === "1" || h.get("x-no-sidebar") === "1";
  const user = hideSidebar ? null : await getCurrentUser().catch(() => null);
  return (
    <html lang="cs" className={`${inter.variable} ${plusJakarta.variable}`}>
      <head />
      <body className={inter.className}>
        {!hideSidebar && (
          <div className="stage-bg" aria-hidden>
            <div className="orb orb-sky" />
            <div className="orb orb-amber" />
            <div className="orb orb-mint" />
          </div>
        )}
        {!hideSidebar && <AppTopBar initialUser={user} />}
        {!hideSidebar && <OfflineBanner />}
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
