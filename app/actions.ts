"use server";

import { revalidatePath } from "next/cache";
import { setMenuForWeek, addMenuItem, updateMenuItem, deleteMenuItem, deleteMenuForWeek, getMondayISO, getNextMondayISO } from "@/lib/menu";
import type { ParsedMenuItem } from "@/lib/parse-menu";
import path from "path";
import fs from "fs";
import type { MenuItem } from "@/lib/types";
import {
  addOrderRow,
  updateOrderRow,
  deleteOrderRow,
  sendOrder as dbSendOrder,
  updateExtraEmail,
  reopenOrder,
} from "@/lib/orders";
import type { Department, OrderRowEnriched } from "@/lib/types";
import {
  addPizzaRow,
  updatePizzaRow,
  deletePizzaRow,
  replacePizzaItems,
} from "@/lib/pizza";
import type { PizzaOrderRow } from "@/lib/pizza";
import { saveSettings, checkPin } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";

export async function actionAddRow(
  orderId: number,
  department: Department
): Promise<OrderRowEnriched> {
  const row = addOrderRow(orderId, department);
  revalidatePath("/");
  return row;
}

export async function actionUpdateRow(
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
  }>
): Promise<OrderRowEnriched> {
  return updateOrderRow(rowId, updates);
}

export async function actionDeleteRow(rowId: number): Promise<void> {
  deleteOrderRow(rowId);
  revalidatePath("/");
}

export async function actionSendOrder(
  orderId: number,
  extraEmail: string
): Promise<void> {
  await dbSendOrder(orderId, extraEmail);
  revalidatePath("/");
}

export async function actionUpdateExtraEmail(
  orderId: number,
  email: string
): Promise<void> {
  updateExtraEmail(orderId, email);
}

export async function actionConfirmMenuImport(
  weekStart: string,
  weekLabel: string,
  items: ParsedMenuItem[],
  tmpPdfName?: string
): Promise<void> {
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
  return addMenuItem(item);
}

export async function actionUpdateMenuItem(
  id: number,
  updates: Partial<{ code: string; name: string; price: number }>
): Promise<MenuItem> {
  return updateMenuItem(id, updates);
}

export async function actionDeleteMenuItem(id: number): Promise<void> {
  deleteMenuItem(id);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionAddPizzaRow(orderId: number): Promise<PizzaOrderRow> {
  const row = addPizzaRow(orderId);
  revalidatePath("/pizza");
  return row;
}

export async function actionUpdatePizzaRow(
  rowId: number,
  updates: Partial<{ personName: string; pizzaItemId: number | null; count: number }>
): Promise<PizzaOrderRow> {
  return updatePizzaRow(rowId, updates);
}

export async function actionDeletePizzaRow(rowId: number): Promise<void> {
  deletePizzaRow(rowId);
  revalidatePath("/pizza");
}

export async function actionUpdatePizzaPrices(
  items: Array<{ code: number; name: string; price: number }>
): Promise<void> {
  replacePizzaItems(items);
  revalidatePath("/pizza");
}

export async function actionReopenOrder(orderId: number): Promise<void> {
  reopenOrder(orderId);
  revalidatePath("/historie");
  revalidatePath(`/historie/${orderId}`);
}

export async function actionCheckPin(pin: string): Promise<boolean> {
  return checkPin(pin);
}

export async function actionSaveSettings(updates: Partial<AppSettings>): Promise<void> {
  saveSettings(updates);
  revalidatePath("/nastaveni");
}
