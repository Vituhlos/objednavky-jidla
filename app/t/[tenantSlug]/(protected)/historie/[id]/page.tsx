export const dynamic = "force-dynamic";

import { getOrderData, orderPdfExists } from "@/lib/orders";
import { notFound } from "next/navigation";
import OrderDetailPage from "@/app/components/OrderDetailPage";

export default async function TenantOrderDetailPage({ params }: { params: Promise<{ tenantSlug: string; id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();
  try {
    const data = getOrderData(orderId);
    return <OrderDetailPage data={data} hasPdf={orderPdfExists(orderId)} />;
  } catch {
    notFound();
  }
}
