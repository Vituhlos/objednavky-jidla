import { getTodayOrderData } from "@/lib/orders";

export const dynamic = "force-dynamic";

export function GET() {
  const data = getTodayOrderData();
  return Response.json({
    departments: data.departments,
    totalPrice: data.totalPrice,
    status: data.order.status,
    sentAt: data.order.sentAt,
  });
}
