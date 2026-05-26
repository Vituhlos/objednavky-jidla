export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getTodayPizzaOrderData } from "@/lib/pizza";
import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import PizzaPage from "@/app/components/PizzaPage";

export default function Page() {
  const s = getSettings();
  if (s.pizzaEnabled === "false") notFound();
  const data = getTodayPizzaOrderData();
  const departments = getDepartments();
  return (
    <PizzaPage
      departments={departments}
      initialData={data}
      pizzaCutoffEnabled={s.pizzaCutoffEnabled === "true"}
      pizzaCutoffTime={s.pizzaCutoffTime}
      pizzaCutoffDays={s.pizzaCutoffDays}
    />
  );
}
