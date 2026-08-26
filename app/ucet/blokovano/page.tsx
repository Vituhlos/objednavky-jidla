export const dynamic = "force-dynamic";

import { AccessNotice } from "@/app/components/account/AccessNotice";

/**
 * Zablokovaný účet (R14).
 *
 * Tón navazuje na to, jak appka hlásí zavřený provoz — klidná věta, ne strohá
 * chyba. Kdo se dostal sem, prokázal heslo nebo Google, takže se smí dozvědět
 * proč ho appka nepustila dál.
 */
export default function Page() {
  return (
    <AccessNotice
      action={{ href: "/", label: "Zpět na objednávku" }}
      emoji="😔"
      text="Tenhle účet je zablokovaný. Objednávat s ním nejde, číst ano. Kdyby to byl omyl, ozvěte se správci Kantýny."
      title="Účet je zablokovaný"
    />
  );
}
