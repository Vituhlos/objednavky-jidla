export const dynamic = "force-dynamic";

import { consumeVerificationToken } from "@/lib/auth/mail";
import { AccessNotice } from "@/app/components/account/AccessNotice";

/**
 * Ověření e-mailu z odkazu.
 *
 * Token se spotřebovává na serveru při vykreslení — do klienta se nikdy
 * nedostane. Neplatný a prošlý odkaz končí stejně: backend je nerozlišuje,
 * aby z odpovědi nešlo číst, který token existoval.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;

  let hotovo = false;
  if (typeof token === "string" && token.length > 0) {
    try {
      consumeVerificationToken(token);
      hotovo = true;
    } catch {
      hotovo = false;
    }
  }

  return hotovo ? (
    <AccessNotice
      action={{ href: "/ucet", label: "Zpět na účet" }}
      emoji="✅"
      text="E-mail je ověřený. Nic dalšího dělat nemusíte."
      title="Hotovo"
    />
  ) : (
    <AccessNotice
      action={{ href: "/ucet", label: "Zpět na účet" }}
      emoji="⏳"
      text="Odkaz už byl použitý, nebo mu vypršela platnost. Nový si pošlete ze svého účtu."
      title="Odkaz nefunguje"
    />
  );
}
