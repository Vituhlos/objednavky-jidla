export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAccountView } from "@/lib/auth/account-view";
import { getInvite } from "@/lib/auth/invites";
import { getDepartments } from "@/lib/departments";
import { AccountShell } from "@/app/components/account/AccountShell";
import { AccessNotice } from "@/app/components/account/AccessNotice";
import { GuestRegisterForm } from "@/app/components/account/GuestRegisterForm";

/**
 * Registrace hosta z pozvacího odkazu.
 *
 * Odkaz sám **nepřihlašuje** — jen otevře formulář. Odkaz, který rovnou
 * přihlásí, je heslo poslané po WhatsAppu.
 *
 * Platnost se ověřuje tady, aby host nevyplňoval formulář, který stejně
 * neprojde. Rozhodující kontrola je ale znovu při odeslání: mezi zobrazením
 * a odesláním může pozvatel pozvánku zrušit.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;

  if (await getAccountView()) redirect("/ucet");

  const invite = typeof token === "string" && token ? getInvite(token) : null;
  if (!invite) {
    return (
      <AccessNotice
        action={{ href: "/", label: "Zpět na objednávku" }}
        emoji="🔗"
        text="Pozvánka už byla uplatněná, zrušená, nebo jí vypršela platnost. Požádejte o novou toho, kdo vám ji poslal."
        title="Pozvánka nefunguje"
      />
    );
  }

  const departments = getDepartments().map((d) => ({ id: d.id, label: d.label }));

  return (
    <AccountShell icon="group_add" title="Pozvánka">
      <GuestRegisterForm
        departments={departments}
        inviterName={invite.inviterName}
        token={token as string}
      />
    </AccountShell>
  );
}
