import { getOrderDataForDate, getTodayOrderData } from "@/lib/orders";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const data = date ? getOrderDataForDate(date) : getTodayOrderData();
  return Response.json({
    departments: data.departments,
    totalPrice: data.totalPrice,
    status: data.order.status,
    sentAt: data.order.sentAt,
  });
}
