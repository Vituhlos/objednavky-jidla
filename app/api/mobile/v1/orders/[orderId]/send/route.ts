import { sendOrder } from "@/lib/orders";
import { broadcast } from "@/lib/sse-broadcast";
import {
  requireMobileAuth,
  requireMobileAdmin,
  assertOrderDraft,
  getIdempotencyCached,
  storeIdempotency,
  mobileError,
} from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const cached = getIdempotencyCached(idempotencyKey);
  if (cached) return cached;

  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const adminErr = requireMobileAdmin(auth);
  if (adminErr) return adminErr;

  const { orderId } = await params;
  const id = parseInt(orderId, 10);
  if (!Number.isFinite(id)) {
    return mobileError("BAD_REQUEST", "Neplatné orderId", 400);
  }

  const draftErr = assertOrderDraft(id);
  if (draftErr) return draftErr;

  try {
    const order = await sendOrder(id, "manual");
    broadcast();
    storeIdempotency(idempotencyKey, order, 200);
    return Response.json(order);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chyba odeslání";
    if (message.includes("odeslan")) {
      return mobileError("ORDER_SENT", message, 409);
    }
    return mobileError("BAD_REQUEST", message, 400);
  }
}
