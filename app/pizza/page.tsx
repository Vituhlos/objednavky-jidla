export const dynamic = "force-dynamic";

import { getTodayPizzaOrderData } from "@/lib/pizza";
import { getSettings } from "@/lib/settings";
import PizzaPage from "@/app/components/PizzaPage";

export default function Page() {
  const data = getTodayPizzaOrderData();
  const s = getSettings();
  return (
    <PizzaPage
      initialData={data}
      pizzaCutoffEnabled={s.pizzaCutoffEnabled === "true"}
      pizzaCutoffTime={s.pizzaCutoffTime}
      pizzaCutoffDays={s.pizzaCutoffDays}
    />
  );
}
