import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "./components/SwRegister";

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
    <html lang="cs">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
      </head>
      <body>
        {/* Orby – kit OrbBackground */}
        <div aria-hidden className="orb-stage">
          <div className="orb orb-sky" />
          <div className="orb orb-purple" />
          <div className="orb orb-mint" />
        </div>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
