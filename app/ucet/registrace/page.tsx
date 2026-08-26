export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAccountView } from "@/lib/auth/account-view";
import { getDepartments } from "@/lib/departments";
import { AccountShell } from "@/app/components/account/AccountShell";
import { RegisterForm } from "@/app/components/account/RegisterForm";

export default async function Page() {
  if (await getAccountView()) redirect("/ucet");

  const departments = getDepartments().map((d) => ({ id: d.id, label: d.label }));

  return (
    <AccountShell icon="person_add" title="Registrace">
      <RegisterForm departments={departments} />
    </AccountShell>
  );
}
