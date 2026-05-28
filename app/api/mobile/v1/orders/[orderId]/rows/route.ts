import { addOrderRow } from "@/lib/orders";
import { getUserById } from "@/lib/users";
import { broadcast } from "@/lib/sse-broadcast";
import type { Department, MealEntry } from "@/lib/types";
import {
  requireMobileAuth,
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

  const { orderId } = await params;
  const id = parseInt(orderId, 10);
  if (!Number.isFinite(id)) {
    return mobileError("BAD_REQUEST", "Neplatné orderId", 400);
  }

  const draftErr = assertOrderDraft(id);
  if (draftErr) return draftErr;

  let body: {
    department?: string;
    personName?: string;
    soupItemId?: number | null;
    soupItemId2?: number | null;
    mainItemId?: number | null;
    mealCount?: number;
    extraMeals?: MealEntry[];
    rollCount?: number;
    breadDumplingCount?: number;
    potatoDumplingCount?: number;
    ketchupCount?: number;
    tatarkaCount?: number;
    bbqCount?: number;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  if (!body.department) {
    return mobileError("BAD_REQUEST", "Oddělení je povinné", 400);
  }

  const user = getUserById(auth.userId);
  const personName =
    body.personName?.trim() ||
    (user ? `${user.firstName} ${user.lastName}`.trim() : "");

  try {
    const row = addOrderRow(id, body.department as Department, auth.userId, personName);
    if (
      body.soupItemId !== undefined ||
      body.soupItemId2 !== undefined ||
      body.mainItemId !== undefined ||
      body.mealCount !== undefined ||
      body.extraMeals !== undefined ||
      body.rollCount !== undefined ||
      body.breadDumplingCount !== undefined ||
      body.potatoDumplingCount !== undefined ||
      body.ketchupCount !== undefined ||
      body.tatarkaCount !== undefined ||
      body.bbqCount !== undefined ||
      body.note !== undefined
    ) {
      const { updateOrderRow } = await import("@/lib/orders");
      const updated = updateOrderRow(row.id, {
        personName,
        soupItemId: body.soupItemId,
        soupItemId2: body.soupItemId2,
        mainItemId: body.mainItemId,
        mealCount: body.mealCount,
        extraMeals: body.extraMeals,
        rollCount: body.rollCount,
        breadDumplingCount: body.breadDumplingCount,
        potatoDumplingCount: body.potatoDumplingCount,
        ketchupCount: body.ketchupCount,
        tatarkaCount: body.tatarkaCount,
        bbqCount: body.bbqCount,
        note: body.note,
      });
      broadcast();
      storeIdempotency(idempotencyKey, updated, 201);
      return Response.json(updated, { status: 201 });
    }

    broadcast();
    storeIdempotency(idempotencyKey, row, 201);
    return Response.json(row, { status: 201 });
  } catch (e) {
    return mobileError("BAD_REQUEST", e instanceof Error ? e.message : "Chyba vytvoření řádku", 400);
  }
}
