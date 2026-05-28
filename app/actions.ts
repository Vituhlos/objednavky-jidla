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
import { getSettings, saveSettings, checkPin } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";
import { randomBytes } from "crypto";
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
import { requireAuth, requireAdmin } from "@/lib/auth";
import { listUsers, setUserRole, updateUserProfile, changeUserPassword, createEmailVerificationToken, getUserById, getLinkedProviders, verifyPassword, incrementSessionVersion, adminForceVerifyEmail, adminResetUserPassword, deleteUserAccount, type UserRole } from "@/lib/users";

export async function actionAddRow(
  orderId: number,
  department: Department,
  pushEndpoint?: string,
): Promise<OrderRowEnriched> {
  const session = await requireAuth();
  const user = getUserById(session.userId);
  const personName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const row = addOrderRow(orderId, department, session.userId, personName, pushEndpoint);
  revalidatePath("/");
  broadcast();
  return row;
}

async function assertRowOwnership(rowId: number, session: Awaited<ReturnType<typeof requireAuth>>) {
  if (session.user.role === "admin") return;
  const { getDb } = await import("@/lib/db");
  const r = getDb().prepare("SELECT user_id FROM order_rows WHERE id = ?").get(rowId) as { user_id: number | null } | undefined;
  if (!r) throw new Error("Řádek nenalezen.");
  if (r.user_id !== session.userId) throw new Error("Nemáte oprávnění upravovat cizí řádek.");
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
  const session = await requireAuth();
  await assertRowOwnership(rowId, session);
  const row = updateOrderRow(rowId, updates, pushEndpoint);
  broadcast();
  return row;
}

export async function actionDeleteRow(rowId: number): Promise<void> {
  const session = await requireAuth();
  await assertRowOwnership(rowId, session);
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
  await requireAuth();
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
  google: { status: HealthStatus; sub: string };
};

export async function getSettingsHealth(): Promise<SettingsHealth> {
  const { getSettings: gs } = await import("@/lib/settings");
  const { getDepartments: gd } = await import("@/lib/departments");
  const settings = gs();
  const depts = gd();

  const smtpConfigured = !!(settings.smtpHost && settings.smtpUser && settings.smtpFrom);
  const googleConfigured = !!(settings.googleClientId && settings.googleClientSecret);
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
    google: googleConfigured
      ? { status: "ok", sub: "Google OAuth aktivní" }
      : { status: "warning", sub: "Nepřipojeno" },
  };
}

export async function actionSendOrder(orderId: number): Promise<void> {
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
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
  await requireAuth();
  return addMenuItem(item);
}

export async function actionUpdateMenuItem(
  id: number,
  updates: Partial<{ code: string; name: string; price: number; allergens: string }>
): Promise<MenuItem> {
  await requireAuth();
  return updateMenuItem(id, updates);
}

export async function actionDeleteMenuItem(id: number): Promise<void> {
  await requireAuth();
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
  updates: Partial<{ personName: string; department: string; pizzaItemId: number | null; count: number }>
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
): Promise<{ id: number; code: number; name: string; price: number }[]> {
  await requireAuth();
  const saved = replacePizzaItems(items);
  revalidatePath("/pizza");
  return saved;
}

export async function actionReopenOrder(orderId: number): Promise<void> {
  await requireAuth();
  reopenOrder(orderId);
  revalidatePath("/historie");
  revalidatePath(`/historie/${orderId}`);
  broadcast();
}

export async function actionResendOrder(orderId: number): Promise<void> {
  await requireAuth();
  await resendOrderEmail(orderId);
}

export async function actionCloseDay(dayCode: string, weekStart: string): Promise<void> {
  await requireAuth();
  closeDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionOpenDay(dayCode: string, weekStart: string): Promise<void> {
  await requireAuth();
  openDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionClearOrder(orderId: number): Promise<void> {
  await requireAuth();
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

export async function actionSaveSettings(updates: Partial<AppSettings>, _pin?: string): Promise<void> {
  await requireAdmin();
  saveSettings(updates);
  revalidatePath("/nastaveni");
}

export async function actionCheckImap(): Promise<ImapCheckResult> {
  await requireAdmin();
  return checkImapForMenu();
}

export async function actionSendTestPush(): Promise<{ sent: number; error?: string }> {
  await requireAdmin();
  const subs = getAllSubscriptions();
  if (subs.length === 0) return { sent: 0, error: "Žádný prohlížeč nemá povolené notifikace." };
  await sendPushToAll("Test notifikace ✓", "Push notifikace fungují správně.", "/");
  return { sent: subs.length };
}

export async function actionDismissAutoSendError(): Promise<void> {
  saveSettings({ autoSendErrorAcked: "true" });
  revalidatePath("/");
}

export async function actionSetTelegramWebhook(): Promise<{
  ok: boolean;
  description?: string;
  secretGenerated?: boolean;
}> {
  await requireAdmin();
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${proto}://${host}/api/telegram/webhook`;

  let secret = getSettings().telegramWebhookSecret?.trim();
  let secretGenerated = false;
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    saveSettings({ telegramWebhookSecret: secret });
    secretGenerated = true;
  }

  const result = await setTelegramWebhook(webhookUrl, secret);
  revalidatePath("/nastaveni");
  return { ...result, secretGenerated };
}

export async function actionSendTelegramTest(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  await requireAdmin();
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
  await requireAdmin();
  return getTelegramSubscriptions();
}

export async function actionRemoveTelegramSubscription(chatId: string): Promise<void> {
  await requireAdmin();
  removeTelegramSubscription(chatId);
  revalidatePath("/nastaveni");
}

export async function actionSetTelegramAdmin(chatId: string, isAdmin: boolean): Promise<void> {
  await requireAdmin();
  setTelegramAdmin(chatId, isAdmin);
  revalidatePath("/nastaveni");
}

export async function actionGetTelegramBotInfo(): Promise<{
  ok: boolean;
  firstName?: string;
  username?: string;
  error?: string;
}> {
  await requireAdmin();
  return getTelegramBotInfo();
}

export async function actionGetTelegramWebhookStatus(): Promise<{
  ok: boolean;
  hasWebhook: boolean;
  url?: string;
}> {
  await requireAdmin();
  return getTelegramWebhookStatus();
}

export async function actionSetTelegramCommands(): Promise<{ ok: boolean; description?: string }> {
  await requireAdmin();
  return setTelegramCommands();
}

export async function actionListAppUsers() {
  await requireAdmin();
  return listUsers();
}

export async function actionSetAppUserRole(userId: number, role: UserRole): Promise<void> {
  await requireAdmin();
  setUserRole(userId, role);
  revalidatePath("/profil");
  revalidatePath("/nastaveni");
}

export async function actionUpdateProfile(updates: {
  firstName?: string;
  lastName?: string;
  defaultDepartment?: string | null;
  emailOrderConfirmation?: boolean;
}): Promise<void> {
  const session = await requireAuth();
  const u: Parameters<typeof updateUserProfile>[1] = {};
  if (updates.firstName !== undefined) u.firstName = updates.firstName.trim();
  if (updates.lastName !== undefined) u.lastName = updates.lastName.trim();
  if (updates.defaultDepartment !== undefined) u.defaultDepartment = updates.defaultDepartment || null;
  if (updates.emailOrderConfirmation !== undefined) u.emailOrderConfirmation = updates.emailOrderConfirmation;
  updateUserProfile(session.userId, u);
  revalidatePath("/profil");
}

export async function actionGetLinkedProviders(): Promise<string[]> {
  const session = await requireAuth();
  return getLinkedProviders(session.userId);
}

export async function actionChangeEmail(newEmail: string, password: string): Promise<void> {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(newEmail)) throw new Error("Neplatná e-mailová adresa.");
  const session = await requireAuth();
  const user = getUserById(session.userId);
  if (!user) throw new Error("Uživatel nenalezen.");
  if (!user.passwordHash) throw new Error("Účet přes Google nemá heslo — e-mail nelze změnit takto.");
  if (!verifyPassword(password, user.passwordHash)) throw new Error("Nesprávné heslo.");
  updateUserProfile(session.userId, { email: newEmail.trim().toLowerCase() });
  revalidatePath("/profil");
}

export async function actionGetMyOrders(): Promise<{ date: string; mainDish: string | null }[]> {
  const session = await requireAuth();
  const user = getUserById(session.userId);
  if (!user) return [];
  const personName = `${user.firstName} ${user.lastName}`.trim();
  if (!personName) return [];
  const { getDb } = await import("@/lib/db");
  const rows = getDb().prepare(`
    SELECT DISTINCT o.date,
      (SELECT mi.name FROM order_rows r2 LEFT JOIN menu_items mi ON mi.id = r2.main_item_id
       WHERE r2.order_id = o.id AND r2.person_name = ? AND r2.main_item_id IS NOT NULL LIMIT 1) as main_dish
    FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE r.person_name = ?
    ORDER BY o.date DESC
    LIMIT 30
  `).all(personName, personName) as { date: string; main_dish: string | null }[];
  return rows.map((r) => ({ date: r.date, mainDish: r.main_dish }));
}

export async function actionChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  const session = await requireAuth();
  changeUserPassword(session.userId, oldPassword, newPassword);
}

export async function actionRevokeAllSessions(): Promise<void> {
  const session = await requireAuth();
  incrementSessionVersion(session.userId);
}

export async function actionDeleteAccount(password?: string): Promise<void> {
  const session = await requireAuth();
  const user = getUserById(session.userId);
  if (!user) throw new Error("Uživatel nenalezen.");
  if (user.passwordHash) {
    if (!password) throw new Error("Pro smazání účtu zadejte heslo.");
    if (!verifyPassword(password, user.passwordHash)) throw new Error("Nesprávné heslo.");
  }
  deleteUserAccount(session.userId);
}

export async function actionAdminForceVerifyEmail(userId: number): Promise<void> {
  await requireAdmin();
  adminForceVerifyEmail(userId);
}

export async function actionAdminResetPassword(userId: number, newPassword: string): Promise<void> {
  await requireAdmin();
  adminResetUserPassword(userId, newPassword);
}

export async function actionAdminDeleteUser(userId: number): Promise<void> {
  const session = await requireAdmin();
  if (session.userId === userId) throw new Error("Nemůžeš smazat vlastní účet.");
  deleteUserAccount(userId);
}

export async function actionResendVerifyEmail(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAuth();
  const user = getUserById(session.userId);
  if (!user) return { ok: false, error: "Uživatel nenalezen." };
  if (user.emailVerified) return { ok: false, error: "E-mail je již ověřen." };
  if (!user.email) return { ok: false, error: "Účet nemá e-mailovou adresu." };
  try {
    const { sendVerifyEmail } = await import("@/lib/email");
    const token = createEmailVerificationToken(session.userId);
    const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    await sendVerifyEmail(user.email, verifyUrl, user.firstName || "");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

