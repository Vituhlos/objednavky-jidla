"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { setMenuForWeek, addMenuItem, updateMenuItem, deleteMenuItem, deleteMenuForWeek, getMondayISO, getNextMondayISO, closeDay, openDay } from "@/lib/menu";
import type { ParsedMenuItem } from "@/lib/parse-menu";
import path from "path";
import fs from "fs";
import type { MenuItem } from "@/lib/types";
import {
  addOrderRow,
  updateOrderRow,
  deleteOrderRow,
  sendOrder as dbSendOrder,
  reopenOrder,
  clearOrderRows,
  resendOrderEmail,
} from "@/lib/orders";
import type { Department, OrderRowEnriched, MealEntry } from "@/lib/types";
import {
  addPizzaRow,
  updatePizzaRow,
  deletePizzaRow,
  replacePizzaItems,
} from "@/lib/pizza";
import type { PizzaOrderRow } from "@/lib/pizza";
import { saveSettings, checkPin } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { broadcast } from "@/lib/sse-broadcast";
import {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  reorderDepartments,
} from "@/lib/departments";
import type { DepartmentInfo } from "@/lib/departments";

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Musíte být přihlášeni.");
  return user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Tato akce vyžaduje oprávnění správce.");
  return user;
}

export async function actionAddRow(
  orderId: number,
  department: Department
): Promise<OrderRowEnriched> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Pro přidání objednávky se musíte přihlásit.");
  const row = addOrderRow(orderId, department, user.id, `${user.firstName} ${user.lastName}`);
  revalidatePath("/");
  broadcast();
  return row;
}

export async function actionUpdateRow(
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
  }>
): Promise<OrderRowEnriched> {
  const user = await requireAuth();
  const row = updateOrderRow(rowId, updates, user.id, user.role === "admin");
  broadcast();
  return row;
}

export async function actionDeleteRow(rowId: number): Promise<void> {
  const user = await requireAuth();
  deleteOrderRow(rowId, user.id, user.role === "admin");
  revalidatePath("/");
  broadcast();
}

export async function actionSendOrder(orderId: number): Promise<void> {
  await requireAdmin();
  await dbSendOrder(orderId);
  revalidatePath("/");
  broadcast();
}

export async function actionConfirmMenuImport(
  weekStart: string,
  weekLabel: string,
  items: ParsedMenuItem[],
  tmpPdfName?: string
): Promise<void> {
  await requireAdmin();
  setMenuForWeek(weekStart, weekLabel, items);
  if (tmpPdfName) {
    const pdfsDir = path.join(process.cwd(), "data", "pdfs");
    const tmpPath = path.join(pdfsDir, tmpPdfName);
    const destPath = path.join(pdfsDir, `${weekStart}.pdf`);
    try { fs.renameSync(tmpPath, destPath); } catch {}
  }
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionDeleteMenuWeek(weekStart: string): Promise<void> {
  await requireAdmin();
  deleteMenuForWeek(weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionGetWeekStarts(): Promise<{ current: string; next: string }> {
  return { current: getMondayISO(), next: getNextMondayISO() };
}

export async function actionAddMenuItem(item: {
  day: string;
  type: "Polévka" | "Jídlo";
  code: string;
  name: string;
  price: number;
  weekStart?: string;
}): Promise<MenuItem> {
  await requireAdmin();
  return addMenuItem(item);
}

export async function actionUpdateMenuItem(
  id: number,
  updates: Partial<{ code: string; name: string; price: number }>
): Promise<MenuItem> {
  await requireAdmin();
  return updateMenuItem(id, updates);
}

export async function actionDeleteMenuItem(id: number): Promise<void> {
  await requireAdmin();
  deleteMenuItem(id);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionAddPizzaRow(orderId: number): Promise<PizzaOrderRow> {
  await requireAuth();
  const row = addPizzaRow(orderId);
  revalidatePath("/pizza");
  broadcast();
  return row;
}

export async function actionUpdatePizzaRow(
  rowId: number,
  updates: Partial<{ personName: string; pizzaItemId: number | null; count: number }>
): Promise<PizzaOrderRow> {
  await requireAuth();
  const row = updatePizzaRow(rowId, updates);
  revalidatePath("/pizza");
  broadcast();
  return row;
}

export async function actionDeletePizzaRow(rowId: number): Promise<void> {
  await requireAuth();
  deletePizzaRow(rowId);
  revalidatePath("/pizza");
  broadcast();
}

export async function actionUpdatePizzaPrices(
  items: Array<{ code: number; name: string; price: number }>
): Promise<void> {
  await requireAdmin();
  replacePizzaItems(items);
  revalidatePath("/pizza");
}

export async function actionReopenOrder(orderId: number): Promise<void> {
  await requireAdmin();
  reopenOrder(orderId);
  revalidatePath("/");
  revalidatePath("/historie");
  revalidatePath(`/historie/${orderId}`);
  broadcast();
}

export async function actionResendOrder(orderId: number): Promise<void> {
  await requireAdmin();
  await resendOrderEmail(orderId);
}

export async function actionCloseDay(dayCode: string, weekStart: string): Promise<void> {
  await requireAdmin();
  closeDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionOpenDay(dayCode: string, weekStart: string): Promise<void> {
  await requireAdmin();
  openDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionClearOrder(orderId: number): Promise<void> {
  await requireAdmin();
  clearOrderRows(orderId);
  revalidatePath("/");
  broadcast();
}

export async function actionGetDepartments(): Promise<DepartmentInfo[]> {
  return getDepartments();
}

export async function actionAddDepartment(data: {
  name: string; label: string; emailLabel: string; accent: string;
}): Promise<DepartmentInfo> {
  await requireAdmin();
  const dept = addDepartment(data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionUpdateDepartment(
  id: number,
  data: Partial<{ label: string; emailLabel: string; accent: string }>
): Promise<DepartmentInfo> {
  await requireAdmin();
  const dept = updateDepartment(id, data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionDeleteDepartment(id: number): Promise<void> {
  await requireAdmin();
  deleteDepartment(id);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

export async function actionReorderDepartments(orderedIds: number[]): Promise<void> {
  await requireAdmin();
  reorderDepartments(orderedIds);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

export async function actionCheckPin(pin: string): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRateLimit(`pin:${ip}`, 5, 10 * 60 * 1000)) return false;
  return checkPin(pin);
}

export async function actionSaveSettings(updates: Partial<AppSettings>): Promise<void> {
  await requireAdmin();
  saveSettings(updates);
  revalidatePath("/nastaveni");
}

export async function actionGetUsers(): Promise<Array<{ id: number; email: string; firstName: string; lastName: string; role: string; active: number; createdAt: string }>> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new Error("Nemáte oprávnění.");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const rows = db.prepare("SELECT id, email, first_name, last_name, role, active, created_at FROM users ORDER BY created_at").all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    email: r.email as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    role: r.role as string,
    active: r.active as number,
    createdAt: r.created_at as string,
  }));
}

export async function actionSetUserRole(userId: number, role: "user" | "admin"): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new Error("Nemáte oprávnění.");
  const { getDb } = await import("@/lib/db");
  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  revalidatePath("/nastaveni");
}

export async function actionSetUserActive(userId: number, active: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new Error("Nemáte oprávnění.");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, userId);
  if (!active) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
  revalidatePath("/nastaveni");
}

export async function actionUpdateProfile(data: {
  firstName: string;
  lastName: string;
  defaultDepartment: string | null;
  emailOrderConfirmation: boolean;
}): Promise<void> {
  const user = await requireAuth();
  const { firstName, lastName, defaultDepartment, emailOrderConfirmation } = data;
  if (!firstName.trim() || !lastName.trim()) throw new Error("Jméno a příjmení jsou povinné.");
  const { getDb } = await import("@/lib/db");
  getDb()
    .prepare("UPDATE users SET first_name = ?, last_name = ?, default_department = ?, email_order_confirmation = ? WHERE id = ?")
    .run(firstName.trim(), lastName.trim(), defaultDepartment || null, emailOrderConfirmation ? 1 : 0, user.id);
  revalidatePath("/profil");
  revalidatePath("/");
}

export async function actionChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  const user = await requireAuth();
  if (newPassword.length < 6) throw new Error("Nové heslo musí mít alespoň 6 znaků.");
  const { getDb } = await import("@/lib/db");
  const { verifyPassword, hashPassword } = await import("@/lib/auth");
  const row = getDb()
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(oldPassword, row.password_hash)) {
    throw new Error("Stávající heslo je nesprávné.");
  }
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), user.id);
}

export async function actionGetMyHistory(): Promise<Array<{
  date: string;
  department: string;
  soupName: string | null;
  mainName: string | null;
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
  mealCount: number;
  type: "lunch" | "pizza";
  pizzaName: string | null;
  pizzaCount: number;
}>> {
  const user = await requireAuth();
  const { getDb } = await import("@/lib/db");
  const db = getDb();

  const lunchRows = db.prepare(`
    SELECT o.date, r.department,
      mi1.name AS soup_name, mi2.name AS main_name,
      r.roll_count, r.bread_dumpling_count, r.potato_dumpling_count,
      COALESCE(r.meal_count, 1) AS meal_count
    FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    LEFT JOIN menu_items mi1 ON mi1.id = r.soup_item_id
    LEFT JOIN menu_items mi2 ON mi2.id = r.main_item_id
    WHERE r.user_id = ?
      AND (r.soup_item_id IS NOT NULL OR r.main_item_id IS NOT NULL OR r.roll_count > 0)
    ORDER BY o.date DESC
    LIMIT 50
  `).all(user.id) as Record<string, unknown>[];

  const pizzaRows = db.prepare(`
    SELECT po.date, pi.name AS pizza_name, COALESCE(pr.count, 1) AS pizza_count
    FROM pizza_order_rows pr
    JOIN pizza_orders po ON po.id = pr.order_id
    LEFT JOIN pizza_items pi ON pi.id = pr.pizza_item_id
    WHERE pr.user_id = ? AND pr.pizza_item_id IS NOT NULL
    ORDER BY po.date DESC
    LIMIT 50
  `).all(user.id) as Record<string, unknown>[];

  const lunch = lunchRows.map((r) => ({
    date: r.date as string,
    department: r.department as string,
    soupName: r.soup_name as string | null,
    mainName: r.main_name as string | null,
    rollCount: r.roll_count as number,
    breadDumplingCount: r.bread_dumpling_count as number,
    potatoDumplingCount: r.potato_dumpling_count as number,
    mealCount: r.meal_count as number,
    type: "lunch" as const,
    pizzaName: null,
    pizzaCount: 0,
  }));

  const pizza = pizzaRows.map((r) => ({
    date: r.date as string,
    department: "Pizza",
    soupName: null,
    mainName: null,
    rollCount: 0,
    breadDumplingCount: 0,
    potatoDumplingCount: 0,
    mealCount: 0,
    type: "pizza" as const,
    pizzaName: r.pizza_name as string | null,
    pizzaCount: r.pizza_count as number,
  }));

  return [...lunch, ...pizza].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
}

export async function actionAdminSendPasswordReset(userId: number): Promise<void> {
  await requireAdmin();
  const { getDb } = await import("@/lib/db");
  const { createPasswordResetToken } = await import("@/lib/auth");
  const { sendPasswordResetEmail } = await import("@/lib/email");
  const user = getDb()
    .prepare("SELECT id, email, first_name FROM users WHERE id = ? AND active = 1")
    .get(userId) as { id: number; email: string; first_name: string } | undefined;
  if (!user) throw new Error("Uživatel nenalezen.");
  const token = createPasswordResetToken(user.id);
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const resetUrl = `${proto}://${host}/reset-hesla?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl, user.first_name);
}

