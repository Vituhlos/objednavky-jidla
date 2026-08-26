export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { GOOGLE_LINK_COOKIE, readPendingGoogleLink } from "@/lib/auth/oauth";
import { AccountShell } from "@/app/components/account/AccountShell";
import { AccessNotice } from "@/app/components/account/AccessNotice";
import { GoogleLinkForm } from "@/app/components/account/GoogleLinkForm";

/**
 * Potvrzení hesla při propojování Googlu s existujícím účtem.
 *
 * Podepsanou cookie čte server; do klienta jde jen e-mail, ke kterému se
 * propojuje. Obsah cookie ani `subject` se do props nikdy nedostanou.
 */
export default async function Page() {
  const sealed = (await cookies()).get(GOOGLE_LINK_COOKIE)?.value;
  const pending = sealed ? readPendingGoogleLink(sealed) : null;

  if (!pending) {
    return (
      <AccessNotice
        action={{ href: "/ucet/prihlaseni", label: "Zpět na přihlášení" }}
        emoji="⏳"
        text="Propojení platí deset minut a to už uplynulo. Zkuste přihlášení přes Google znovu."
        title="Propojení vypršelo"
      />
    );
  }

  return (
    <AccountShell icon="link" title="Propojit Google">
      <GoogleLinkForm email={pending.email} />
    </AccountShell>
  );
}
