import type { Metadata } from "next";
import { getRootClassName } from "@gravity-ui/uikit/server";
import "@gravity-ui/uikit/styles/fonts.css";
import "@gravity-ui/uikit/styles/styles.css";
import { GravityRoot } from "@/components/gravity";

export const metadata: Metadata = {
  title: "Gravity UI Preview — Kantýna",
  robots: "noindex",
};

export default function GravityPreviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gravityClass = getRootClassName({ theme: "light" });

  return (
    <div className={gravityClass} style={{ minHeight: "60vh" }}>
      <GravityRoot theme="light">{children}</GravityRoot>
    </div>
  );
}
