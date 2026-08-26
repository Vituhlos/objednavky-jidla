export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getTodayPizzaOrderData } from "@/lib/pizza";
import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import PizzaPage from "@/app/components/PizzaPage";
import { getAccountView } from "@/lib/auth/account-view";
import { accountsEnabled } from "@/lib/auth/policy";

export default async function Page() {
  const s = getSettings();
  if (s.pizzaEnabled === "false") notFound();
  const data = getTodayPizzaOrderData();
  const departments = getDepartments();
  const account = await getAccountView();
  const canEdit = !accountsEnabled() || account !== null;
  const canManage = !accountsEnabled() || account?.role === "admin";
  return (
    <PizzaPage
      canEdit={canEdit}
      canManage={canManage}
      departments={departments}
      initialData={data}
      pizzaCutoffEnabled={s.pizzaCutoffEnabled === "true"}
      pizzaCutoffTime={s.pizzaCutoffTime}
      pizzaCutoffDays={s.pizzaCutoffDays}
    />
  );
}
