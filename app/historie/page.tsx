export const dynamic = "force-dynamic";
export const metadata = { title: "Historie" };

import { getOrderList } from "@/lib/orders";
import { getPizzaOrderList } from "@/lib/pizza";
import { getSettings } from "@/lib/settings";
import HistoryPage from "@/app/components/HistoryPage";

export default function Page() {
  const orders = getOrderList();
  const pizzaEnabled = getSettings().pizzaEnabled !== "false";
  const pizzaOrders = pizzaEnabled ? getPizzaOrderList() : [];
  return <HistoryPage orders={orders} pizzaOrders={pizzaOrders} pizzaEnabled={pizzaEnabled} />;
}
