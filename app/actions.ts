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
  getDeptSuggestions as getDeptSuggestionsDb,
  type DeptSuggestion,
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
import {
  setTelegramWebhook,
  setTelegramCommands,
  getTelegramSubscriptions,
  removeTelegramSubscription,
  setTelegramAdmin,
  getTelegramBotInfo,
  getTelegramWebhookStatus,
} from "@/lib/telegram";
import type { TelegramSubscription } from "@/lib/telegram";
import { checkImapForMenu } from "@/lib/imap";
import type { ImapCheckResult } from "@/lib/imap";
import { sendPushToAll, getAllSubscriptions } from "@/lib/push";
import { broadcast } from "@/lib/sse-broadcast";
import {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  reorderDepartments,
} from "@/lib/departments";
import type { DepartmentInfo } from "@/lib/departments";

export async function actionAddRow(
  orderId: number,
  department: Department,
  pushEndpoint?: string,
): Promise<OrderRowEnriched> {
  const row = addOrderRow(orderId, department, pushEndpoint);
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
  }>,
  pushEndpoint?: string,
): Promise<OrderRowEnriched> {
  const row = updateOrderRow(rowId, updates, pushEndpoint);
  broadcast();
  return row;
}

export async function actionDeleteRow(rowId: number): Promise<void> {
  deleteOrderRow(rowId);
  revalidatePath("/");
  broadcast();
}

export async function getDeptSuggestions(
  department: Department,
  limit = 4,
): Promise<DeptSuggestion[]> {
  return getDeptSuggestionsDb(department, limit);
}

export async function actionDuplicateOrder(
  sourceOrderId: number,
): Promise<{ newOrderId: number; copiedRowCount: number }> {
  const { duplicateOrderRows } = await import("@/lib/orders");
  const result = duplicateOrderRows(sourceOrderId);
  revalidatePath("/");
  broadcast();
  return result;
}

export async function getHistoryStats() {
  const { getHistoryStats: fn } = await import("@/lib/orders");
  return fn();
}

export async function getCalendarHeatmap(year: number, month: number) {
  const { getCalendarHeatmap: fn } = await import("@/lib/orders");
  return fn(year, month);
}

export type HealthStatus = "ok" | "warning" | "error";
export type SettingsHealth = {
  smtp: { status: HealthStatus; sub: string };
  autoSend: { status: HealthStatus; sub: string };
  autoImport: { status: HealthStatus; sub: string };
  push: { status: HealthStatus; sub: string };
  pin: { status: HealthStatus; sub: string };
  departments: { status: HealthStatus; sub: string };
  prices: { status: HealthStatus; sub: string };
};

export async function getSettingsHealth(): Promise<SettingsHealth> {
  const { getSettings: gs } = await import("@/lib/settings");
  const { getDepartments: gd } = await import("@/lib/departments");
  const settings = gs();
  const depts = gd();

  const smtpConfigured = !!(settings.smtpHost && settings.smtpUser && settings.smtpFrom);
  const autoSendEnabled = settings.autoSendEnabled === "true";
  const autoSendDays = settings.autoSendDays.split(",").map((s) => s.trim()).filter(Boolean);
  const imapEnabled = settings.imapEnabled === "true";
  const imapConfigured = !!(settings.imapHost && settings.imapUser);
  const vapidConfigured = !!(settings.vapidPublicKey && settings.vapidPrivateKey);
  const pinDefault = settings.settingsPin && /^(?:1234|[a-f0-9]{0,5})$/.test(settings.settingsPin) === false;
  const defaultPin = !pinDefault;
  const defaultsOk = parseInt(settings.defaultSoupPrice) > 0 && parseInt(settings.defaultMealPrice) > 0;

  return {
    smtp: smtpConfigured
      ? { status: "ok", sub: settings.smtpHost }
      : { status: "error", sub: "Nekonfigurováno" },
    autoSend: autoSendEnabled && autoSendDays.length > 0 && settings.autoSendTime
      ? { status: "ok", sub: `${autoSendDays.join(",")} v ${settings.autoSendTime}` }
      : autoSendEnabled
        ? { status: "warning", sub: "Chybí dny nebo čas" }
        : { status: "error", sub: "Vypnuto" },
    autoImport: imapEnabled && imapConfigured
      ? { status: "ok", sub: settings.imapHost }
      : imapEnabled
        ? { status: "warning", sub: "Chybí konfigurace" }
        : { status: "error", sub: "Vypnuto" },
    push: vapidConfigured
      ? { status: "ok", sub: "VAPID nastaveno" }
      : { status: "error", sub: "Klíče chybí" },
    pin: defaultPin
      ? { status: "error", sub: "Default 1234 — změň PIN" }
      : { status: "ok", sub: "Nastaven vlastní PIN" },
    departments: depts.length > 0
      ? { status: "ok", sub: `${depts.length} aktivních` }
      : { status: "error", sub: "Žádné oddělení" },
    prices: defaultsOk
      ? { status: "ok", sub: `Polévka ${settings.defaultSoupPrice}, hlavní ${settings.defaultMealPrice}` }
      : { status: "warning", sub: "Některé ceny chybí" },
  };
}

export async function actionSendOrder(orderId: number): Promise<void> {
  await dbSendOrder(orderId);
  revalidatePath("/");
  broadcast();
  try {
    const { sendTelegramOrderSent } = await import("@/lib/telegram");
    const { getTodayOrderData } = await import("@/lib/orders");
    const { flattenSubmittedRows } = await import("@/lib/order-utils");
    const data = getTodayOrderData();
    const totalPeople = data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length;
    const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
    await sendTelegramOrderSent(
      `✅ <b>Objednávka odeslána</b>\n📅 ${dateStr}\n👥 ${totalPeople} osob  ·  💰 ${data.totalPrice} Kč`,
      flattenSubmittedRows(data),
    );
  } catch {}
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
  const { sendTelegramToSubscribers } = await import("@/lib/telegram");
  await sendTelegramToSubscribers("notify_menu_imported", `📋 <b>Jídelníček importován</b>\n${weekLabel} · ${items.length} položek`);
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
  updates: Partial<{ code: string; name: string; price: number; allergens: string }>
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
  updates: Partial<{ personName: string; department: string; pizzaItemId: number | null; count: number }>
): Promise<PizzaOrderRow> {
  const row = updatePizzaRow(rowId, updates);
  revalidatePath("/pizza");
  broadcast();
  return row;
}

export async function actionDeletePizzaRow(rowId: number): Promise<void> {
  deletePizzaRow(rowId);
  revalidatePath("/pizza");
}

export async function actionUpdatePizzaPrices(
  items: Array<{ code: number; name: string; price: number }>
): Promise<{ id: number; code: number; name: string; price: number }[]> {
  const saved = replacePizzaItems(items);
  revalidatePath("/pizza");
  return saved;
}

export async function actionReopenOrder(orderId: number): Promise<void> {
  reopenOrder(orderId);
  revalidatePath("/historie");
  revalidatePath(`/historie/${orderId}`);
  broadcast();
}

export async function actionResendOrder(orderId: number): Promise<void> {
  await resendOrderEmail(orderId);
}

export async function actionCloseDay(dayCode: string, weekStart: string): Promise<void> {
  closeDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionOpenDay(dayCode: string, weekStart: string): Promise<void> {
  openDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionClearOrder(orderId: number): Promise<void> {
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
  const dept = addDepartment(data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionUpdateDepartment(
  id: number,
  data: Partial<{ label: string; emailLabel: string; accent: string }>
): Promise<DepartmentInfo> {
  const dept = updateDepartment(id, data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionDeleteDepartment(id: number): Promise<void> {
  deleteDepartment(id);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

export async function actionReorderDepartments(orderedIds: number[]): Promise<void> {
  reorderDepartments(orderedIds);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

export async function actionCheckPin(pin: string): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRateLimit(`pin:${ip}`, 5, 10 * 60 * 1000)) return false;
  return checkPin(pin);
}

export async function actionSaveSettings(updates: Partial<AppSettings>, pin?: string): Promise<void> {
  if (!checkPin(pin ?? "")) throw new Error("Neplatný PIN.");
  saveSettings(updates);
  revalidatePath("/nastaveni");
}

export async function actionCheckImap(): Promise<ImapCheckResult> {
  return checkImapForMenu();
}

export async function actionSendTestPush(): Promise<{ sent: number; error?: string }> {
  const subs = getAllSubscriptions();
  if (subs.length === 0) return { sent: 0, error: "Žádný prohlížeč nemá povolené notifikace." };
  await sendPushToAll("Test notifikace ✓", "Push notifikace fungují správně.", "/");
  return { sent: subs.length };
}

export async function actionDismissAutoSendError(): Promise<void> {
  saveSettings({ autoSendErrorAcked: "true" });
  revalidatePath("/");
}

export async function actionSetTelegramWebhook(): Promise<{ ok: boolean; description?: string }> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${proto}://${host}/api/telegram/webhook`;
  return setTelegramWebhook(webhookUrl);
}

export async function actionSendTelegramTest(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const { sendTelegramMessage, getTelegramSubscriptions } = await import("@/lib/telegram");
  const subs = getTelegramSubscriptions();
  if (subs.length === 0) return { ok: false, error: "Žádní registrovaní uživatelé. Pošli /start botovi." };
  try {
    await sendTelegramMessage("✅ Test zprávy z Objednávky LIMA — Telegram funguje!");
    return { ok: true, sent: subs.length };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function actionGetTelegramSubscriptions(): Promise<TelegramSubscription[]> {
  return getTelegramSubscriptions();
}

export async function actionRemoveTelegramSubscription(chatId: string): Promise<void> {
  removeTelegramSubscription(chatId);
  revalidatePath("/nastaveni");
}

export async function actionSetTelegramAdmin(chatId: string, isAdmin: boolean): Promise<void> {
  setTelegramAdmin(chatId, isAdmin);
  revalidatePath("/nastaveni");
}

export async function actionGetTelegramBotInfo(): Promise<{
  ok: boolean;
  firstName?: string;
  username?: string;
  error?: string;
}> {
  return getTelegramBotInfo();
}

export async function actionGetTelegramWebhookStatus(): Promise<{
  ok: boolean;
  hasWebhook: boolean;
  url?: string;
}> {
  return getTelegramWebhookStatus();
}

export async function actionSetTelegramCommands(): Promise<{ ok: boolean; description?: string }> {
  return setTelegramCommands();
}

