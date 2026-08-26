export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAccountView } from "@/lib/auth/account-view";
import { isGoogleConfigured } from "@/lib/auth/oauth";
import { AccountShell } from "@/app/components/account/AccountShell";
import { LoginForm } from "@/app/components/account/LoginForm";

/**
 * Kam poslat člověka po přihlášení.
 *
 * Cíl přichází z adresního řádku, takže se do něj dá napsat cokoli — včetně
 * cizí domény. Pustíme jen cestu uvnitř aplikace: musí začínat jedním
 * lomítkem a nesmí obsahovat schéma. Bez toho by z přihlašovací stránky byl
 * odrazový můstek na phishing, který má navíc důvěryhodnou adresu.
 */
function safeNext(raw: string | string[] | undefined): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes(":")) return "/";
  return raw;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.dalsi);

  // Přihlášený tu nemá co dělat.
  if (await getAccountView()) redirect(next);

  return (
    <AccountShell icon="login" title="Přihlášení">
      <LoginForm googleEnabled={isGoogleConfigured()} next={next} />
    </AccountShell>
  );
}
