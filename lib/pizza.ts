import { getDb } from "./db";
import { computePizzaTotals } from "./pizza-utils";
import { getPragueISODate } from "./time";
export { PIZZA_BOX_FEE, PIZZA_DELIVERY, computePizzaTotals } from "./pizza-utils";
export type { PizzaTotals } from "./pizza-utils";

export interface PizzaItem {
  id: number;
  code: number;
  name: string;
  price: number;
}

export interface PizzaOrder {
  id: number;
  date: string;
  status: "draft" | "sent";
  sentAt: string | null;
}

export interface PizzaOrderRow {
  id: number;
  orderId: number;
  sortOrder: number;
  personName: string;
  pizzaItemId: number | null;
  pizzaItem: PizzaItem | null;
  count: number;
  rowPrice: number;
}

export interface PizzaOrderData {
  order: PizzaOrder;
  rows: PizzaOrderRow[];
  pizzaItems: PizzaItem[];
  totalCount: number;
  totals: import("./pizza-utils").PizzaTotals;
}

function mapItem(row: Record<string, unknown>): PizzaItem {
  return {
    id: row.id as number,
    code: row.code as number,
    name: row.name as string,
    price: row.price as number,
  };
}

function mapOrder(row: Record<string, unknown>): PizzaOrder {
  return {
    id: row.id as number,
    date: row.date as string,
    status: row.status as "draft" | "sent",
    sentAt: (row.sent_at as string | null) ?? null,
  };
}

function enrichRow(row: Record<string, unknown>, items: PizzaItem[]): PizzaOrderRow {
  const pizzaItemId = (row.pizza_item_id as number | null) ?? null;
  const pizzaItem = items.find((i) => i.id === pizzaItemId) ?? null;
  const count = (row.count as number) ?? 1;
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    sortOrder: row.sort_order as number,
    personName: (row.person_name as string) ?? "",
    pizzaItemId,
    pizzaItem,
    count,
    rowPrice: pizzaItem ? pizzaItem.price * count : 0,
  };
}

function getOrCreateTodayOrder(): PizzaOrder {
  const db = getDb();
  const today = getPragueISODate();
  let order = db
    .prepare("SELECT * FROM pizza_orders WHERE date = ?")
    .get(today) as Record<string, unknown> | undefined;
  if (!order) {
    const result = db
      .prepare("INSERT INTO pizza_orders (date, status) VALUES (?, 'draft')")
      .run(today);
    order = db
      .prepare("SELECT * FROM pizza_orders WHERE id = ?")
      .get(result.lastInsertRowid) as Record<string, unknown>;
  }
  return mapOrder(order);
}

export function getPizzaItems(): PizzaItem[] {
  const db = getDb();
  return (
    db.prepare("SELECT * FROM pizza_items ORDER BY code").all() as Record<string, unknown>[]
  ).map(mapItem);
}

export function replacePizzaItems(
  items: Array<{ code: number; name: string; price: number }>
): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE pizza_order_rows SET pizza_item_id = NULL").run();
    db.prepare("DELETE FROM pizza_items").run();
    const stmt = db.prepare(
      "INSERT INTO pizza_items (code, name, price) VALUES (?, ?, ?)"
    );
    for (const item of items) {
      stmt.run(item.code, item.name, item.price);
    }
  })();
}

export function getTodayPizzaOrderData(): PizzaOrderData {
  const order = getOrCreateTodayOrder();
  const db = getDb();
  const items = getPizzaItems();
  const rawRows = db
    .prepare(
      "SELECT * FROM pizza_order_rows WHERE order_id = ? ORDER BY sort_order, id"
    )
    .all(order.id) as Record<string, unknown>[];
  const rows = rawRows.map((r) => enrichRow(r, items));
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  return {
    order,
    rows,
    pizzaItems: items,
    totalCount,
    totals: computePizzaTotals(rows),
  };
}

export function addPizzaRow(orderId: number): PizzaOrderRow {
  const db = getDb();
  const { m } = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM pizza_order_rows WHERE order_id = ?"
    )
    .get(orderId) as { m: number };
  const result = db
    .prepare(
      "INSERT INTO pizza_order_rows (order_id, sort_order) VALUES (?, ?)"
    )
    .run(orderId, m + 1);
  const row = db
    .prepare("SELECT * FROM pizza_order_rows WHERE id = ?")
    .get(result.lastInsertRowid) as Record<string, unknown>;
  return enrichRow(row, getPizzaItems());
}

export function updatePizzaRow(
  rowId: number,
  updates: Partial<{ personName: string; pizzaItemId: number | null; count: number }>
): PizzaOrderRow {
  const db = getDb();
  const fieldMap: Record<string, string> = {
    personName: "person_name",
    pizzaItemId: "pizza_item_id",
    count: "count",
  };
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length > 0) {
    const setClauses = entries.map(([k]) => `${fieldMap[k]} = ?`).join(", ");
    const values = entries.map(([, v]) => v);
    db.prepare(`UPDATE pizza_order_rows SET ${setClauses} WHERE id = ?`).run(
      ...values,
      rowId
    );
  }
  const row = db
    .prepare("SELECT * FROM pizza_order_rows WHERE id = ?")
    .get(rowId) as Record<string, unknown>;
  return enrichRow(row, getPizzaItems());
}

export function deletePizzaRow(rowId: number): void {
  getDb().prepare("DELETE FROM pizza_order_rows WHERE id = ?").run(rowId);
}

export interface PizzaOrderSummary {
  id: number;
  date: string;
  status: "draft" | "sent";
  sentAt: string | null;
  rowCount: number;
}

export function getPizzaOrderData(orderId: number): PizzaOrderData {
  const db = getDb();
  const orderRaw = db
    .prepare("SELECT * FROM pizza_orders WHERE id = ?")
    .get(orderId) as Record<string, unknown> | undefined;
  if (!orderRaw) throw new Error("Objednávka nebyla nalezena.");
  const order = mapOrder(orderRaw);
  const items = getPizzaItems();
  const rawRows = db
    .prepare("SELECT * FROM pizza_order_rows WHERE order_id = ? ORDER BY sort_order, id")
    .all(order.id) as Record<string, unknown>[];
  const rows = rawRows.map((r) => enrichRow(r, items));
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  return {
    order,
    rows,
    pizzaItems: items,
    totalCount,
    totals: computePizzaTotals(rows),
  };
}

export function getPizzaOrderList(): PizzaOrderSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.date, p.status, p.sent_at,
              COUNT(r.id) AS row_count
       FROM pizza_orders p
       LEFT JOIN pizza_order_rows r ON r.order_id = p.id
       GROUP BY p.id
       ORDER BY p.date DESC`
    )
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    date: r.date as string,
    status: r.status as "draft" | "sent",
    sentAt: (r.sent_at as string | null) ?? null,
    rowCount: r.row_count as number,
  }));
}
