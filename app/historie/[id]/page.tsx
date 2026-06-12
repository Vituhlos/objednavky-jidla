export const dynamic = "force-dynamic";

import { getOrderData, orderPdfExists } from "@/lib/orders";
import { notFound } from "next/navigation";
import OrderDetailPage from "@/app/components/OrderDetailPage";
import type { OrderData } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();
  let data: OrderData;
  let hasPdf = false;
  try {
    data = getOrderData(orderId);
    hasPdf = orderPdfExists(orderId);
  } catch {
    notFound();
  }
  return <OrderDetailPage data={data} hasPdf={hasPdf} />;
}
