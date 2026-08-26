export const dynamic = "force-dynamic";

import { AccountShell } from "@/app/components/account/AccountShell";
import { ForgottenPasswordForm } from "@/app/components/account/PasswordForms";

export default function Page() {
  return (
    <AccountShell icon="lock_reset" title="Zapomenuté heslo">
      <ForgottenPasswordForm />
    </AccountShell>
  );
}
