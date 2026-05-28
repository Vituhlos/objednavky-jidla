import { updateOrderRow, deleteOrderRow } from "@/lib/orders";
import { broadcast } from "@/lib/sse-broadcast";
import type { MealEntry } from "@/lib/types";
import { getDb } from "@/lib/db";
import {
  requireMobileAuth,
  assertRowOwnership,
  assertOrderDraft,
  getIdempotencyCached,
  storeIdempotency,
  mobileError,
} from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

function getRowOrderId(rowId: number): number | null {
  const r = getDb()
    .prepare("SELECT order_id FROM order_rows WHERE id = ?")
    .get(rowId) as { order_id: number } | undefined;
  return r?.order_id ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const cached = getIdempotencyCached(idempotencyKey);
  if (cached) return cached;

  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const { rowId } = await params;
  const id = parseInt(rowId, 10);
  if (!Number.isFinite(id)) {
    return mobileError("BAD_REQUEST", "Neplatné rowId", 400);
  }

  const ownErr = assertRowOwnership(id, auth);
  if (ownErr) return ownErr;

  const orderId = getRowOrderId(id);
  if (orderId === null) return mobileError("NOT_FOUND", "Řádek nenalezen", 404);
  const draftErr = assertOrderDraft(orderId);
  if (draftErr) return draftErr;

  let body: Partial<{
    personName: string;
    soupItemId: number | null;
    soupItemId2: number | null;
    mainItemId: number | null;
    mealCount: number;
    extraMeals: MealEntry[];
    rollCount: number;
    breadDumplingCount: number;
    potatoDumplingCount: number;
    ketchupCount: number;
    tatarkaCount: number;
    bbqCount: number;
    note: string;
  }>;
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  try {
    const row = updateOrderRow(id, body);
    broadcast();
    storeIdempotency(idempotencyKey, row, 200);
    return Response.json(row);
  } catch (e) {
    return mobileError("BAD_REQUEST", e instanceof Error ? e.message : "Chyba úpravy řádku", 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const cached = getIdempotencyCached(idempotencyKey);
  if (cached) return cached;

  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const { rowId } = await params;
  const id = parseInt(rowId, 10);
  if (!Number.isFinite(id)) {
    return mobileError("BAD_REQUEST", "Neplatné rowId", 400);
  }

  const ownErr = assertRowOwnership(id, auth);
  if (ownErr) return ownErr;

  const orderId = getRowOrderId(id);
  if (orderId === null) return mobileError("NOT_FOUND", "Řádek nenalezen", 404);
  const draftErr = assertOrderDraft(orderId);
  if (draftErr) return draftErr;

  deleteOrderRow(id);
  broadcast();
  storeIdempotency(idempotencyKey, { ok: true }, 204);
  return new Response(null, { status: 204 });
}
