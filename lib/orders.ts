import { getDb } from "./db";
import { buildOrderEmail } from "./order-email";
import { buildDepartmentPdfAttachment } from "./order-pdf";
import { computeRowPrice } from "./pricing";
import { getOrderRecipients, sendEmail } from "./email";
import {
  getMenuItemById,
  getMenuItemsForDay,
  getTodayDayCode,
  seedMenuIfEmpty,
  getWeekLabel,
} from "./menu";
import type {
  Order,
  DepartmentData,
  OrderRow,
  OrderRowEnriched,
  OrderData,
  Department,
} from "./types";
import { DEPARTMENTS } from "./types";
import { isDepartmentSubmitted } from "./order-utils";

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as number,
    date: row.date as string,
    status: row.status as "draft" | "sent",
    extraEmail: row.extra_email as string | null,
    sentAt: row.sent_at as string | null,
  };
}

function mapOrderRow(row: Record<string, unknown>): OrderRow {
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    department: row.department as Department,
    sortOrder: row.sort_order as number,
    personName: (row.person_name as string) ?? "",
    soupItemId: (row.soup_item_id as number | null) ?? null,
    mainItemId: (row.main_item_id as number | null) ?? null,
    rollCount: (row.roll_count as number) ?? 0,
    breadDumplingCount: (row.bread_dumpling_count as number) ?? 0,
    potatoDumplingCount: (row.potato_dumpling_count as number) ?? 0,
    ketchupCount: (row.ketchup_count as number) ?? 0,
    tatarkaCount: (row.tatarka_count as number) ?? 0,
    bbqCount: (row.bbq_count as number) ?? 0,
    note: (row.note as string) ?? "",
  };
}

function enrichRow(row: OrderRow): OrderRowEnriched {
  const soup = row.soupItemId ? getMenuItemById(row.soupItemId) : null;
  const main = row.mainItemId ? getMenuItemById(row.mainItemId) : null;
  return {
    ...row,
    soupItem: soup,
    mainItem: main,
    rowPrice: computeRowPrice(row, soup, main),
  };
}

function getOrCreateTodayOrder(): Order {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  let order = db
    .prepare("SELECT * FROM orders WHERE date = ?")
    .get(today) as Record<string, unknown> | undefined;
  if (!order) {
    const result = db
      .prepare("INSERT INTO orders (date, status) VALUES (?, 'draft')")
      .run(today);
    order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(result.lastInsertRowid) as Record<string, unknown>;
  }
  return mapOrder(order);
}

export function getTodayOrderData(): OrderData {
  seedMenuIfEmpty(getWeekLabel());
  const order = getOrCreateTodayOrder();
  const db = getDb();

  const dayCode = getTodayDayCode();
  const todayMenu = dayCode
    ? getMenuItemsForDay(dayCode)
    : { soups: [], meals: [] };

  const rawRows = db
    .prepare(
      "SELECT * FROM order_rows WHERE order_id = ? ORDER BY department, sort_order, id"
    )
    .all(order.id) as Record<string, unknown>[];

  const rows = rawRows.map((r) => enrichRow(mapOrderRow(r)));

  const departments: DepartmentData[] = DEPARTMENTS.map((dept) => {
    const deptRows = rows.filter((r) => r.department === dept);
    const subtotal = deptRows.reduce((s, r) => s + r.rowPrice, 0);
    return { name: dept, rows: deptRows, subtotal };
  });

  return {
    order,
    departments,
    todayMenu,
    totalPrice: departments.reduce((s, d) => s + d.subtotal, 0),
    dayCode,
  };
}

export function getOrderData(orderId: number): OrderData {
  seedMenuIfEmpty(getWeekLabel());
  const db = getDb();
  const orderRaw = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown> | undefined;

  if (!orderRaw) {
    throw new Error("Objednávka nebyla nalezena.");
  }

  const order = mapOrder(orderRaw);
  const dayCode = getTodayDayCode();
  const todayMenu = dayCode
    ? getMenuItemsForDay(dayCode)
    : { soups: [], meals: [] };

  const rawRows = db
    .prepare(
      "SELECT * FROM order_rows WHERE order_id = ? ORDER BY department, sort_order, id"
    )
    .all(order.id) as Record<string, unknown>[];

  const rows = rawRows.map((r) => enrichRow(mapOrderRow(r)));
  const departments: DepartmentData[] = DEPARTMENTS.map((dept) => {
    const deptRows = rows.filter((r) => r.department === dept);
    const subtotal = deptRows.reduce((s, r) => s + r.rowPrice, 0);
    return { name: dept, rows: deptRows, subtotal };
  });

  return {
    order,
    departments,
    todayMenu,
    totalPrice: departments.reduce((s, d) => s + d.subtotal, 0),
    dayCode,
  };
}

export function addOrderRow(
  orderId: number,
  department: Department
): OrderRowEnriched {
  const db = getDb();
  const { m } = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM order_rows WHERE order_id = ? AND department = ?"
    )
    .get(orderId, department) as { m: number };

  const result = db
    .prepare(
      "INSERT INTO order_rows (order_id, department, sort_order) VALUES (?, ?, ?)"
    )
    .run(orderId, department, m + 1);

  const row = db
    .prepare("SELECT * FROM order_rows WHERE id = ?")
    .get(result.lastInsertRowid) as Record<string, unknown>;

  return enrichRow(mapOrderRow(row));
}

export function updateOrderRow(
  rowId: number,
  updates: Partial<{
    personName: string;
    soupItemId: number | null;
    mainItemId: number | null;
    rollCount: number;
    breadDumplingCount: number;
    potatoDumplingCount: number;
    ketchupCount: number;
    tatarkaCount: number;
    bbqCount: number;
    note: string;
  }>
): OrderRowEnriched {
  const db = getDb();

  const fieldMap: Record<string, string> = {
    personName: "person_name",
    soupItemId: "soup_item_id",
    mainItemId: "main_item_id",
    rollCount: "roll_count",
    breadDumplingCount: "bread_dumpling_count",
    potatoDumplingCount: "potato_dumpling_count",
    ketchupCount: "ketchup_count",
    tatarkaCount: "tatarka_count",
    bbqCount: "bbq_count",
    note: "note",
  };

  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length > 0) {
    const setClauses = entries.map(([k]) => `${fieldMap[k]} = ?`).join(", ");
    const values = entries.map(([, v]) => v);
    db.prepare(`UPDATE order_rows SET ${setClauses} WHERE id = ?`).run(
      ...values,
      rowId
    );
  }

  const row = db
    .prepare("SELECT * FROM order_rows WHERE id = ?")
    .get(rowId) as Record<string, unknown>;
  return enrichRow(mapOrderRow(row));
}

export function deleteOrderRow(rowId: number): void {
  getDb().prepare("DELETE FROM order_rows WHERE id = ?").run(rowId);
}

export async function sendOrder(orderId: number, extraEmail?: string): Promise<Order> {
  const db = getDb();
  const current = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown> | undefined;

  if (!current) {
    throw new Error("Objednávka nebyla nalezena.");
  }

  const currentOrder = mapOrder(current);
  if (currentOrder.status === "sent") {
    throw new Error("Objednávka již byla odeslána.");
  }

  const normalizedExtraEmail = extraEmail?.trim() || currentOrder.extraEmail || null;
  if (extraEmail !== undefined) {
    db.prepare("UPDATE orders SET extra_email = ? WHERE id = ?").run(
      normalizedExtraEmail,
      orderId
    );
  }

  const orderData = getOrderData(orderId);
  const activeDepartments = orderData.departments.filter(isDepartmentSubmitted);
  if (activeDepartments.length === 0) {
    throw new Error("Nebyla nalezena žádná objednávka. V tabulkách nejsou vyplněna žádná data pro export.");
  }
  const recipients = getOrderRecipients(normalizedExtraEmail);
  const email = buildOrderEmail({
    ...orderData,
    order: {
      ...orderData.order,
      extraEmail: normalizedExtraEmail,
    },
  });
  const attachments = await Promise.all(
    activeDepartments.map((department) =>
      buildDepartmentPdfAttachment(department, orderData.order.date)
    )
  );

  await sendEmail({
    to: recipients,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments,
  });

  const sentAt = new Date().toISOString();
  db.prepare(
    "UPDATE orders SET status = 'sent', sent_at = ?, extra_email = ? WHERE id = ?"
  ).run(sentAt, normalizedExtraEmail, orderId);

  const order = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown>;
  return mapOrder(order);
}

export function updateExtraEmail(orderId: number, email: string): void {
  getDb()
    .prepare("UPDATE orders SET extra_email = ? WHERE id = ?")
    .run(email, orderId);
}

export interface OrderSummary {
  id: number;
  date: string;
  status: "draft" | "sent";
  sentAt: string | null;
  extraEmail: string | null;
  rowCount: number;
}

export function reopenOrder(orderId: number): void {
  getDb()
    .prepare("UPDATE orders SET status = 'draft', sent_at = NULL WHERE id = ?")
    .run(orderId);
}

export function getOrderList(): OrderSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.id, o.date, o.status, o.sent_at, o.extra_email,
              COUNT(r.id) AS row_count
       FROM orders o
       LEFT JOIN order_rows r ON r.order_id = o.id
       GROUP BY o.id
       ORDER BY o.date DESC`
    )
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    date: r.date as string,
    status: r.status as "draft" | "sent",
    sentAt: (r.sent_at as string | null) ?? null,
    extraEmail: (r.extra_email as string | null) ?? null,
    rowCount: r.row_count as number,
  }));
}
