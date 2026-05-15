export const dynamic = "force-dynamic";

import { getPizzaOrderData } from "@/lib/pizza";
import { notFound } from "next/navigation";
import PizzaDetailPage from "@/app/components/PizzaDetailPage";

export default async function TenantPizzaDetailPage({ params }: { params: Promise<{ tenantSlug: string; id: string }> }) {
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
