import { getDb } from "./db";

export type AuditAction =
  | "row_add"
  | "row_update"
  | "row_delete"
  | "order_send"
  | "order_reopen"
  | "order_clear"
  | "auto_send";

export interface AuditEntry {
  id: number;
  ts: string;
  action: AuditAction;
  orderId: number | null;
  department: string | null;
  personName: string | null;
  details: string | null;
}

export function logAudit(entry: {
  action: AuditAction;
  orderId?: number | null;
  department?: string | null;
  personName?: string | null;
  details?: string | null;
}): void {
  try {
    getDb()
      .prepare(
        "INSERT INTO audit_log (action, order_id, department, person_name, details) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        entry.action,
        entry.orderId ?? null,
        entry.department ?? null,
        entry.personName ?? null,
        entry.details ?? null
      );
  } catch {
    // audit failures must never crash the main flow
  }
}

export function getAuditLog(orderId: number): AuditEntry[] {
  return (
    getDb()
      .prepare(
        "SELECT * FROM audit_log WHERE order_id = ? ORDER BY id DESC"
      )
      .all(orderId) as Record<string, unknown>[]
  ).map((r) => ({
    id: r.id as number,
    ts: r.ts as string,
    action: r.action as AuditAction,
    orderId: r.order_id as number | null,
    department: r.department as string | null,
    personName: r.person_name as string | null,
    details: r.details as string | null,
  }));
}
