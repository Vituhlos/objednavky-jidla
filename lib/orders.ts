import { getDb } from "./db";
import { buildOrderEmail } from "./order-email";
import { buildDepartmentPdfAttachment } from "./order-pdf";
import { computeRowPrice, type ExtrasPrices } from "./pricing";
import { getOrderRecipients, sendEmail, sendOrderConfirmationEmail } from "./email";
import { getSettings } from "./settings";
import {
  getMenuItemById,
  getMenuItemsByIds,
  getMenuItemsForDay,
  getTodayDayCode,
  getDayCodeForISO,
  getMondayISO,
  seedMenuIfEmpty,
  getWeekLabel,
} from "./menu";
import { getPragueISODate } from "./time";
import type {
  Order,
  DepartmentData,
  MenuItem,
  OrderRow,
  OrderRowEnriched,
  OrderData,
  Department,
  MealEntry,
} from "./types";
import { getDepartments, getDepartmentByName } from "./departments";
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
    userId: (row.user_id as number | null) ?? null,
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

function enrichRow(row: OrderRow, lookup: Map<number, MenuItem>, soupPrice: number, mealPrice: number, ep: ExtrasPrices): OrderRowEnriched {
  const soup = row.soupItemId ? (lookup.get(row.soupItemId) ?? null) : null;
  const soup2 = row.soupItemId2 ? (lookup.get(row.soupItemId2) ?? null) : null;
  const main = row.mainItemId ? (lookup.get(row.mainItemId) ?? null) : null;
  const extraMealItems = row.extraMeals
    .map((e) => ({ item: lookup.get(e.itemId) ?? null, count: e.count }))
    .filter((e): e is { item: NonNullable<typeof e.item>; count: number } => e.item != null);
  return {
    ...row,
    soupItem: soup,
    soupItem2: soup2,
    mainItem: main,
    extraMealItems,
    rowPrice: computeRowPrice(row, soup, soup2, main, extraMealItems, soupPrice, mealPrice, ep),
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

function enrichSingleRow(row: OrderRow, soupPrice: number, mealPrice: number, ep: ExtrasPrices): OrderRowEnriched {
  const lookup = getMenuItemsByIds(collectItemIds([row]));
  return enrichRow(row, lookup, soupPrice, mealPrice, ep);
}

function getOrCreateOrderForDate(date: string): Order {
  const db = getDb();
  let order = db.prepare("SELECT * FROM orders WHERE date = ?").get(date) as Record<string, unknown> | undefined;
  if (!order) {
    const result = db.prepare("INSERT INTO orders (date, status) VALUES (?, 'draft')").run(date);
    order = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
  }
  return mapOrder(order);
}

function getOrCreateTodayOrder(): Order {
  const db = getDb();
  const today = getPragueISODate();
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

  const mappedRows = rawRows.map(mapOrderRow);
  const lookup = getMenuItemsByIds(collectItemIds(mappedRows));
  const rows = mappedRows.map((r) => enrichRow(r, lookup, soupPrice, mealPrice, ep));

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
  const mappedRows2 = rawRows.map(mapOrderRow);
  const lookup2 = getMenuItemsByIds(collectItemIds(mappedRows2));
  const rows = mappedRows2.map((r) => enrichRow(r, lookup2, soupPrice, mealPrice, ep));

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
  const dayCode = getTodayDayCode();
  const todayMenu = dayCode
    ? getMenuItemsForDay(dayCode)
    : { soups: [], meals: [] };

  const rawRows = db
    .prepare(
      "SELECT * FROM order_rows WHERE order_id = ? ORDER BY department, sort_order, id"
    )
    .all(order.id) as Record<string, unknown>[];

  const mappedRows3 = rawRows.map(mapOrderRow);
  const lookup3 = getMenuItemsByIds(collectItemIds(mappedRows3));
  const rows = mappedRows3.map((r) => enrichRow(r, lookup3, soupPrice, mealPrice, ep));
  const activeDepts = getDepartments();
  const activeDeptNames = new Set(activeDepts.map((d) => d.name));

  // Include inactive departments that still have rows in this order
  const orphanNames = [...new Set(rows.map((r) => r.department))].filter((n) => !activeDeptNames.has(n));
  const orphanDepts = orphanNames.map((name) => {
    const info = getDepartmentByName(name);
    return info ?? { id: -1, name, label: name, emailLabel: name, accent: "blue" as const, sortOrder: 999, active: false };
  });

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
  userId?: number,
  personName?: string
): OrderRowEnriched {
  const db = getDb();
  const { m } = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM order_rows WHERE order_id = ? AND department = ?"
    )
    .get(orderId, department) as { m: number };

  const result = db
    .prepare(
      "INSERT INTO order_rows (order_id, department, sort_order, user_id, person_name) VALUES (?, ?, ?, ?, ?)"
    )
    .run(orderId, department, m + 1, userId ?? null, personName ?? "");

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
  currentUserId?: number,
  isAdmin?: boolean
): OrderRowEnriched {
  const db = getDb();

  const existing = db.prepare("SELECT user_id FROM order_rows WHERE id = ?").get(rowId) as { user_id: number | null } | undefined;
  if (existing && existing.user_id !== null && !isAdmin && existing.user_id !== currentUserId) {
    throw new Error("Nemáte oprávnění upravit tento řádek.");
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

export function deleteOrderRow(rowId: number, currentUserId?: number, isAdmin?: boolean): void {
  const db = getDb();
  const row = db.prepare("SELECT order_id, department, person_name, user_id FROM order_rows WHERE id = ?").get(rowId) as Record<string, unknown> | undefined;
  if (row && row.user_id !== null && !isAdmin && (row.user_id as number) !== currentUserId) {
    throw new Error("Nemáte oprávnění smazat tento řádek.");
  }
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
  const attachments = await Promise.all(
    activeDepartments.map((department) =>
      buildDepartmentPdfAttachment(department, orderData.order.date)
    )
  );

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
  } catch (err) {
    // Revert the claim so the user can retry after fixing SMTP
    db.prepare("UPDATE orders SET status = 'draft', sent_at = NULL WHERE id = ?").run(orderId);
    throw err;
  }

  const order = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown>;
  logAudit({ action: source === "auto" ? "auto_send" : "order_send", orderId });

  // Send individual confirmation emails to users who opted in
  try {
    type ConfirmRow = {
      email: string; first_name: string;
      soup_name: string | null; main_name: string | null;
      roll_count: number; bread_dumpling_count: number; potato_dumpling_count: number;
      meal_count: number; department: string;
    };
    const confirmRows = db.prepare(`
      SELECT u.email, u.first_name,
        mi1.name AS soup_name, mi2.name AS main_name,
        r.roll_count, r.bread_dumpling_count, r.potato_dumpling_count,
        COALESCE(r.meal_count, 1) AS meal_count, r.department
      FROM order_rows r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN menu_items mi1 ON mi1.id = r.soup_item_id
      LEFT JOIN menu_items mi2 ON mi2.id = r.main_item_id
      WHERE r.order_id = ? AND u.email_order_confirmation = 1
        AND (r.soup_item_id IS NOT NULL OR r.main_item_id IS NOT NULL OR r.roll_count > 0)
    `).all(orderId) as ConfirmRow[];

    // Group by user email
    const byUser = new Map<string, { firstName: string; items: Array<{ department: string; description: string }> }>();
    for (const row of confirmRows) {
      if (!byUser.has(row.email)) byUser.set(row.email, { firstName: row.first_name, items: [] });
      const parts: string[] = [];
      if (row.soup_name) parts.push(`Polévka: ${row.soup_name}`);
      if (row.main_name) parts.push(`${row.meal_count > 1 ? `${row.meal_count}× ` : ""}${row.main_name}`);
      if (row.roll_count > 0) parts.push(`${row.roll_count}× rohlík`);
      if (row.bread_dumpling_count > 0) parts.push(`${row.bread_dumpling_count}× houska kned.`);
      if (row.potato_dumpling_count > 0) parts.push(`${row.potato_dumpling_count}× bram. kned.`);
      byUser.get(row.email)!.items.push({ department: row.department, description: parts.join(", ") });
    }
    const dateStr = (order as Record<string, unknown>).date as string;
    await Promise.allSettled(
      Array.from(byUser.entries()).map(([email, { firstName, items }]) =>
        sendOrderConfirmationEmail(email, firstName, dateStr, items)
      )
    );
  } catch { /* confirmation emails are best-effort */ }

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
  const attachments = await Promise.all(
    activeDepartments.map((dept) => buildDepartmentPdfAttachment(dept, orderData.order.date))
  );
  await sendEmail({ to: recipients, subject: email.subject, html: email.html, text: email.text, attachments });
  logAudit({ action: "order_send", orderId, details: "Znovu odesláno" });
}

export function clearOrderRows(orderId: number): void {
  getDb().prepare("DELETE FROM order_rows WHERE order_id = ?").run(orderId);
  logAudit({ action: "order_clear", orderId });
}
