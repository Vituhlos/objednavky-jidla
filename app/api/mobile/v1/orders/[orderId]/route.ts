import { getOrderData } from "@/lib/orders";
import { requireMobileAuth, mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const { orderId } = await params;
  const id = parseInt(orderId, 10);
  if (!Number.isFinite(id)) {
    return mobileError("BAD_REQUEST", "Neplatné orderId", 400);
  }

  try {
    return Response.json(getOrderData(id));
  } catch {
    return mobileError("NOT_FOUND", "Objednávka nenalezena", 404);
  }
}
