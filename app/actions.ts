"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkRateLimit, getRateLimitReset } from "@/lib/rate-limit";
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
} from "@/lib/orders";
import type { Department, OrderRowEnriched, MealEntry } from "@/lib/types";
import {
  addPizzaRow,
  updatePizzaRow,
  deletePizzaRow,
  replacePizzaItems,
} from "@/lib/pizza";
import type { PizzaOrderRow } from "@/lib/pizza";
import { saveSettings, checkPin, getSettings } from "@/lib/settings";
import { getClosures, addClosure, updateClosure, deleteClosure, validateClosure, type Closure } from "@/lib/closures";
import { getPragueNow, getPragueISODate } from "@/lib/time";
import { forceOpenStamp, isOrderingLocked } from "@/lib/cutoff";
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
import { getSession, requireAdmin, requireSession } from "@/lib/auth/guards";
import {
  jePinDokladPlatny,
  PIN_COOKIE,
  pinCookieOptions,
  vystavPinDoklad,
} from "@/lib/auth/pin-gate";
import { logAudit } from "@/lib/audit";
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
  accountsEnabled,
  assertId,
  assertMayEditRow,
  assertNameIsOwn,
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

function isCutoffActive(): boolean {
  const { cutoffTime, orderForceOpenAt } = getSettings();
  return isOrderingLocked({ cutoffTime, forceOpenAt: orderForceOpenAt, now: getPragueNow() });
}

// ── Oprávnění ────────────────────────────────────────────────
// Čtení zůstává veřejné (R1). Zamykají se zápisy, a to tady u serveru — ne
// schováním tlačítka a ne v proxy/middleware, které jde obejít.
// Pravidla samotná jsou v lib/auth/policy.ts, aby se dala testovat bez Nextu.

/**
 * Vyžádá správce. Propustí i toho, kdo právě zadal PIN, a režim bez účtů.
 *
 * PIN je vědomě ponechaný jako zadní vrátka — viz lib/auth/pin-gate.ts.
 */
async function guardAdmin(): Promise<void> {
  if (!accountsEnabled()) return;
  if (jePinDokladPlatny((await cookies()).get(PIN_COOKIE)?.value)) return;
  await requireAdmin();
}

/** Vyžádá přihlášení. V představu bez účtů vrátí `null`. */
async function guardSession(): Promise<SessionInfo | null> {
  return accountsEnabled() ? requireSession() : null;
}

export async function actionAddRow(
  orderId: number,
  department: Department,
  pushEndpoint?: string,
): Promise<OrderRowEnriched> {
  await guardSession();

  const order = getOrderById(assertId(orderId, "číslo objednávky"));
  if (order?.date === getPragueISODate() && isCutoffActive()) {
    throw new Error("Objednávky jsou uzavřeny po uzávěrce. Požádejte administrátora o otevření.");
  }
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
  assertId(rowId, "číslo řádku");
  const session = await guardSession();
  if (session) {
    await assertMayEditRow(session, rowId);
    if (updates?.personName !== undefined) await assertNameIsOwn(session, updates.personName);
  }

  const order = getOrderByRowId(rowId);
  if (order?.date === getPragueISODate() && isCutoffActive()) {
    throw new Error("Objednávky jsou uzavřeny po uzávěrce. Požádejte administrátora o otevření.");
  }
  const row = updateOrderRow(rowId, updates, pushEndpoint);
  broadcast();
  return row;
}

export async function actionDeleteRow(rowId: number): Promise<void> {
  assertId(rowId, "číslo řádku");
  const session = await guardSession();
  if (session) await assertMayEditRow(session, rowId);

  const order = getOrderByRowId(rowId);
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
  await guardSession();
  const row = addPizzaRow(orderId);
  revalidatePath("/pizza");
  return row;
}

export async function actionUpdatePizzaRow(
  rowId: number,
  updates: Partial<{ personName: string; department: string; pizzaItemId: number | null; count: number }>
): Promise<PizzaOrderRow> {
  await guardSession();
  const row = updatePizzaRow(rowId, updates);
  revalidatePath("/pizza");
  broadcast();
  return row;
}

export async function actionDeletePizzaRow(rowId: number): Promise<void> {
  await guardSession();
  deletePizzaRow(rowId);
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

export async function actionUnlockCutoff(pin: string): Promise<{ ok: boolean; error?: string }> {
  await guardAdmin();
  if (!checkPin(pin)) return { ok: false, error: "Špatný PIN" };
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
  await guardAdmin();
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
  await guardAdmin();
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
  await guardAdmin();
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
  await guardAdmin();
  const dept = addDepartment(data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionUpdateDepartment(
  id: number,
  data: Partial<{ label: string; emailLabel: string; accent: string }>
): Promise<DepartmentInfo> {
  await guardAdmin();
  const dept = updateDepartment(id, data);
  revalidatePath("/");
  revalidatePath("/nastaveni");
  return dept;
}

export async function actionDeleteDepartment(id: number): Promise<void> {
  await guardAdmin();
  deleteDepartment(id);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

export async function actionReorderDepartments(orderedIds: number[]): Promise<void> {
  await guardAdmin();
  reorderDepartments(orderedIds);
  revalidatePath("/");
  revalidatePath("/nastaveni");
}

// A blocked attempt used to be indistinguishable from a wrong PIN — the screen said
// "nesprávný PIN" while the user was typing the right one. Report the two apart.
export async function actionCheckPin(
  pin: string
): Promise<{ ok: boolean; lockedUntil?: number }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `pin:${ip}`;
  if (!checkRateLimit(key, 5, 10 * 60 * 1000)) {
    return { ok: false, lockedUntil: getRateLimitReset(key) ?? Date.now() };
  }
  if (!checkPin(pin)) return { ok: false };

  const store = await cookies();
  store.set(PIN_COOKIE, vystavPinDoklad(), pinCookieOptions());

  // Vstup do Nastavení mimo správcovský účet má být vidět — jsou to zadní vrátka.
  const session = await getSession();
  if (accountsEnabled() && session?.role !== "admin") {
    logAudit({ action: "settings_pin_bypass", details: "Nastavení otevřena PINem bez správcovského účtu" });
  }
  return { ok: true };
}

export async function actionSaveSettings(updates: Partial<AppSettings>, pin?: string): Promise<void> {
  await guardAdmin();
  if (!checkPin(pin ?? "")) throw new Error("Neplatný PIN.");
  saveSettings(updates);
  revalidatePath("/nastaveni");
}

export async function actionCheckImap(): Promise<ImapCheckResult> {
  await guardAdmin();
  return checkImapForMenu();
}

export async function actionSendTestPush(): Promise<{ sent: number; error?: string }> {
  await guardAdmin();
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
  await guardAdmin();
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${proto}://${host}/api/telegram/webhook`;
  return setTelegramWebhook(webhookUrl);
}

export async function actionSendTelegramTest(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  await guardAdmin();
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
  await guardAdmin();
  return getTelegramSubscriptions();
}

export async function actionRemoveTelegramSubscription(chatId: string): Promise<void> {
  await guardAdmin();
  removeTelegramSubscription(chatId);
  revalidatePath("/nastaveni");
}

export async function actionSetTelegramAdmin(chatId: string, isAdmin: boolean): Promise<void> {
  await guardAdmin();
  setTelegramAdmin(chatId, isAdmin);
  revalidatePath("/nastaveni");
}

export async function actionGetTelegramBotInfo(): Promise<{
  ok: boolean;
  firstName?: string;
  username?: string;
  error?: string;
}> {
  await guardAdmin();
  return getTelegramBotInfo();
}

export async function actionGetTelegramWebhookStatus(): Promise<{
  ok: boolean;
  hasWebhook: boolean;
  url?: string;
}> {
  await guardAdmin();
  return getTelegramWebhookStatus();
}

export async function actionSetTelegramCommands(): Promise<{ ok: boolean; description?: string }> {
  await guardAdmin();
  return setTelegramCommands();
}


// ── Strávníci ────────────────────────────────────────────────────────────────
// Zatím bez kontroly oprávnění — přijde s účty ve fázi 3, kdy se zapisující
// akce zavřou za přihlášení.

export async function actionGetPeople(): Promise<Person[]> {
  await guardAdmin();
  return getPeople();
}

export async function actionGetDuplicatePeople(): Promise<DuplicateGroup[]> {
  await guardAdmin();
  return findDuplicateGroups();
}

export async function actionRenamePerson(id: number, name: string): Promise<void> {
  await guardAdmin();
  renamePerson(id, name);
  broadcast();
}

export async function actionMergePeople(sourceId: number, targetId: number): Promise<void> {
  await guardAdmin();
  mergePeople(sourceId, targetId);
  broadcast();
}

export async function actionSetPersonActive(id: number, active: boolean): Promise<void> {
  await guardAdmin();
  setPersonActive(id, active);
  broadcast();
}

// ── Účty (administrace) ──────────────────────────────────────────────────────
//
// Tyhle akce se drží `requireAdmin()`, ne `guardAdmin()` — vědomě obcházejí
// předúčtový režim. Kdyby v něm platily, mohl by se v databázi bez správce
// kdokoli povýšit na správce a z toho režimu tím natrvalo vystoupit. Dokud
// správce není, nemá se tu co spravovat: první vzniká z ADMIN_EMAIL při migraci.

export async function actionListUsers(): Promise<AuthUser[]> {
  await requireAdmin();
  return listUsers();
}

export async function actionSetUserStatus(
  id: number,
  status: "active" | "blocked"
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  assertId(id, "číslo účtu");

  try {
    return { ok: true, url: createResetLinkForUser(id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Odkaz se nepodařilo vytvořit." };
  }
}

/** Používá první správce pořád heslo z proměnné prostředí? */
export async function actionBootstrapPasswordUnchanged(): Promise<boolean> {
  await requireAdmin();
  return isBootstrapPasswordUnchanged();
}
