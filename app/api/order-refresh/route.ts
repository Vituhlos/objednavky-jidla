import { getOrderDataForDate, getTodayOrderData } from "@/lib/orders";
import { getAppSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session) return Response.json({ error: "Přihlášení vyžadováno" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Neplatné datum" }, { status: 400 });
  }
  try {
    const data = date ? getOrderDataForDate(date) : getTodayOrderData();
    return Response.json({
      departments: data.departments,
      totalPrice: data.totalPrice,
      status: data.order.status,
      sentAt: data.order.sentAt,
    });
  } catch {
    return Response.json({ error: "Chyba načítání objednávky" }, { status: 500 });
  }
}
