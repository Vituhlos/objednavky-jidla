export const dynamic = "force-dynamic";

import { getOrderListWithDepts, getHistoryStats, getCalendarHeatmap } from "@/lib/orders";
import { getPizzaOrderList } from "@/lib/pizza";
import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getPragueNow } from "@/lib/time";
import HistoryPage from "@/app/components/HistoryPage";

export default function Page() {
  const orders = getOrderListWithDepts();
  const pizzaEnabled = getSettings().pizzaEnabled !== "false";
  const pizzaOrders = pizzaEnabled ? getPizzaOrderList() : [];
  const stats = getHistoryStats();
  const now = getPragueNow();
  const initialHeatmap = getCalendarHeatmap(now.getFullYear(), now.getMonth() + 1);
  const departments = getDepartments();
  return (
    <HistoryPage
      orders={orders}
      pizzaOrders={pizzaOrders}
      pizzaEnabled={pizzaEnabled}
      stats={stats}
      initialHeatmap={initialHeatmap}
      initialYear={now.getFullYear()}
      initialMonth={now.getMonth() + 1}
      departments={departments}
    />
  );
}
