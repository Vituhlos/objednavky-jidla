export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAccountView } from "@/lib/auth/account-view";
import { AccountShell } from "@/app/components/account/AccountShell";
import { AccountOverview } from "@/app/components/account/AccountOverview";

export default async function Page() {
  const account = await getAccountView();
  if (!account) redirect("/ucet/prihlaseni?dalsi=%2Fucet");

  return (
    <AccountShell icon="person" title="Můj účet">
      <AccountOverview account={account} />
    </AccountShell>
  );
}
