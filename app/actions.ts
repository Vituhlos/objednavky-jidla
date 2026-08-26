"use server";

import { revalidatePath } from "next/cache";
import { checkRateLimit, getRateLimitReset, isRateLimited } from "@/lib/rate-limit";
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
  reopenOrderAndUnlock,
  clearOrderRows,
  resendOrderEmail,
  getOrderById,
  getOrderByRowId,
  getRowOwner,
} from "@/lib/orders";
import type { Department, OrderRowEnriched, MealEntry } from "@/lib/types";
import {
  addPizzaRow,
  updatePizzaRow,
  deletePizzaRow,
  getPizzaOrderById,
  getPizzaOrderByRowId,
  getPizzaRowOwner,
  replacePizzaItems,
} from "@/lib/pizza";
import type { PizzaOrderRow } from "@/lib/pizza";
import {
  checkPin,
  getSettings,
  sanitizeClientSettingsUpdates,
  saveSettings,
} from "@/lib/settings";
import { getClosures, addClosure, updateClosure, deleteClosure, validateClosure, type Closure } from "@/lib/closures";
import { getPragueNow, getPragueISODate } from "@/lib/time";
import { forceOpenStamp, isOrderingLocked, isWeeklyCutoffLocked } from "@/lib/cutoff";
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
  findDuplicateGroups,
  getPeople,
  mergePeople,
  renamePerson,
  setPersonActive,
  type DuplicateGroup,
  type Person,
} from "@/lib/people";
import { requireAdmin, requireAdminWithPin, requireSession } from "@/lib/auth/guards";
import {
  PIN_COOKIE,
  issuePinProof,
  pinCookieOptions,
} from "@/lib/auth/pin-gate";
import { cookies } from "next/headers";
import {
  deleteUser,
  isBootstrapPasswordUnchanged,
  listUsers,
  setUserRole,
  setUserStatus,
  type AuthUser,
} from "@/lib/auth/users";
import { createResetLinkForUser } from "@/lib/auth/mail";
import {
  assertId,
  assertMayEditPizzaRow,
  assertMayEditRow,
  resolveOwnPerson,
} from "@/lib/auth/policy";
import type { SessionInfo } from "@/lib/auth/sessions";
import {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  reorderDepartments,
} from "@/lib/departments";
import type { DepartmentInfo } from "@/lib/departments";
import { getCanonicalAppOrigin } from "@/lib/auth/app-url";

function isCutoffActive(): boolean {
  const { cutoffTime, orderForceOpenAt } = getSettings();
  return isOrderingLocked({ cutoffTime, forceOpenAt: orderForceOpenAt, now: getPragueNow() });
}

// ── Oprávnění ────────────────────────────────────────────────
// Čtení zůstává veřejné (R1). Zamykají se zápisy, a to tady u serveru — ne
// schováním tlačítka a ne v proxy/middleware, které jde obejít.
// Pravidla samotná jsou v lib/auth/policy.ts, aby se dala testovat bez Nextu.

async function guardAdmin(): Promise<void> {
  await requireAdmin();
}

function assertDraftOrder<T extends { status: "draft" | "sent" }>(
  order: T | null
): asserts order is T {
  if (!order || order.status !== "draft") {
    throw new Error("Odeslanou nebo neexistující objednávku nelze měnit.");
  }
}

function assertPizzaOrderingOpen(orderDate: string): void {
  const settings = getSettings();
  if (
    orderDate === getPragueISODate() &&
    isWeeklyCutoffLocked({
      enabled: settings.pizzaCutoffEnabled === "true",
      cutoffTime: settings.pizzaCutoffTime,
      cutoffDays: settings.pizzaCutoffDays,
      now: getPragueNow(),
    })
  ) {
    throw new Error("Objednávky pizzy jsou po uzávěrce zavřené.");
  }
}

async function guardSettings(): Promise<void> {
  await requireAdminWithPin();
}

async function guardSession(): Promise<SessionInfo> {
  return requireSession();
}

export async function actionAddRow(
  orderId: number,
  department: Department,
  pushEndpoint?: string,
): Promise<OrderRowEnriched> {
  const session = await guardSession();

  const validOrderId = assertId(orderId, "číslo objednávky");
  const order = getOrderById(validOrderId);
  assertDraftOrder(order);
  if (order?.date === getPragueISODate() && isCutoffActive()) {
    throw new Error("Objednávky jsou uzavřeny po uzávěrce. Požádejte administrátora o otevření.");
  }
  const row = addOrderRow(validOrderId, department, session.personIds[0], pushEndpoint);
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
  assertId(rowId, "číslo řádku");
  const session = await guardSession();
  await assertMayEditRow(session, rowId);

  let personIdOverride: number | null | undefined;
  const safeUpdates = { ...updates };
  if (session.role !== "admin" && updates?.personName !== undefined) {
    const identity = resolveOwnPerson(session, updates.personName);
    if (identity) {
      personIdOverride = identity.personId;
      safeUpdates.personName = identity.name;
    } else {
      personIdOverride = getRowOwner(rowId).personId;
    }
  }

  const order = getOrderByRowId(rowId);
  assertDraftOrder(order);
  if (order?.date === getPragueISODate() && isCutoffActive()) {
    throw new Error("Objednávky jsou uzavřeny po uzávěrce. Požádejte administrátora o otevření.");
  }
  const row = updateOrderRow(rowId, safeUpdates, pushEndpoint, personIdOverride);
  broadcast();
  return row;
}

export async function actionDeleteRow(rowId: number): Promise<void> {
  assertId(rowId, "číslo řádku");
  const session = await guardSession();
  await assertMayEditRow(session, rowId);

  const order = getOrderByRowId(rowId);
  assertDraftOrder(order);
  if (order?.date === getPragueISODate() && isCutoffActive()) {
    throw new Error("Objednávky jsou uzavřeny po uzávěrce. Požádejte administrátora o otevření.");
  }
  deleteOrderRow(rowId);
  revalidatePath("/");
  broadcast();
}

export async function actionSendOrder(orderId: number): Promise<void> {
  await guardAdmin();
  await dbSendOrder(orderId);
  revalidatePath("/");
  broadcast();
  try {
    const { sendTelegramToSubscribers } = await import("@/lib/telegram");
    const { getTodayOrderData } = await import("@/lib/orders");
    const data = getTodayOrderData();
    const { formatOrderTotals } = await import("@/lib/order-summary");
    const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
    await sendTelegramToSubscribers("notify_order_sent", `✅ <b>Objednávka odeslána</b>\n📅 ${dateStr}\n${formatOrderTotals(data)}`);
  } catch {}
}

export async function actionConfirmMenuImport(
  weekStart: string,
  weekLabel: string,
  items: ParsedMenuItem[],
  tmpPdfName?: string
): Promise<void> {
  await guardAdmin();
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
  await guardAdmin();
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
  await guardAdmin();
  return addMenuItem(item);
}

export async function actionUpdateMenuItem(
  id: number,
  updates: Partial<{ code: string; name: string; price: number; allergens: string }>
): Promise<MenuItem> {
  await guardAdmin();
  return updateMenuItem(id, updates);
}

export async function actionDeleteMenuItem(id: number): Promise<void> {
  await guardAdmin();
  deleteMenuItem(id);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionAddPizzaRow(orderId: number): Promise<PizzaOrderRow> {
  const session = await guardSession();
  const validOrderId = assertId(orderId, "číslo pizza objednávky");
  const order = getPizzaOrderById(validOrderId);
  assertDraftOrder(order);
  assertPizzaOrderingOpen(order.date);
  const row = addPizzaRow(validOrderId, session.personIds[0]);
  revalidatePath("/pizza");
  return row;
}

export async function actionUpdatePizzaRow(
  rowId: number,
  updates: Partial<{ personName: string; department: string; pizzaItemId: number | null; count: number }>
): Promise<PizzaOrderRow> {
  const validRowId = assertId(rowId, "číslo pizza řádku");
  const session = await guardSession();
  await assertMayEditPizzaRow(session, validRowId);
  const order = getPizzaOrderByRowId(validRowId);
  assertDraftOrder(order);
  assertPizzaOrderingOpen(order.date);

  let personIdOverride: number | null | undefined;
  const safeUpdates = { ...updates };
  if (session.role !== "admin" && updates?.personName !== undefined) {
    const identity = resolveOwnPerson(session, updates.personName);
    if (identity) {
      personIdOverride = identity.personId;
      safeUpdates.personName = identity.name;
    } else {
      personIdOverride = getPizzaRowOwner(validRowId).personId;
    }
  }

  const row = updatePizzaRow(validRowId, safeUpdates, personIdOverride);
  revalidatePath("/pizza");
  broadcast();
  return row;
}

export async function actionDeletePizzaRow(rowId: number): Promise<void> {
  const validRowId = assertId(rowId, "číslo pizza řádku");
  const session = await guardSession();
  await assertMayEditPizzaRow(session, validRowId);
  const order = getPizzaOrderByRowId(validRowId);
  assertDraftOrder(order);
  assertPizzaOrderingOpen(order.date);
  deletePizzaRow(validRowId);
  revalidatePath("/pizza");
}

export async function actionUpdatePizzaPrices(
  items: Array<{ code: number; name: string; price: number }>
): Promise<{ id: number; code: number; name: string; price: number }[]> {
  await guardAdmin();
  const saved = replacePizzaItems(items);
  revalidatePath("/pizza");
  return saved;
}

export async function actionReopenOrder(orderId: number): Promise<void> {
  await guardAdmin();
  // reopenOrderAndUnlock() po uzávěrce zároveň odemkne objednávání — jinak
  // by byla objednávka "otevřená", ale nikdo by do ní nemohl psát.
  reopenOrderAndUnlock(orderId);
  revalidatePath("/");
  revalidatePath("/historie");
  revalidatePath(`/historie/${orderId}`);
  broadcast();
}

export async function actionUnlockCutoff(_pin: string): Promise<{ ok: boolean; error?: string }> {
  await guardSettings();
  saveSettings({ orderForceOpenAt: forceOpenStamp(getPragueNow()) });
  return { ok: true };
}

export async function actionResendOrder(orderId: number): Promise<void> {
  await guardAdmin();
  await resendOrderEmail(orderId);
}

export async function actionCloseDay(dayCode: string, weekStart: string): Promise<void> {
  await guardAdmin();
  closeDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionOpenDay(dayCode: string, weekStart: string): Promise<void> {
  await guardAdmin();
  openDay(dayCode, weekStart);
  revalidatePath("/jidelnicek");
  revalidatePath("/");
}

export async function actionGetClosures(): Promise<Closure[]> {
  return getClosures();
}

// Returns a result instead of throwing: Next masks server-action error messages in
// production, so a thrown validation message would reach the user as a generic digest.
export async function actionAddClosure(
  startDate: string,
  endDate: string,
  label: string,
  note = "",
  icon = ""
): Promise<{ ok: true; closure: Closure } | { ok: false; error: string }> {
  await guardSettings();
  const problem = validateClosure(startDate, endDate);
  if (problem) return { ok: false, error: problem };

  const closure = addClosure(startDate, endDate, label, note, icon);
  revalidatePath("/");
  revalidatePath("/jidelnicek");
  revalidatePath("/nastaveni");
  broadcast();
  return { ok: true, closure };
}

export async function actionUpdateClosure(
  id: number,
  startDate: string,
  endDate: string,
  label: string,
  note = "",
  icon = ""
): Promise<{ ok: true; closure: Closure } | { ok: false; error: string }> {
  await guardSettings();
  const problem = validateClosure(startDate, endDate, id);
  if (problem) return { ok: false, error: problem };

  const closure = updateClosure(id, { startDate, endDate, label, note, icon });
  revalidatePath("/");
  revalidatePath("/jidelnicek");
  revalidatePath("/nastaveni");
  broadcast();
  return { ok: true, closure };
}

export async function actionDeleteClosure(id: number): Promise<void> {
  await guardSettings();
  deleteClosure(id);
  revalidatePath("/");
  revalidatePath("/jidelnicek");
  revalidatePath("/nastaveni");
  broadcast();
}

export async function actionClearOrder(orderId: number): Promise<void> {
  await guardAdmin();
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
  await guardSettings();
  const dept = addDepartment(data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionUpdateDepartment(
  id: number,
  data: Partial<{ label: string; emailLabel: string; accent: string }>
): Promise<DepartmentInfo> {
  await guardSettings();
  const dept = updateDepartment(id, data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionDeleteDepartment(id: number): Promise<void> {
  await guardSettings();
  deleteDepartment(id);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

export async function actionReorderDepartments(orderedIds: number[]): Promise<void> {
  await guardSettings();
  reorderDepartments(orderedIds);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

// A blocked attempt used to be indistinguishable from a wrong PIN — the screen said
// "nesprávný PIN" while the user was typing the right one. Report the two apart.
export async function actionCheckPin(
  pin: string
): Promise<{ ok: boolean; lockedUntil?: number }> {
  const session = await requireAdmin();
  const windowMs = 10 * 60 * 1000;
  const rules = [
    { key: `pin:session:${session.userId}:${session.sessionId}`, max: 5 },
    { key: `pin:user:${session.userId}`, max: 5 },
    { key: "pin:global", max: 30 },
  ];
  const locked = rules.find((rule) => isRateLimited(rule.key, rule.max));
  if (locked) {
    return { ok: false, lockedUntil: getRateLimitReset(locked.key) ?? Date.now() };
  }
  for (const rule of rules) {
    if (!checkRateLimit(rule.key, rule.max, windowMs)) {
      return { ok: false, lockedUntil: getRateLimitReset(rule.key) ?? Date.now() };
    }
  }
  if (!checkPin(pin)) return { ok: false };

  const store = await cookies();
  store.set(PIN_COOKIE, issuePinProof(session), pinCookieOptions());
  revalidatePath("/nastaveni");
  return { ok: true };
}

export async function actionSaveSettings(updates: Partial<AppSettings>, pin?: string): Promise<void> {
  await guardSettings();
  void pin;
  const sanitized = sanitizeClientSettingsUpdates(updates);
  saveSettings(sanitized);
  if (sanitized.settingsPin) (await cookies()).delete(PIN_COOKIE);
  revalidatePath("/nastaveni");
}

export async function actionCheckImap(): Promise<ImapCheckResult> {
  await guardSettings();
  return checkImapForMenu();
}

export async function actionSendTestPush(): Promise<{ sent: number; error?: string }> {
  await guardSettings();
  const subs = getAllSubscriptions();
  if (subs.length === 0) return { sent: 0, error: "Žádný prohlížeč nemá povolené notifikace." };
  await sendPushToAll("Test notifikace ✓", "Push notifikace fungují správně.", "/");
  return { sent: subs.length };
}

export async function actionDismissAutoSendError(): Promise<void> {
  await guardAdmin();
  saveSettings({ autoSendErrorAcked: "true" });
  revalidatePath("/");
}

export async function actionSetTelegramWebhook(): Promise<{ ok: boolean; description?: string }> {
  await guardSettings();
  const webhookUrl = new URL("/api/telegram/webhook", getCanonicalAppOrigin()).href;
  return setTelegramWebhook(webhookUrl);
}

export async function actionSendTelegramTest(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  await guardSettings();
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
  await guardSettings();
  return getTelegramSubscriptions();
}

export async function actionRemoveTelegramSubscription(chatId: string): Promise<void> {
  await guardSettings();
  removeTelegramSubscription(chatId);
  revalidatePath("/nastaveni");
}

export async function actionSetTelegramAdmin(chatId: string, isAdmin: boolean): Promise<void> {
  await guardSettings();
  setTelegramAdmin(chatId, isAdmin);
  revalidatePath("/nastaveni");
}

export async function actionGetTelegramBotInfo(): Promise<{
  ok: boolean;
  firstName?: string;
  username?: string;
  error?: string;
}> {
  await guardSettings();
  return getTelegramBotInfo();
}

export async function actionGetTelegramWebhookStatus(): Promise<{
  ok: boolean;
  hasWebhook: boolean;
  url?: string;
}> {
  await guardSettings();
  return getTelegramWebhookStatus();
}

export async function actionSetTelegramCommands(): Promise<{ ok: boolean; description?: string }> {
  await guardSettings();
  return setTelegramCommands();
}


// ── Strávníci ────────────────────────────────────────────────────────────────
// Zatím bez kontroly oprávnění — přijde s účty ve fázi 3, kdy se zapisující
// akce zavřou za přihlášení.

export async function actionGetPeople(): Promise<Person[]> {
  await guardSettings();
  return getPeople();
}

export async function actionGetDuplicatePeople(): Promise<DuplicateGroup[]> {
  await guardSettings();
  return findDuplicateGroups();
}

export async function actionRenamePerson(id: number, name: string): Promise<void> {
  await guardSettings();
  renamePerson(id, name);
  broadcast();
}

export async function actionMergePeople(sourceId: number, targetId: number): Promise<void> {
  await guardSettings();
  mergePeople(sourceId, targetId);
  broadcast();
}

export async function actionSetPersonActive(id: number, active: boolean): Promise<void> {
  await guardSettings();
  setPersonActive(id, active);
  broadcast();
}

// ── Účty (administrace) ──────────────────────────────────────────────────────
//
// Správa cizích účtů vyžaduje čerstvé potvrzení PINem. Samotné dlouhé sezení
// správce nestačí, protože odemčený počítač nesmí umožnit změnu rolí ani hesel.

export async function actionListUsers(): Promise<AuthUser[]> {
  await requireAdminWithPin();
  return listUsers();
}

export async function actionSetUserStatus(
  id: number,
  status: "active" | "blocked"
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminWithPin();
  assertId(id, "číslo účtu");
  if (status !== "active" && status !== "blocked") return { ok: false, error: "Neplatný stav." };

  try {
    setUserStatus(id, status);
    return { ok: true };
  } catch (err) {
    // Ochrana posledního správce hlásí česky a srozumitelně — pusť ji dál.
    return { ok: false, error: err instanceof Error ? err.message : "Změna se nepodařila." };
  }
}

export async function actionSetUserRole(
  id: number,
  role: "admin" | "user"
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminWithPin();
  assertId(id, "číslo účtu");
  if (role !== "admin" && role !== "user") return { ok: false, error: "Neplatná role." };

  try {
    setUserRole(id, role);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Změna se nepodařila." };
  }
}

export async function actionDeleteUser(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminWithPin();
  assertId(id, "číslo účtu");

  try {
    deleteUser(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Smazání se nepodařilo." };
  }
}

/**
 * Odkaz na obnovu hesla pro cizí účet.
 *
 * Správce cizí heslo nenastavuje — vygeneruje odkaz a pošle ho. Tím se
 * k cizímu heslu nikdy nedostane, i kdyby chtěl.
 */
export async function actionCreateResetLink(
  id: number
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdminWithPin();
  assertId(id, "číslo účtu");

  try {
    return { ok: true, url: createResetLinkForUser(id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Odkaz se nepodařilo vytvořit." };
  }
}

/** Používá první správce pořád heslo z proměnné prostředí? */
export async function actionBootstrapPasswordUnchanged(): Promise<boolean> {
  await requireAdminWithPin();
  return isBootstrapPasswordUnchanged();
}
