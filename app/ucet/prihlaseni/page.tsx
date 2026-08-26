export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAccountView } from "@/lib/auth/account-view";
import { isGoogleConfigured } from "@/lib/auth/oauth";
import { AccountShell } from "@/app/components/account/AccountShell";
import { LoginForm } from "@/app/components/account/LoginForm";
import { safeInternalPath } from "@/lib/auth/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeInternalPath(params.dalsi);
  const googleFailed = params.chyba === "google";

  // Přihlášený tu nemá co dělat.
  if (await getAccountView()) redirect(next);

  return (
    <AccountShell icon="login" title="Přihlášení">
      <LoginForm googleEnabled={isGoogleConfigured()} googleFailed={googleFailed} next={next} />
    </AccountShell>
  );
}
