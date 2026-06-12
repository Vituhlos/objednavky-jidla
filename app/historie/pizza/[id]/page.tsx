export const dynamic = "force-dynamic";

import { getPizzaOrderData } from "@/lib/pizza";
import { notFound } from "next/navigation";
import PizzaDetailPage from "@/app/components/PizzaDetailPage";
import { getSettings } from "@/lib/settings";
import type { PizzaOrderData } from "@/lib/pizza";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (getSettings().pizzaEnabled === "false") notFound();
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();
  let data: PizzaOrderData;
  try {
    data = getPizzaOrderData(orderId);
  } catch {
    notFound();
  }
  return <PizzaDetailPage data={data} />;
}
