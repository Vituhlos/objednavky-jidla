import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { buildOrderEmail } from "./order-email";
import { buildOrderPdfAttachment } from "./order-pdf";
import { computeRowPrice, type ExtrasPrices } from "./pricing";
import { getOrderRecipients, sendEmail } from "./email";
import { getSettings } from "./settings";
import {
  getMenuItemsByIds,
  getMenuItemsForDay,
  getTodayDayCode,
  getDayCodeForISO,
  getMondayISO,
  seedMenuIfEmpty,
  getWeekLabel,
} from "./menu";
import type { MenuItem } from "./types";

const DATA_DIR = path.dirname(process.env.DB_PATH ?? path.join(process.cwd(), "data", "stros.db"));

export function getOrderPdfPath(orderId: number): string {
  return path.join(DATA_DIR, "pdfs", `order-${orderId}.pdf`);
}

export function orderPdfExists(orderId: number): boolean {
  return fs.existsSync(getOrderPdfPath(orderId));
}

function savePdf(orderId: number, buffer: Buffer): void {
  const dir = path.join(DATA_DIR, "pdfs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getOrderPdfPath(orderId), buffer);
}
import { getPragueISODate } from "./time";
import type {
  Order,
  DepartmentData,
  OrderRow,
  OrderRowEnriched,
  OrderData,
  Department,
  MealEntry,
} from "./types";
import { getDepartments, getDepartmentsByNames } from "./departments";
import { logAudit } from "./audit";
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
  let extraMeals: MealEntry[] = [];
  try {
    const raw = row.extra_meals as string | null;
    if (raw && raw !== "[]") extraMeals = JSON.parse(raw) as MealEntry[];
  } catch (e) {
    console.error(`[orders] Chyba parsování extra_meals pro řádek ${row.id}:`, e);
  }
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    department: row.department as Department,
    sortOrder: row.sort_order as number,
    personName: (row.person_name as string) ?? "",
    soupItemId: (row.soup_item_id as number | null) ?? null,
    soupItemId2: (row.soup_item_id_2 as number | null) ?? null,
    mainItemId: (row.main_item_id as number | null) ?? null,
    mealCount: (row.meal_count as number) || 1,
    extraMeals,
    rollCount: (row.roll_count as number) ?? 0,
    breadDumplingCount: (row.bread_dumpling_count as number) ?? 0,
    potatoDumplingCount: (row.potato_dumpling_count as number) ?? 0,
    ketchupCount: (row.ketchup_count as number) ?? 0,
    tatarkaCount: (row.tatarka_count as number) ?? 0,
    bbqCount: (row.bbq_count as number) ?? 0,
    note: (row.note as string) ?? "",
  };
}

function readDefaultPrices(): { soupPrice: number; mealPrice: number; ep: ExtrasPrices } {
  const s = getSettings();
  return {
    soupPrice: parseInt(s.defaultSoupPrice) || 30,
    mealPrice: parseInt(s.defaultMealPrice) || 110,
    ep: {
      roll: parseInt(s.priceRoll) || 5,
      breadDumpling: parseInt(s.priceBreadDumpling) || 40,
      potatoDumpling: parseInt(s.pricePotatoDumpling) || 45,
      ketchup: parseInt(s.priceKetchup) || 20,
      tatarka: parseInt(s.priceTatarka) || 20,
      bbq: parseInt(s.priceBbq) || 20,
    },
  };
}

function collectItemIds(rows: OrderRow[]): number[] {
  const ids = new Set<number>();
  for (const r of rows) {
    if (r.soupItemId) ids.add(r.soupItemId);
    if (r.soupItemId2) ids.add(r.soupItemId2);
    if (r.mainItemId) ids.add(r.mainItemId);
    for (const e of r.extraMeals) ids.add(e.itemId);
  }
  return [...ids];
}

function enrichRow(row: OrderRow, lookup: Map<number, MenuItem>, soupPrice: number, mealPrice: number, ep: ExtrasPrices): OrderRowEnriched {
  const soup = row.soupItemId ? (lookup.get(row.soupItemId) ?? null) : null;
  const soup2 = row.soupItemId2 ? (lookup.get(row.soupItemId2) ?? null) : null;
  const main = row.mainItemId ? (lookup.get(row.mainItemId) ?? null) : null;
  const extraMealItems = row.extraMeals
    .map((e) => ({ item: lookup.get(e.itemId) ?? null, count: e.count }))
    .filter((e): e is { item: MenuItem; count: number } => e.item != null);
  return {
    ...row,
    soupItem: soup,
    soupItem2: soup2,
    mainItem: main,
    extraMealItems,
    rowPrice: computeRowPrice(row, soup, soup2, main, extraMealItems, soupPrice, mealPrice, ep),
  };
}

function enrichSingleRow(row: OrderRow, soupPrice: number, mealPrice: number, ep: ExtrasPrices): OrderRowEnriched {
  const lookup = getMenuItemsByIds(collectItemIds([row]));
  return enrichRow(row, lookup, soupPrice, mealPrice, ep);
}

function getOrCreateOrderForDate(date: string): Order {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO orders (date, status) VALUES (?, 'draft')").run(date);
  const order = db.prepare("SELECT * FROM orders WHERE date = ?").get(date) as Record<string, unknown>;
  return mapOrder(order);
}

function getOrCreateTodayOrder(): Order {
  const db = getDb();
  const today = getPragueISODate();
  db.prepare("INSERT OR IGNORE INTO orders (date, status) VALUES (?, 'draft')").run(today);
  const order = db
    .prepare("SELECT * FROM orders WHERE date = ?")
    .get(today) as Record<string, unknown>;
  return mapOrder(order);
}

export function getTodayOrderData(): OrderData {
  seedMenuIfEmpty(getWeekLabel());
  const order = getOrCreateTodayOrder();
  const db = getDb();
  const { soupPrice, mealPrice, ep } = readDefaultPrices();

  const dayCode = getTodayDayCode();
  const todayMenu = dayCode
    ? getMenuItemsForDay(dayCode)
    : { soups: [], meals: [] };

  const rawRows = db
    .prepare(
      "SELECT * FROM order_rows WHERE order_id = ? ORDER BY department, sort_order, id"
    )
    .all(order.id) as Record<string, unknown>[];

  const orderRows = rawRows.map(mapOrderRow);
  const lookup = getMenuItemsByIds(collectItemIds(orderRows));
  const rows = orderRows.map((r) => enrichRow(r, lookup, soupPrice, mealPrice, ep));

  const depts = getDepartments();
  const departments: DepartmentData[] = depts.map((dept) => {
    const deptRows = rows.filter((r) => r.department === dept.name);
    const subtotal = deptRows.filter((r) => r.personName || r.soupItemId || r.mainItemId).reduce((s, r) => s + r.rowPrice, 0);
    return { name: dept.name, label: dept.label, emailLabel: dept.emailLabel, accent: dept.accent, rows: deptRows, subtotal };
  });

  return {
    order,
    departments,
    todayMenu,
    totalPrice: departments.reduce((s, d) => s + d.subtotal, 0),
    dayCode,
  };
}

export function getOrderDataForDate(date: string): OrderData {
  seedMenuIfEmpty(getWeekLabel());
  const order = getOrCreateOrderForDate(date);
  const db = getDb();
  const { soupPrice, mealPrice, ep } = readDefaultPrices();

  const dayCode = getDayCodeForISO(date);
  const weekStart = getMondayISO(new Date(`${date}T12:00:00`));
  const todayMenu = dayCode
    ? getMenuItemsForDay(dayCode, weekStart)
    : { soups: [], meals: [] };

  const rawRows = db
    .prepare("SELECT * FROM order_rows WHERE order_id = ? ORDER BY department, sort_order, id")
    .all(order.id) as Record<string, unknown>[];
  const orderRows = rawRows.map(mapOrderRow);
  const lookup = getMenuItemsByIds(collectItemIds(orderRows));
  const rows = orderRows.map((r) => enrichRow(r, lookup, soupPrice, mealPrice, ep));

  const depts = getDepartments();
  const departments: DepartmentData[] = depts.map((dept) => {
    const deptRows = rows.filter((r) => r.department === dept.name);
    const subtotal = deptRows.filter((r) => r.personName || r.soupItemId || r.mainItemId).reduce((s, r) => s + r.rowPrice, 0);
    return { name: dept.name, label: dept.label, emailLabel: dept.emailLabel, accent: dept.accent, rows: deptRows, subtotal };
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
  const { soupPrice, mealPrice, ep } = readDefaultPrices();
  const orderRaw = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown> | undefined;

  if (!orderRaw) {
    throw new Error("Objednávka nebyla nalezena.");
  }

  const order = mapOrder(orderRaw);
  const dayCode = getDayCodeForISO(order.date);
  const weekStart = getMondayISO(new Date(`${order.date}T12:00:00`));
  const todayMenu = dayCode
    ? getMenuItemsForDay(dayCode, weekStart)
    : { soups: [], meals: [] };

  const rawRows = db
    .prepare(
      "SELECT * FROM order_rows WHERE order_id = ? ORDER BY department, sort_order, id"
    )
    .all(order.id) as Record<string, unknown>[];

  const orderRows = rawRows.map(mapOrderRow);
  const lookup = getMenuItemsByIds(collectItemIds(orderRows));
  const rows = orderRows.map((r) => enrichRow(r, lookup, soupPrice, mealPrice, ep));
  const activeDepts = getDepartments();
  const activeDeptNames = new Set(activeDepts.map((d) => d.name));

  // Include inactive departments that still have rows in this order
  const orphanNames = [...new Set(rows.map((r) => r.department))].filter((n) => !activeDeptNames.has(n));
  const orphanLookup = getDepartmentsByNames(orphanNames);
  const orphanDepts = orphanNames.map((name) =>
    orphanLookup.get(name) ?? { id: -1, name, label: name, emailLabel: name, accent: "blue" as const, sortOrder: 999, active: false }
  );

  const allDepts = [...activeDepts, ...orphanDepts];
  const departments: DepartmentData[] = allDepts.map((dept) => {
    const deptRows = rows.filter((r) => r.department === dept.name);
    const subtotal = deptRows.filter((r) => r.personName || r.soupItemId || r.mainItemId).reduce((s, r) => s + r.rowPrice, 0);
    return { name: dept.name, label: dept.label, emailLabel: dept.emailLabel, accent: dept.accent, rows: deptRows, subtotal };
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
  department: Department,
  pushEndpoint?: string,
): OrderRowEnriched {
  const db = getDb();
  const { m } = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM order_rows WHERE order_id = ? AND department = ?"
    )
    .get(orderId, department) as { m: number };

  const result = db
    .prepare(
      "INSERT INTO order_rows (order_id, department, sort_order, push_endpoint) VALUES (?, ?, ?, ?)"
    )
    .run(orderId, department, m + 1, pushEndpoint ?? null);

  const row = db
    .prepare("SELECT * FROM order_rows WHERE id = ?")
    .get(result.lastInsertRowid) as Record<string, unknown>;
  const { soupPrice, mealPrice, ep } = readDefaultPrices();
  const enriched = enrichSingleRow(mapOrderRow(row), soupPrice, mealPrice, ep);
  logAudit({ action: "row_add", orderId, department });
  return enriched;
}

export function updateOrderRow(
  rowId: number,
  updates: Partial<{
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
  }>,
  pushEndpoint?: string,
): OrderRowEnriched {
  const db = getDb();

  if (pushEndpoint) {
    db.prepare("UPDATE order_rows SET push_endpoint = ? WHERE id = ? AND push_endpoint IS NULL")
      .run(pushEndpoint, rowId);
  }

  const fieldMap: Record<string, string> = {
    personName: "person_name",
    soupItemId: "soup_item_id",
    soupItemId2: "soup_item_id_2",
    mainItemId: "main_item_id",
    mealCount: "meal_count",
    extraMeals: "extra_meals",
    rollCount: "roll_count",
    breadDumplingCount: "bread_dumpling_count",
    potatoDumplingCount: "potato_dumpling_count",
    ketchupCount: "ketchup_count",
    tatarkaCount: "tatarka_count",
    bbqCount: "bbq_count",
    note: "note",
  };

  const { soupPrice, mealPrice, ep } = readDefaultPrices();

  return db.transaction(() => {
    const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      const setClauses = entries.map(([k]) => `${fieldMap[k]} = ?`).join(", ");
      const values = entries.map(([k, v]) => k === "extraMeals" ? JSON.stringify(v) : v);
      db.prepare(`UPDATE order_rows SET ${setClauses} WHERE id = ?`).run(
        ...values,
        rowId
      );
    }

    const row = db
      .prepare("SELECT * FROM order_rows WHERE id = ?")
      .get(rowId) as Record<string, unknown> | undefined;
    if (!row) throw new Error(`Řádek objednávky ${rowId} nenalezen.`);
    const enriched = enrichSingleRow(mapOrderRow(row), soupPrice, mealPrice, ep);
    const significantFields = ["personName", "soupItemId", "soupItemId2", "mainItemId", "extraMeals"];
    if (Object.keys(updates).some((k) => significantFields.includes(k))) {
      logAudit({
        action: "row_update",
        orderId: enriched.orderId,
        department: enriched.department,
        personName: enriched.personName || null,
        details: Object.keys(updates).filter((k) => significantFields.includes(k)).join(","),
      });
    }
    return enriched;
  })();
}

export function deleteOrderRow(rowId: number): void {
  const db = getDb();
  const row = db.prepare("SELECT order_id, department, person_name FROM order_rows WHERE id = ?").get(rowId) as Record<string, unknown> | undefined;
  db.prepare("DELETE FROM order_rows WHERE id = ?").run(rowId);
  if (row) logAudit({ action: "row_delete", orderId: row.order_id as number, department: row.department as string, personName: row.person_name as string });
}

export async function sendOrder(orderId: number, source: "manual" | "auto" = "manual"): Promise<Order> {
  const db = getDb();
  const current = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown> | undefined;

  if (!current) {
    throw new Error("Objednávka nebyla nalezena.");
  }

  const currentOrder = mapOrder(current);
  const configuredExtraEmail = getSettings().orderExtraEmail.trim();
  const normalizedExtraEmail = configuredExtraEmail || currentOrder.extraEmail || null;

  const orderData = getOrderData(orderId);
  const activeDepartments = orderData.departments.filter(isDepartmentSubmitted);
  if (activeDepartments.length === 0) {
    throw new Error("Nebyla nalezena žádná objednávka. V tabulkách nejsou vyplněna žádná data pro export.");
  }
  const recipients = getOrderRecipients(normalizedExtraEmail);
  const email = buildOrderEmail({
    ...orderData,
    order: { ...orderData.order, extraEmail: normalizedExtraEmail },
  });
  const attachments = [await buildOrderPdfAttachment(orderData)];

  // Atomic claim: only one concurrent caller wins — the one whose UPDATE touches a row.
  // WHERE status = 'draft' ensures a second caller (or retry) gets changes = 0 and throws.
  const sentAt = new Date().toISOString();
  const claim = db
    .prepare(
      "UPDATE orders SET status = 'sent', sent_at = ?, extra_email = ? WHERE id = ? AND status = 'draft'"
    )
    .run(sentAt, normalizedExtraEmail, orderId);

  if (claim.changes === 0) {
    throw new Error("Objednávka již byla odeslána.");
  }

  try {
    await sendEmail({
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments,
    });
    savePdf(orderId, attachments[0].content);
  } catch (err) {
    // Revert the claim so the user can retry after fixing SMTP
    db.prepare("UPDATE orders SET status = 'draft', sent_at = NULL WHERE id = ?").run(orderId);
    throw err;
  }

  const order = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown>;
  logAudit({ action: source === "auto" ? "auto_send" : "order_send", orderId });
  return mapOrder(order);
}

export interface OrderSummary {
  id: number;
  date: string;
  status: "draft" | "sent";
  sentAt: string | null;
  extraEmail: string | null;
  rowCount: number;
}

export interface OrderSummaryWithDepts extends OrderSummary {
  depts: string[];          // names of departments with at least 1 non-empty row
  peopleCount: number;      // distinct people with at least personName
  totalPrice: number;       // sum of row prices (computed cheap)
}

export interface HistoryStats {
  monthlyOrderCount: number;
  monthlyOrderCountPrev: number;
  monthlyPeopleCount: number;
  monthlySum: number;
  monthlyAvgPeoplePerDay: number;
}

export interface CalendarDay {
  date: string;        // ISO YYYY-MM-DD
  peopleCount: number;
  totalPrice: number;
}

export function reopenOrder(orderId: number): void {
  getDb()
    .prepare("UPDATE orders SET status = 'draft', sent_at = NULL WHERE id = ?")
    .run(orderId);
  logAudit({ action: "order_reopen", orderId });
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

// Enriched summary — includes which depts have rows, how many people, and total price.
// Price is computed in SQL using default pricing from settings (not 100% accurate for
// custom-priced items, but good enough for history listing.)
export function getOrderListWithDepts(): OrderSummaryWithDepts[] {
  const db = getDb();
  const settings = getSettings();
  const defSoup = parseInt(settings.defaultSoupPrice) || 30;
  const defMeal = parseInt(settings.defaultMealPrice) || 110;

  const rows = db
    .prepare(
      `SELECT
         o.id, o.date, o.status, o.sent_at, o.extra_email,
         COUNT(r.id) AS row_count,
         SUM(CASE WHEN trim(r.person_name) != '' THEN 1 ELSE 0 END) AS people_count,
         GROUP_CONCAT(DISTINCT r.department) AS depts_csv,
         /* approximate total price */
         SUM(
           CASE WHEN r.soup_item_id IS NOT NULL THEN COALESCE((SELECT price FROM menu_items WHERE id = r.soup_item_id), 0) ELSE 0 END +
           CASE WHEN r.soup_item_id_2 IS NOT NULL THEN COALESCE((SELECT price FROM menu_items WHERE id = r.soup_item_id_2), 0) ELSE 0 END +
           CASE WHEN r.main_item_id IS NOT NULL THEN (r.meal_count * COALESCE((SELECT price FROM menu_items WHERE id = r.main_item_id), 0)) ELSE 0 END +
           r.roll_count * ${parseInt(settings.priceRoll) || 5} +
           r.bread_dumpling_count * ${parseInt(settings.priceBreadDumpling) || 40} +
           r.potato_dumpling_count * ${parseInt(settings.pricePotatoDumpling) || 45} +
           r.ketchup_count * ${parseInt(settings.priceKetchup) || 20} +
           r.tatarka_count * ${parseInt(settings.priceTatarka) || 20} +
           r.bbq_count * ${parseInt(settings.priceBbq) || 20}
         ) AS total_price
       FROM orders o
       LEFT JOIN order_rows r ON r.order_id = o.id
       GROUP BY o.id
       ORDER BY o.date DESC`
    )
    .all() as Record<string, unknown>[];

  return rows.map((r) => {
    const deptsCsv = (r.depts_csv as string | null) ?? "";
    const depts = deptsCsv ? deptsCsv.split(",").filter(Boolean) : [];
    return {
      id: r.id as number,
      date: r.date as string,
      status: r.status as "draft" | "sent",
      sentAt: (r.sent_at as string | null) ?? null,
      extraEmail: (r.extra_email as string | null) ?? null,
      rowCount: (r.row_count as number) ?? 0,
      depts,
      peopleCount: (r.people_count as number) ?? 0,
      totalPrice: Math.round((r.total_price as number) ?? 0),
    };
  });
}

// History KPI stats — current vs previous calendar month, only sent orders.
export function getHistoryStats(): HistoryStats {
  const db = getDb();
  const today = getPragueISODate();
  const [yStr, mStr] = today.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const ymPrev = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  const settings = getSettings();
  const priceFormula = `
    CASE WHEN r.soup_item_id IS NOT NULL THEN COALESCE((SELECT price FROM menu_items WHERE id = r.soup_item_id), 0) ELSE 0 END +
    CASE WHEN r.soup_item_id_2 IS NOT NULL THEN COALESCE((SELECT price FROM menu_items WHERE id = r.soup_item_id_2), 0) ELSE 0 END +
    CASE WHEN r.main_item_id IS NOT NULL THEN (r.meal_count * COALESCE((SELECT price FROM menu_items WHERE id = r.main_item_id), 0)) ELSE 0 END +
    r.roll_count * ${parseInt(settings.priceRoll) || 5} +
    r.bread_dumpling_count * ${parseInt(settings.priceBreadDumpling) || 40} +
    r.potato_dumpling_count * ${parseInt(settings.pricePotatoDumpling) || 45} +
    r.ketchup_count * ${parseInt(settings.priceKetchup) || 20} +
    r.tatarka_count * ${parseInt(settings.priceTatarka) || 20} +
    r.bbq_count * ${parseInt(settings.priceBbq) || 20}
  `;

  const monthlyRow = db
    .prepare(
      `SELECT
         COUNT(DISTINCT o.id) AS order_count,
         SUM(CASE WHEN trim(r.person_name) != '' THEN 1 ELSE 0 END) AS people_count,
         SUM(${priceFormula}) AS total_sum
       FROM orders o
       LEFT JOIN order_rows r ON r.order_id = o.id
       WHERE strftime('%Y-%m', o.date) = ? AND o.status = 'sent'`
    )
    .get(ym) as { order_count: number; people_count: number; total_sum: number };

  const prevRow = db
    .prepare(
      `SELECT COUNT(DISTINCT o.id) AS order_count
       FROM orders o
       WHERE strftime('%Y-%m', o.date) = ? AND o.status = 'sent'`
    )
    .get(ymPrev) as { order_count: number };

  const orderCount = monthlyRow.order_count || 0;
  const peopleCount = monthlyRow.people_count || 0;
  const totalSum = Math.round(monthlyRow.total_sum || 0);
  const avgPeoplePerDay = orderCount > 0 ? Math.round((peopleCount / orderCount) * 10) / 10 : 0;

  return {
    monthlyOrderCount: orderCount,
    monthlyOrderCountPrev: prevRow.order_count || 0,
    monthlyPeopleCount: peopleCount,
    monthlySum: totalSum,
    monthlyAvgPeoplePerDay: avgPeoplePerDay,
  };
}

// Heatmap data for a given month — every day with at least 1 sent order.
export function getCalendarHeatmap(year: number, month: number): CalendarDay[] {
  const db = getDb();
  const settings = getSettings();
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const priceFormula = `
    CASE WHEN r.soup_item_id IS NOT NULL THEN COALESCE((SELECT price FROM menu_items WHERE id = r.soup_item_id), 0) ELSE 0 END +
    CASE WHEN r.soup_item_id_2 IS NOT NULL THEN COALESCE((SELECT price FROM menu_items WHERE id = r.soup_item_id_2), 0) ELSE 0 END +
    CASE WHEN r.main_item_id IS NOT NULL THEN (r.meal_count * COALESCE((SELECT price FROM menu_items WHERE id = r.main_item_id), 0)) ELSE 0 END +
    r.roll_count * ${parseInt(settings.priceRoll) || 5} +
    r.bread_dumpling_count * ${parseInt(settings.priceBreadDumpling) || 40} +
    r.potato_dumpling_count * ${parseInt(settings.pricePotatoDumpling) || 45} +
    r.ketchup_count * ${parseInt(settings.priceKetchup) || 20} +
    r.tatarka_count * ${parseInt(settings.priceTatarka) || 20} +
    r.bbq_count * ${parseInt(settings.priceBbq) || 20}
  `;
  const rows = db
    .prepare(
      `SELECT
         o.date,
         SUM(CASE WHEN trim(r.person_name) != '' THEN 1 ELSE 0 END) AS people_count,
         SUM(${priceFormula}) AS total_price
       FROM orders o
       LEFT JOIN order_rows r ON r.order_id = o.id
       WHERE strftime('%Y-%m', o.date) = ? AND o.status = 'sent'
       GROUP BY o.date
       ORDER BY o.date`
    )
    .all(ym) as Array<{ date: string; people_count: number; total_price: number }>;
  return rows.map((r) => ({
    date: r.date,
    peopleCount: r.people_count || 0,
    totalPrice: Math.round(r.total_price || 0),
  }));
}

export async function resendOrderEmail(orderId: number): Promise<void> {
  const db = getDb();
  const current = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown> | undefined;
  if (!current) throw new Error("Objednávka nebyla nalezena.");
  const currentOrder = mapOrder(current);
  const configuredExtraEmail = getSettings().orderExtraEmail.trim();
  const normalizedExtraEmail = configuredExtraEmail || currentOrder.extraEmail || null;
  const orderData = getOrderData(orderId);
  const activeDepartments = orderData.departments.filter(isDepartmentSubmitted);
  if (activeDepartments.length === 0) throw new Error("Objednávka neobsahuje žádná data k odeslání.");
  const recipients = getOrderRecipients(normalizedExtraEmail);
  const email = buildOrderEmail({ ...orderData, order: { ...orderData.order, extraEmail: normalizedExtraEmail } });
  const attachments = [await buildOrderPdfAttachment(orderData)];
  await sendEmail({ to: recipients, subject: email.subject, html: email.html, text: email.text, attachments });
  logAudit({ action: "order_send", orderId, details: "Znovu odesláno" });
}

export function clearOrderRows(orderId: number): void {
  getDb().prepare("DELETE FROM order_rows WHERE order_id = ?").run(orderId);
  logAudit({ action: "order_clear", orderId });
}

export function duplicateOrderRows(sourceOrderId: number): { newOrderId: number; copiedRowCount: number } {
  const db = getDb();
  const todayOrder = getOrCreateTodayOrder();
  if (todayOrder.status === "sent") {
    throw new Error("Dnešní objednávka je již odeslána — duplikaci nelze provést.");
  }
  const sourceRows = db
    .prepare("SELECT person_name, department FROM order_rows WHERE order_id = ? ORDER BY department, sort_order")
    .all(sourceOrderId) as Array<{ person_name: string; department: string }>;

  let copied = 0;
  const insertStmt = db.prepare(
    "INSERT INTO order_rows (order_id, department, sort_order, person_name) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM order_rows WHERE order_id = ? AND department = ?), ?)"
  );
  for (const row of sourceRows) {
    const name = (row.person_name ?? "").trim();
    if (!name) continue;
    // Skip if a row with the same person already exists today in the same dept
    const exists = db
      .prepare(
        "SELECT 1 FROM order_rows WHERE order_id = ? AND department = ? AND lower(trim(person_name)) = lower(trim(?))"
      )
      .get(todayOrder.id, row.department, name);
    if (exists) continue;
    insertStmt.run(todayOrder.id, row.department, todayOrder.id, row.department, name);
    copied++;
  }
  logAudit({ action: "order_duplicate", orderId: todayOrder.id, details: `from #${sourceOrderId}, ${copied} rows` });
  return { newOrderId: todayOrder.id, copiedRowCount: copied };
}

export interface DeptSuggestion {
  personName: string;
  lastOrderedAt: string;
}

export function getDeptSuggestions(department: Department, limit = 4): DeptSuggestion[] {
  const db = getDb();
  const today = getPragueISODate();
  const rows = db.prepare(`
    SELECT
      MIN(r.person_name) AS personName,
      MAX(o.date) AS lastOrderedAt,
      COUNT(*) AS cnt
    FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE r.department = ?
      AND TRIM(r.person_name) != ''
      AND o.date >= date(?, '-30 days')
      AND o.date < ?
      AND NOT EXISTS (
        SELECT 1 FROM order_rows r2
        JOIN orders o2 ON o2.id = r2.order_id
        WHERE o2.date = ?
          AND r2.department = r.department
          AND lower(trim(r2.person_name)) = lower(trim(r.person_name))
      )
    GROUP BY lower(trim(r.person_name))
    ORDER BY cnt DESC, lastOrderedAt DESC
    LIMIT ?
  `).all(department, today, today, today, limit) as Array<{ personName: string; lastOrderedAt: string }>;
  return rows.map((r) => ({ personName: r.personName, lastOrderedAt: r.lastOrderedAt }));
}
