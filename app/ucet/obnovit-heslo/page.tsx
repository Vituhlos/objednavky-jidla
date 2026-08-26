export const dynamic = "force-dynamic";

import { AccountShell } from "@/app/components/account/AccountShell";
import { AccessNotice } from "@/app/components/account/AccessNotice";
import { ResetPasswordForm } from "@/app/components/account/PasswordForms";

/**
 * Nastavení nového hesla z odkazu.
 *
 * Token se sem dostane jen jako hodnota v props formuláře — platnost ověřuje
 * až server při odeslání. Ověřovat ji dvakrát by znamenalo dát útočníkovi
 * způsob, jak si tokeny otestovat bez pokusu o změnu.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;

  if (typeof token !== "string" || token.length === 0) {
    return (
      <AccessNotice
        action={{ href: "/ucet/zapomenute-heslo", label: "Vyžádat nový odkaz" }}
        emoji="🔗"
        text="Odkaz je neúplný. Pošlete si nový."
        title="Odkaz nefunguje"
      />
    );
  }

  return (
    <AccountShell icon="lock_reset" title="Nové heslo">
      <ResetPasswordForm token={token} />
    </AccountShell>
  );
}
