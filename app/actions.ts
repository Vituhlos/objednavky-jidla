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

