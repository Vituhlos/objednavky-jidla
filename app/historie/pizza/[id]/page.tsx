export const dynamic = "force-dynamic";

import { getPizzaOrderData } from "@/lib/pizza";
import { notFound } from "next/navigation";
import PizzaDetailPage from "@/app/components/PizzaDetailPage";
import { getSettings } from "@/lib/settings";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (getSettings().pizzaEnabled === "false") notFound();
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();
  try {
    const data = getPizzaOrderData(orderId);
    return <PizzaDetailPage data={data} />;
  } catch {
    notFound();
  }
}
