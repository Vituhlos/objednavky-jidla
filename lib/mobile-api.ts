import { getDb } from "@/lib/db";
import type { MobileSession } from "@/lib/mobile-auth";
import { requireMobileSession } from "@/lib/mobile-auth";

export function mobileError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return Response.json({ error: { code, message, details } }, { status });
}

export function requireMobileAuth(request: Request): MobileSession | Response {
  const session = requireMobileSession(request);
  if (!session) return mobileError("UNAUTHORIZED", "Přihlášení vyžadováno", 401);
  return session;
}

export function requireMobileAdmin(session: MobileSession): Response | null {
  if (session.role !== "admin") {
    return mobileError("FORBIDDEN", "Nemáte oprávnění administrátora", 403);
  }
  return null;
}

export function assertRowOwnership(rowId: number, session: MobileSession): Response | null {
  if (session.role === "admin") return null;
  const r = getDb()
    .prepare("SELECT user_id FROM order_rows WHERE id = ?")
    .get(rowId) as { user_id: number | null } | undefined;
  if (!r) return mobileError("NOT_FOUND", "Řádek nenalezen", 404);
  if (r.user_id !== session.userId) {
    return mobileError("FORBIDDEN", "Nemáte oprávnění upravovat cizí řádek", 403);
  }
  return null;
}

export function assertOrderDraft(orderId: number): Response | null {
  const r = getDb()
    .prepare("SELECT status FROM orders WHERE id = ?")
    .get(orderId) as { status: string } | undefined;
  if (!r) return mobileError("NOT_FOUND", "Objednávka nenalezena", 404);
  if (r.status === "sent") {
    return mobileError("ORDER_SENT", "Objednávka je již odeslaná", 403);
  }
  return null;
}

export function getIdempotencyCached(key: string | null): Response | null {
  if (!key) return null;
  const row = getDb()
    .prepare("SELECT response_body, status_code FROM mobile_idempotency WHERE key = ?")
    .get(key) as { response_body: string; status_code: number } | undefined;
  if (!row) return null;
  return new Response(row.response_body, {
    status: row.status_code,
    headers: { "Content-Type": "application/json", "X-Idempotency-Replay": "true" },
  });
}

export function storeIdempotency(key: string | null, body: unknown, status: number): void {
  if (!key) return;
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO mobile_idempotency (key, response_body, status_code) VALUES (?, ?, ?)",
    )
    .run(key, JSON.stringify(body), status);
}

export function parseIsoDate(value: string | null): string | Response {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return mobileError("BAD_REQUEST", "Neplatné datum (očekáván formát YYYY-MM-DD)", 400);
  }
  return value;
}

export { buildAppConfig, toUserProfile, type UserProfile } from "@/lib/mobile-user";
