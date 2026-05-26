import { getOrderData } from "@/lib/orders";
import { buildOrderEmail } from "@/lib/order-email";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) return new Response("Bad request", { status: 400 });

  try {
    const data = getOrderData(orderId);
    const email = buildOrderEmail(data);
    return new Response(email.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Chyba", { status: 500 });
  }
}
