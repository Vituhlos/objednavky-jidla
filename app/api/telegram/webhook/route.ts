import { type NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import {
  sendTelegramToChat,
  sendTelegramMessage,
  sendTelegramToAdmins,
  sendTelegramToSubscribers,
  sendTelegramOrderSent,
  registerTelegramUser,
  isTelegramAdmin,
  isTelegramRegistered,
  getTelegramSubscription,
  toggleNotifySetting,
  setPersonalReminderTime,
  setPersonalMorningMenuTime,
} from "@/lib/telegram";
import { getDb } from "@/lib/db";
import { getTodayOrderData, sendOrder, reopenOrder, getOrderPdfPath, orderPdfExists } from "@/lib/orders";
import { flattenSubmittedRows } from "@/lib/order-utils";
import { getMenuItemsForDay, getMondayISO } from "@/lib/menu";
import fs from "fs";
import path from "path";
import { broadcast } from "@/lib/sse-broadcast";
import { getPragueNow } from "@/lib/time";
import { scrapePizzaMenu } from "@/lib/pizza-scraper";

export const dynamic = "force-dynamic";

// In-memory state for force_reply custom time inputs (chatId → pending action)
const pendingActions = new Map<string, "reminder" | "morning">();

const DAY_CODE: Record<number, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 0: "Ne" };

// Normalised user input → DB day code (handles diacritics variants)
const DAY_INPUT_MAP: Record<string, string> = {
  po: "Po", pondeli: "Po", "pondělí": "Po",
  ut: "Út", "út": "Út", utery: "Út", "úterý": "Út",
  st: "St", streda: "St", "středa": "St",
  ct: "Čt", "čt": "Čt", ctvrtek: "Čt", "čtvrtek": "Čt",
  pa: "Pá", "pá": "Pá", patek: "Pá", "pátek": "Pá",
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatMenuForDay(dayCode: string, dateStr: string): string {
  const menu = getMenuItemsForDay(dayCode);
  if (menu.soups.length === 0 && menu.meals.length === 0)
    return `🍽 <b>Jídelníček ${dateStr}</b>\n\nJídelníček zatím není k dispozici.`;
  const lines: string[] = [`🍽 <b>Jídelníček ${dateStr}</b>`];
  if (menu.soups.length > 0) {
    lines.push("");
    lines.push("<b>🍲 Polévky</b>");
    menu.soups.forEach((s) => lines.push(`  • ${s.name}`));
  }
  if (menu.meals.length > 0) {
    lines.push("");
    lines.push("<b>🍽 Hlavní jídla</b>");
    menu.meals.forEach((m) => lines.push(`  • ${m.name}`));
  }
  return lines.join("\n");
}

function formatMenu(): string {
  const now = getPragueNow();
  const dayCode = DAY_CODE[now.getDay()];
  if (!dayCode || now.getDay() === 0 || now.getDay() === 6) return "Dnes není pracovní den.";
  const dateStr = now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
  return formatMenuForDay(dayCode, dateStr);
}

function formatZitra(): string {
  const now = getPragueNow();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const jsDay = tomorrow.getDay();
  const dayCode = DAY_CODE[jsDay];
  if (!dayCode || jsDay === 0 || jsDay === 6) return "Zítra není pracovní den.";
  const dateStr = tomorrow.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
  return formatMenuForDay(dayCode, dateStr);
}

function formatStav(): string {
  const data = getTodayOrderData();
  const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "numeric",
  });
  const sent = data.order.status === "sent";
  const totalPeople = data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length;
  const statusLine = sent
    ? `✅ <b>Odesláno</b>  ·  👥 ${totalPeople} osob  ·  💰 ${data.totalPrice} Kč`
    : `📝 <b>Rozepsáno</b>  ·  👥 ${totalPeople} osob  ·  💰 ${data.totalPrice} Kč`;
  const lines: string[] = [`📋 <b>Objednávka ${dateStr}</b>`, statusLine];
  if (totalPeople === 0) {
    lines.push("", "<i>Zatím nikdo neobjednal.</i>");
  } else {
    data.departments.forEach((dept) => {
      const active = dept.rows.filter((r) => r.personName);
      if (active.length === 0) return;
      lines.push("");
      lines.push(`<b>📂 ${dept.label}</b>`);
      active.forEach((r) => {
        const parts: string[] = [];
        if (r.soupItem) parts.push(`🍲 ${r.soupItem.name}`);
        if (r.mainItem) parts.push(`<i>${r.mainItem.name}</i>`);
        const detail = parts.length > 0 ? `  —  ${parts.join("  +  ")}` : "";
        lines.push(`  • <b>${r.personName}</b>${detail}`);
      });
    });
  }
  return lines.join("\n");
}

function formatSouhrn(): string {
  const data = getTodayOrderData();
  const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "numeric",
  });
  const statusIcon = data.order.status === "sent" ? "✅" : "📝";
  const statusLabel = data.order.status === "sent" ? "Odesláno" : "Rozepsáno";
  const totalRows = data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length;
  const blocks: string[] = [];
  data.departments.forEach((dept) => {
    const active = dept.rows.filter((r) => r.personName);
    if (active.length === 0) return;
    const nameWidth = Math.min(18, Math.max(...active.map((r) => r.personName.length)));
    const rows = active.map((r) => {
      const name = r.personName.slice(0, nameWidth).padEnd(nameWidth);
      const meal = r.mainItem?.code ?? (r.mainItem ? "?" : "—");
      return `${name}  ${meal}`;
    });
    blocks.push(`${dept.label}\n${rows.join("\n")}`);
  });
  return (
    `📊 <b>Souhrn ${dateStr}</b>\n` +
    `${statusIcon} ${statusLabel}  ·  👥 ${totalRows} osob  ·  💰 ${data.totalPrice} Kč\n\n` +
    `<pre>${blocks.join("\n\n")}</pre>`
  );
}

// Returns the date of a given JS weekday (1=Mon…5=Fri) within the current Prague week
function getDateForDay(now: Date, targetJsDay: number): Date {
  const currentJsDay = now.getDay();
  const mondayOffset = currentJsDay === 0 ? -6 : 1 - currentJsDay;
  const d = new Date(now);
  d.setDate(d.getDate() + mondayOffset + (targetJsDay - 1));
  return d;
}

async function formatPizza(): Promise<string> {
  try {
    const items = await scrapePizzaMenu();
    if (items.length === 0) return "🍕 <b>Pizza Dublovice</b>\n\nNabídka není momentálně k dispozici.";
    const nameWidth = Math.min(32, Math.max(...items.map((i) => i.name.length)));
    const rows = items.map((item) => {
      const code = String(item.code).padStart(2);
      const name = item.name.slice(0, nameWidth).padEnd(nameWidth);
      return `${code}  ${name}  ${item.price} Kč`;
    });
    return `🍕 <b>Pizza Dublovice</b>\n\n<pre>${rows.join("\n")}</pre>`;
  } catch {
    return "⚠️ Nepodařilo se načíst nabídku pizzy. Zkus to znovu.";
  }
}

function formatTyden(): string {
  const now = getPragueNow();
  const WEEKDAYS: Array<{ jsDay: number; code: string }> = [
    { jsDay: 1, code: "Po" }, { jsDay: 2, code: "Út" }, { jsDay: 3, code: "St" },
    { jsDay: 4, code: "Čt" }, { jsDay: 5, code: "Pá" },
  ];
  const blocks = WEEKDAYS.map(({ jsDay, code }) => {
    const date = getDateForDay(now, jsDay);
    const dateStr = date.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
    return formatMenuForDay(code, dateStr);
  });
  return `📅 <b>Jídelníček na celý týden</b>\n\n` + blocks.join("\n\n―――――――――――――\n\n");
}

function formatStatistiky(): string {
  const db = getDb();
  const weekAgo = new Date(getPragueNow());
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString().slice(0, 10);
  const weekStats = db.prepare(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(o.extra_email), 0) as total
    FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE o.date >= ? AND o.status = 'sent' AND r.person_name != ''
  `).get(weekAgoISO) as { cnt: number; total: number };
  const topMeals = db.prepare(`
    SELECT mi.name, COUNT(*) as cnt
    FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    JOIN menu_items mi ON mi.id = r.main_item_id
    WHERE o.date >= ? AND o.status = 'sent'
    GROUP BY r.main_item_id
    ORDER BY cnt DESC
    LIMIT 3
  `).all(weekAgoISO) as { name: string; cnt: number }[];
  const totalSent = db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE status = 'sent'`).get() as { cnt: number };
  const lines = [`📊 <b>Statistiky</b>`, "", `<b>Posledních 7 dní</b>`, `  Objednávek: ${weekStats.cnt}`, ""];
  if (topMeals.length > 0) {
    lines.push("<b>Nejoblíbenější jídla (7 dní)</b>");
    topMeals.forEach((m, i) => lines.push(`  ${i + 1}. ${m.name} (${m.cnt}×)`));
    lines.push("");
  }
  lines.push(`<b>Celkem</b>`);
  lines.push(`  Odeslaných objednávek: ${totalSent.cnt}`);
  return lines.join("\n");
}

function formatChybi(): string {
  const db = getDb();
  const data = getTodayOrderData();
  const twoWeeksAgo = new Date(getPragueNow());
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoISO = twoWeeksAgo.toISOString().slice(0, 10);
  const recentPeople = db.prepare(`
    SELECT DISTINCT r.person_name FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE r.person_name != '' AND o.date >= ? AND o.id != ? AND o.status = 'sent'
    ORDER BY r.person_name
  `).all(twoWeeksAgoISO, data.order.id) as { person_name: string }[];
  const orderedToday = new Set(
    data.departments.flatMap((d) => d.rows.filter((r) => r.personName).map((r) => r.personName)),
  );
  const missing = recentPeople.map((r) => r.person_name).filter((n) => !orderedToday.has(n));
  if (missing.length === 0) return "✅ Všichni kdo obvykle objednávají, dnes mají řádek.";
  const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "numeric",
  });
  return (
    `👥 <b>Kdo ještě neobjednal (${dateStr})</b>\n\n` +
    missing.map((n) => `  • ${n}`).join("\n") +
    `\n\n<i>Celkem ${missing.length} osob</i>`
  );
}

// ─── Inline keyboards ─────────────────────────────────────────────────────────

const SETTINGS_TEXT = "⚙️ <b>Nastavení notifikací</b>\n\nZapni nebo vypni, co ti má bot posílat:";

function buildSettingsKeyboard(chatId: string) {
  const sub = getTelegramSubscription(chatId);
  const on = "✅", off = "❌";
  const reminderTimeLabel = sub?.personalReminderTime ? `  (${sub.personalReminderTime})` : "";
  const morningTimeLabel = sub?.personalMorningMenuTime ? `  (${sub.personalMorningMenuTime})` : "  (globální)";
  return {
    inline_keyboard: [
      [{ text: `🔔 Připomenutí uzávěrky  ${sub?.notifyReminder ? on : off}`, callback_data: "toggle:reminder" }],
      [{ text: `⏰ Osobní připomenutí${reminderTimeLabel}`, callback_data: "toggle:personal_reminder" }],
      [{ text: `🌅 Ranní jídelníček  ${sub?.notifyMorningMenu ? on : off}`, callback_data: "toggle:morning" }],
      [{ text: `⏰ Osobní čas jídelníčku${morningTimeLabel}`, callback_data: "toggle:personal_morning" }],
      [{ text: `📨 Odeslání objednávky  ${sub?.notifyOrderSent ? on : off}`, callback_data: "toggle:order_sent" }],
      [{ text: `📋 Nový jídelníček  ${sub?.notifyMenuImported ? on : off}`, callback_data: "toggle:menu_imported" }],
      [{ text: "✖ Zavřít", callback_data: "close" }],
    ],
  };
}

function buildWelcomeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📋 Objednávka", callback_data: "cmd:stav" },
        { text: "🍽 Jídelníček", callback_data: "cmd:menu" },
      ],
      [{ text: "⚙️ Nastavení notifikací", callback_data: "cmd:nastaveni" }],
    ],
  };
}

function buildStavKeyboard(chatId = "") {
  const isAdmin = chatId ? isTelegramAdmin(chatId) : false;
  const isSent = isAdmin ? getTodayOrderData().order.status === "sent" : false;
  const rows: object[][] = [[
    { text: "🔄 Obnovit", callback_data: "cmd:stav" },
    { text: "📊 Souhrn", callback_data: "cmd:souhrn" },
    { text: "🍽 Jídelníček", callback_data: "cmd:menu" },
  ]];
  if (isAdmin) {
    rows.push(isSent
      ? [{ text: "🔓 Znovu otevřít objednávku", callback_data: "admin:zrusit" }]
      : [{ text: "📤 Odeslat objednávku", callback_data: "admin:odeslat" }]);
  }
  return { inline_keyboard: rows };
}

function buildMenuKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "cmd:menu" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
      { text: "➡️ Zítra", callback_data: "cmd:zitra" },
    ]],
  };
}

function buildPizzaKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "cmd:pizza" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
    ]],
  };
}

function buildMainReplyKeyboard(isAdmin: boolean) {
  const { telegramAppUrl } = getSettings();
  type KeyboardButton = { text: string } | { text: string; web_app: { url: string } };
  const rows: Array<Array<KeyboardButton>> = [
    [{ text: "📋 Objednávka" }, { text: "📊 Souhrn" }],
    [{ text: "🍽 Menu dnes" },  { text: "📅 Celý týden" }],
    [{ text: "🍕 Pizza" },      { text: "⚙️ Nastavení" }],
  ];
  if (telegramAppUrl) {
    rows.push([{ text: "🌐 Otevřít appku", web_app: { url: telegramAppUrl } }]);
  }
  if (isAdmin) {
    rows.push([{ text: "👑 Admin" }, { text: "📄 PDF" }]);
  }
  return { keyboard: rows, resize_keyboard: true };
}

const REMINDER_TEXT = "⏰ <b>Osobní připomenutí</b>\n\nVyber čas kdy ti bot každý pracovní den pošle připomenutí uzávěrky:";
const REMINDER_TIMES = ["09:30", "10:00", "10:30", "11:00", "11:15", "11:30"];

const CAS_TEXT = "🕐 <b>Čas auto-odesílání</b>\n\nVyber čas kdy se objednávka každý den automaticky odešle:";
const CAS_TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"];

const MORNING_TEXT = "🌅 <b>Osobní čas ranního jídelníčku</b>\n\nVyber čas kdy ti bot každý pracovní den ráno pošle jídelníček:";
const MORNING_TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30"];

function buildCasKeyboard(currentTime: string | null) {
  const rows: object[][] = [];
  for (let i = 0; i < CAS_TIMES.length; i += 3) {
    rows.push(CAS_TIMES.slice(i, i + 3).map((t) => ({
      text: currentTime === t ? `✅ ${t}` : t,
      callback_data: `cas:${t}`,
    })));
  }
  return { inline_keyboard: rows };
}

function buildReminderKeyboard(currentTime: string | null) {
  const row1 = REMINDER_TIMES.slice(0, 3).map((t) => ({
    text: currentTime === t ? `✅ ${t}` : t,
    callback_data: `reminder:${t}`,
  }));
  const row2 = REMINDER_TIMES.slice(3).map((t) => ({
    text: currentTime === t ? `✅ ${t}` : t,
    callback_data: `reminder:${t}`,
  }));
  const rows: object[][] = [row1, row2, [{ text: "⌨️ Vlastní čas", callback_data: "reminder:custom" }]];
  if (currentTime) rows.push([{ text: "❌ Zrušit připomenutí", callback_data: "reminder:cancel" }]);
  rows.push([{ text: "← Zpět na nastavení", callback_data: "cmd:nastaveni" }]);
  return { inline_keyboard: rows };
}

function buildMorningKeyboard(currentTime: string | null) {
  const row1 = MORNING_TIMES.slice(0, 3).map((t) => ({
    text: currentTime === t ? `✅ ${t}` : t,
    callback_data: `morning:${t}`,
  }));
  const row2 = MORNING_TIMES.slice(3).map((t) => ({
    text: currentTime === t ? `✅ ${t}` : t,
    callback_data: `morning:${t}`,
  }));
  const rows: object[][] = [row1, row2, [{ text: "⌨️ Vlastní čas", callback_data: "morning:custom" }]];
  if (currentTime) rows.push([{ text: "❌ Zrušit osobní čas", callback_data: "morning:cancel" }]);
  rows.push([{ text: "← Zpět na nastavení", callback_data: "cmd:nastaveni" }]);
  return { inline_keyboard: rows };
}

function buildPdfKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📄 Objednávka dnes", callback_data: "pdf:objednavka" },
        { text: "📋 Jídelníček", callback_data: "pdf:jidelnicek" },
      ],
      [{ text: "🗂 Starší objednávky", callback_data: "pdf:history" }],
    ],
  };
}

function buildPdfHistoryKeyboard(): object {
  const todayISO = getPragueNow().toISOString().slice(0, 10);
  const rows = getDb()
    .prepare("SELECT id, date FROM orders WHERE status = 'sent' AND date < ? ORDER BY date DESC LIMIT 5")
    .all(todayISO) as { id: number; date: string }[];
  const withPdf = rows.filter((r) => orderPdfExists(r.id));
  if (withPdf.length === 0) {
    return { inline_keyboard: [
      [{ text: "Žádné starší PDF není k dispozici", callback_data: "pdf:noop" }],
      [{ text: "← Zpět", callback_data: "pdf:back" }],
    ]};
  }
  const buttons: object[][] = withPdf.map((r) => [{
    text: new Date(`${r.date}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" }),
    callback_data: `pdf:order:${r.id}`,
  }]);
  buttons.push([{ text: "← Zpět", callback_data: "pdf:back" }]);
  return { inline_keyboard: buttons };
}

function buildTydenKeyboard() {
  const todayCode = DAY_CODE[getPragueNow().getDay()];
  const DAYS = [
    { label: "Po", cb: "day:Po", code: "Po" },
    { label: "Út", cb: "day:Ut", code: "Út" },
    { label: "St", cb: "day:St", code: "St" },
    { label: "Čt", cb: "day:Ct", code: "Čt" },
    { label: "Pá", cb: "day:Pa", code: "Pá" },
  ];
  return {
    inline_keyboard: [DAYS.map((d) => ({
      text: d.code === todayCode ? `• ${d.label} •` : d.label,
      callback_data: d.cb,
    }))],
  };
}

function buildStatisticsKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "cmd:statistiky" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
    ]],
  };
}

function buildAdminChybiKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "admin:chybi" },
      { text: "← Admin panel", callback_data: "cmd:admin" },
    ]],
  };
}

function buildDayViewKeyboard() {
  return {
    inline_keyboard: [[
      { text: "← Týden", callback_data: "cmd:tyden" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
    ]],
  };
}

function buildAdminKeyboard() {
  const data = getTodayOrderData();
  const isSent = data.order.status === "sent";
  return {
    inline_keyboard: [
      isSent
        ? [{ text: "🔓 Znovu otevřít objednávku", callback_data: "admin:zrusit" }]
        : [{ text: "📤 Odeslat objednávku", callback_data: "admin:odeslat" }],
      [{ text: "👥 Kdo ještě neobjednal", callback_data: "admin:chybi" }],
      [{ text: "📄 PDF objednávky", callback_data: "pdf:objednavka" }, { text: "📋 PDF jídelníčku", callback_data: "pdf:jidelnicek" }],
    ],
  };
}

// Maps ReplyKeyboard button texts → command strings
const BUTTON_MAP: Record<string, string> = {
  "📋 objednávka":    "/stav",
  "📊 souhrn":        "/souhrn",
  "🍽 menu dnes":     "/menu",
  "📅 celý týden":    "/tyden",
  "🍕 pizza":         "/pizza",
  "⚙️ nastavení":     "/nastaveni",
  "👑 admin":         "/admin",
  "📄 pdf":           "/pdf",
};

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendTyping(token: string, chatId: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

async function editMessageText(token: string, chatId: string, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", ...(replyMarkup && { reply_markup: replyMarkup }) }),
  }).catch(() => {});
}

async function answerCallbackQuery(token: string, callbackQueryId: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  }).catch(() => {});
}

async function editMessageReplyMarkup(token: string, chatId: string, messageId: number, replyMarkup: object): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
  }).catch(() => {});
}

async function deleteMessage(token: string, chatId: string, messageId: number): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  }).catch(() => {});
}

async function sendPhotoToChat(token: string, chatId: string, photoUrl: string, caption: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML" }),
  }).catch(() => {});
}

async function answerInlineQuery(token: string, inlineQueryId: string, results: object[]): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/answerInlineQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inline_query_id: inlineQueryId, results, cache_time: 60 }),
  }).catch(() => {});
}

async function sendDocument(token: string, chatId: string, filePath: string, filename: string, caption?: string): Promise<void> {
  const buffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", new Blob([buffer], { type: "application/pdf" }), filename);
  if (caption) formData.append("caption", caption);
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: formData,
  }).catch(() => {});
}

async function getBotUsername(token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { username: string } };
    return data.ok && data.result?.username ? data.result.username : null;
  } catch {
    return null;
  }
}

// ─── Update types ─────────────────────────────────────────────────────────────

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
  inline_query?: {
    id: string;
    from: { id: number };
    query: string;
  };
};

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const s = getSettings();
  if (s.telegramEnabled !== "true" || !s.telegramBotToken) return new Response("ok");

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  // ── Callback query (inline button taps) ─────────────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = String(cq.message?.chat.id ?? cq.from.id);
    const messageId = cq.message?.message_id;
    const data = cq.data ?? "";

    await answerCallbackQuery(s.telegramBotToken, cq.id);

    if (!isTelegramRegistered(chatId)) return new Response("ok");

    // Close — smaže zprávu s inline keyboardem (uklidí konverzaci)
    if (data === "close" && messageId) {
      await deleteMessage(s.telegramBotToken, chatId, messageId);
      return new Response("ok");
    }

    // Notification toggles — update in-place
    if (data.startsWith("toggle:") && messageId) {
      const colMap: Record<string, Parameters<typeof toggleNotifySetting>[1]> = {
        "toggle:reminder": "notify_reminder",
        "toggle:morning": "notify_morning_menu",
        "toggle:order_sent": "notify_order_sent",
        "toggle:menu_imported": "notify_menu_imported",
      };
      const col = colMap[data];
      if (col) {
        toggleNotifySetting(chatId, col);
        await editMessageReplyMarkup(s.telegramBotToken, chatId, messageId, buildSettingsKeyboard(chatId));
      } else if (data === "toggle:personal_reminder") {
        const sub = getTelegramSubscription(chatId);
        await editMessageText(s.telegramBotToken, chatId, messageId, REMINDER_TEXT, buildReminderKeyboard(sub?.personalReminderTime ?? null));
      } else if (data === "toggle:personal_morning") {
        const sub = getTelegramSubscription(chatId);
        await editMessageText(s.telegramBotToken, chatId, messageId, MORNING_TEXT, buildMorningKeyboard(sub?.personalMorningMenuTime ?? null));
      }
    }

    // Quick-command buttons — editujeme existující zprávu místo posílání nové
    if (messageId) {
      if (data === "cmd:stav") { await sendTyping(s.telegramBotToken, chatId); await editMessageText(s.telegramBotToken, chatId, messageId, formatStav(), buildStavKeyboard(chatId)); }
      if (data === "cmd:souhrn") { await sendTyping(s.telegramBotToken, chatId); await editMessageText(s.telegramBotToken, chatId, messageId, formatSouhrn(), buildStavKeyboard(chatId)); }
      if (data === "cmd:menu") { await sendTyping(s.telegramBotToken, chatId); await editMessageText(s.telegramBotToken, chatId, messageId, formatMenu(), buildMenuKeyboard()); }
      if (data === "cmd:zitra") { await sendTyping(s.telegramBotToken, chatId); await editMessageText(s.telegramBotToken, chatId, messageId, formatZitra(), buildMenuKeyboard()); }
      if (data === "cmd:tyden") { await editMessageText(s.telegramBotToken, chatId, messageId, "📅 <b>Jídelníček na týden</b>\n\nVyber den:", buildTydenKeyboard()); }
      if (data === "cmd:pizza") { await sendTyping(s.telegramBotToken, chatId); await editMessageText(s.telegramBotToken, chatId, messageId, await formatPizza(), buildPizzaKeyboard()); }
      if (data === "cmd:nastaveni") await editMessageText(s.telegramBotToken, chatId, messageId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));
      if (data === "cmd:statistiky") { await sendTyping(s.telegramBotToken, chatId); await editMessageText(s.telegramBotToken, chatId, messageId, formatStatistiky(), buildStatisticsKeyboard()); }
      if (data === "cmd:admin" && isTelegramAdmin(chatId)) {
        const od = getTodayOrderData();
        await editMessageText(s.telegramBotToken, chatId, messageId,
          "👑 <b>Admin příkazy</b>\n\n" + `Objednávka: ${od.order.status === "sent" ? "✅ Odeslána" : "📝 Rozepsána"}\n\n` + "Pro hromadnou zprávu všem:\n<code>/zprava [text]</code>",
          buildAdminKeyboard());
      }

      // Navigace v týdenním jídelníčku
      const DAY_CB: Record<string, { code: string; jsDay: number }> = {
        "day:Po": { code: "Po", jsDay: 1 }, "day:Ut": { code: "Út", jsDay: 2 },
        "day:St": { code: "St", jsDay: 3 }, "day:Ct": { code: "Čt", jsDay: 4 },
        "day:Pa": { code: "Pá", jsDay: 5 },
      };
      if (data in DAY_CB) {
        const { code, jsDay } = DAY_CB[data];
        const date = getDateForDay(getPragueNow(), jsDay);
        const dateStr = date.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
        await editMessageText(s.telegramBotToken, chatId, messageId, formatMenuForDay(code, dateStr), buildDayViewKeyboard());
      }
    }

    // Výběr času osobního připomenutí
    if (data.startsWith("reminder:") && messageId) {
      const val = data.slice(9);
      if (val === "cancel") {
        setPersonalReminderTime(chatId, null);
        await editMessageText(s.telegramBotToken, chatId, messageId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));
      } else if (val === "custom") {
        pendingActions.set(chatId, "reminder");
        await sendTelegramToChat(chatId, "Napiš čas připomenutí ve formátu <b>HH:MM</b> (např. <code>11:45</code>):", { force_reply: true, selective: true });
      } else if (/^\d{2}:\d{2}$/.test(val)) {
        setPersonalReminderTime(chatId, val);
        await editMessageText(s.telegramBotToken, chatId, messageId, REMINDER_TEXT, buildReminderKeyboard(val));
      }
    }

    // Výběr osobního času ranního jídelníčku
    if (data.startsWith("morning:") && messageId) {
      const val = data.slice(8);
      if (val === "cancel") {
        setPersonalMorningMenuTime(chatId, null);
        await editMessageText(s.telegramBotToken, chatId, messageId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));
      } else if (val === "custom") {
        pendingActions.set(chatId, "morning");
        await sendTelegramToChat(chatId, "Napiš čas ranního jídelníčku ve formátu <b>HH:MM</b> (např. <code>08:15</code>):", { force_reply: true, selective: true });
      } else if (/^\d{2}:\d{2}$/.test(val)) {
        setPersonalMorningMenuTime(chatId, val);
        await editMessageText(s.telegramBotToken, chatId, messageId, MORNING_TEXT, buildMorningKeyboard(val));
      }
    }

    // PDF starší objednávky
    if (data === "pdf:history" && messageId && isTelegramAdmin(chatId)) {
      await editMessageText(s.telegramBotToken, chatId, messageId, "🗂 <b>Starší objednávky</b>\n\nVyber objednávku:", buildPdfHistoryKeyboard());
    }
    if (data === "pdf:back" && messageId && isTelegramAdmin(chatId)) {
      await editMessageText(s.telegramBotToken, chatId, messageId, "📄 Vyber PDF:", buildPdfKeyboard());
    }
    if (data.startsWith("pdf:order:") && isTelegramAdmin(chatId)) {
      const orderId = parseInt(data.slice(10));
      if (orderPdfExists(orderId)) {
        const orderInfo = getDb().prepare("SELECT date FROM orders WHERE id = ?").get(orderId) as { date: string } | undefined;
        const pdfPath = getOrderPdfPath(orderId);
        await sendTyping(s.telegramBotToken, chatId);
        await sendDocument(s.telegramBotToken, chatId, pdfPath, `objednavka_${orderInfo?.date ?? orderId}.pdf`, `📄 Objednávka ${orderInfo?.date ?? ""}`);
      } else {
        await sendTelegramToChat(chatId, "⚠️ PDF pro tuto objednávku není k dispozici.");
      }
    }

    // Výběr času auto-odesílání (admin)
    if (data.startsWith("cas:") && messageId && isTelegramAdmin(chatId)) {
      const val = data.slice(4);
      if (/^\d{2}:\d{2}$/.test(val)) {
        saveSettings({ autoSendTime: val });
        await editMessageText(s.telegramBotToken, chatId, messageId, CAS_TEXT + `\n\n✅ Nastaveno na <b>${val}</b>.`, buildCasKeyboard(val));
      }
    }

    // PDF stažení — jen pro adminy
    if (data.startsWith("pdf:") && isTelegramAdmin(chatId)) {
      if (data === "pdf:objednavka") {
        const orderData = getTodayOrderData();
        if (!orderPdfExists(orderData.order.id)) {
          await sendTelegramToChat(chatId, "⚠️ PDF objednávky neexistuje — objednávka ještě nebyla odeslána.");
        } else {
          await sendTyping(s.telegramBotToken, chatId);
          const pdfPath = getOrderPdfPath(orderData.order.id);
          await sendDocument(s.telegramBotToken, chatId, pdfPath, `objednavka_${orderData.order.date}.pdf`, `📄 Objednávka ${orderData.order.date}`);
        }
      } else if (data === "pdf:jidelnicek") {
        const mondayISO = getMondayISO();
        const menuPdfPath = path.join(process.cwd(), "data", "pdfs", `${mondayISO}.pdf`);
        if (!fs.existsSync(menuPdfPath)) {
          await sendTelegramToChat(chatId, "⚠️ PDF jídelníčku pro tento týden není k dispozici.");
        } else {
          await sendTyping(s.telegramBotToken, chatId);
          await sendDocument(s.telegramBotToken, chatId, menuPdfPath, `jidelnicek_${mondayISO}.pdf`, `📋 Jídelníček od ${mondayISO}`);
        }
      }
    }

    // Admin inline actions
    if (isTelegramAdmin(chatId)) {
      if (data === "admin:odeslat") {
        const orderData = getTodayOrderData();
        if (orderData.order.status === "sent") {
          await sendTelegramToChat(chatId, "⚠️ Objednávka je již odeslána.");
        } else {
          try {
            await sendTyping(s.telegramBotToken, chatId);
            await sendOrder(orderData.order.id, "manual");
            broadcast();
            if (messageId) await editMessageText(s.telegramBotToken, chatId, messageId, "✅ <b>Objednávka odeslána.</b>", buildStavKeyboard(chatId));
            const totalPeople = orderData.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length;
            const dateStr = new Date(`${orderData.order.date}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
            await sendTelegramOrderSent(
              `✅ <b>Objednávka odeslána</b>\n📅 ${dateStr}\n👥 ${totalPeople} osob  ·  💰 ${orderData.totalPrice} Kč`,
              flattenSubmittedRows(orderData),
            );
          } catch (err) {
            await sendTelegramToChat(chatId, `❌ Odeslání selhalo: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
      if (data === "admin:zrusit") {
        const orderData = getTodayOrderData();
        if (orderData.order.status !== "sent") {
          await sendTelegramToChat(chatId, "⚠️ Objednávka nebyla odeslána — není co rušit.");
        } else {
          reopenOrder(orderData.order.id);
          broadcast();
          if (messageId) await editMessageText(s.telegramBotToken, chatId, messageId, "🔓 <b>Objednávka znovu otevřena.</b>", buildStavKeyboard(chatId));
          await sendTelegramToAdmins("🔓 Objednávka byla znovu otevřena — lze ještě upravovat.");
        }
      }
      if (data === "admin:chybi") {
        if (messageId) await editMessageText(s.telegramBotToken, chatId, messageId, formatChybi(), buildAdminChybiKeyboard());
        else await sendTelegramToChat(chatId, formatChybi(), buildAdminChybiKeyboard());
      }
    }

    return new Response("ok");
  }

  // ── Inline query (@bot menu / pizza / stav / souhrn) ────────────────────
  if (update.inline_query) {
    const iq = update.inline_query;
    const query = iq.query.toLowerCase().trim();
    const show = (key: string) => !query || key.startsWith(query) || query.includes(key);
    const results: object[] = [];
    const add = (id: string, title: string, text: string, description: string) =>
      results.push({ type: "article", id, title, description, input_message_content: { message_text: text, parse_mode: "HTML" } });
    if (show("menu")) add("menu", "🍽 Dnešní menu", formatMenu(), "Jídelníček pro dnešní den");
    if (show("pizza")) add("pizza", "🍕 Pizza", await formatPizza(), "Aktuální nabídka pizzerie");
    if (show("stav")) add("stav", "📋 Stav objednávky", formatStav(), "Aktuální stav objednávky LIMA");
    if (show("souhrn")) add("souhrn", "📊 Souhrn", formatSouhrn(), "Kompaktní přehled objednávky");
    if (results.length === 0) add("menu", "🍽 Dnešní menu", formatMenu(), "Jídelníček pro dnešní den");
    await answerInlineQuery(s.telegramBotToken, iq.id, results);
    return new Response("ok");
  }

  // ── Regular message ──────────────────────────────────────────────────────
  const message = update.message;
  if (!message?.text) return new Response("ok");

  const chatId = String(message.chat.id);
  const firstName = message.from?.first_name ?? "";
  const senderUsername = message.from?.username ?? "";
  const cmd = message.text.split("@")[0].toLowerCase().trim();
  const effectiveCmd = BUTTON_MAP[cmd] ?? cmd;

  // Pending custom time input (from force_reply)
  const pendingAction = pendingActions.get(chatId);
  if (pendingAction && isTelegramRegistered(chatId) && !cmd.startsWith("/")) {
    pendingActions.delete(chatId);
    const timeMatch = message.text.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hh = parseInt(timeMatch[1]), mm = parseInt(timeMatch[2]);
      if (hh <= 23 && mm <= 59) {
        const padded = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        if (pendingAction === "reminder") {
          setPersonalReminderTime(chatId, padded);
          await sendTelegramToChat(chatId, REMINDER_TEXT, buildReminderKeyboard(padded));
        } else {
          setPersonalMorningMenuTime(chatId, padded);
          await sendTelegramToChat(chatId, MORNING_TEXT, buildMorningKeyboard(padded));
        }
        return new Response("ok");
      }
    }
    const keyboard = pendingAction === "reminder"
      ? buildReminderKeyboard(getTelegramSubscription(chatId)?.personalReminderTime ?? null)
      : buildMorningKeyboard(getTelegramSubscription(chatId)?.personalMorningMenuTime ?? null);
    await sendTelegramToChat(chatId, `⚠️ Neplatný formát — napiš čas jako <code>HH:MM</code> (např. <code>11:45</code>).`, keyboard);
    return new Response("ok");
  }
  if (pendingAction && cmd.startsWith("/")) pendingActions.delete(chatId);

  if (cmd === "/start") {
    const { isNew, isAdmin } = registerTelegramUser(chatId, firstName, senderUsername);
    const name = firstName ? `, <b>${firstName}</b>` : "";
    if (!isNew) {
      await sendTelegramToChat(
        chatId,
        `👋 Vítej zpět${name}! Tady jsou tvé možnosti:`,
        buildMainReplyKeyboard(isAdmin),
      );
      return new Response("ok");
    }
    const adminNote = isAdmin
      ? "\n\n👑 Jsi první registrovaný — máš roli <b>admin</b>. Můžeš ručně odesílat a rušit objednávky přímo z bota."
      : "";
    const welcomeText =
      `👋 Vítej${name}!\n\n` +
      `Jsem bot systému <b>Objednávky LIMA</b> — firemního objednávání obědů.${adminNote}\n\n` +
      `<b>Co ti bot nabídne:</b>\n` +
      `  🍽 Jídelníček, objednávka a pizza kdykoliv\n` +
      `  🔔 Připomenutí před uzávěrkou (volitelné)\n` +
      `  🌅 Ranní jídelníček (volitelné)\n` +
      `  📋 Upozornění na nový jídelníček (volitelné)\n\n` +
      `Tlačítka dole tě dovedou kam potřebuješ. A hned si můžeš nastavit, co ti mám posílat 👇`;
    await sendTelegramToChat(chatId, welcomeText, buildMainReplyKeyboard(isAdmin));
    // Onboarding: rovnou nabídnout úpravu notifikací (Připomenutí a Ranní menu
    // jsou defaultně vypnuté — chceme aby je nový uživatel zapnul, pokud chce)
    await sendTelegramToChat(
      chatId,
      "🔔 <b>Co ti mám posílat?</b>\n\nKlikni na řádek pro zapnutí/vypnutí. Když budeš hotov, zavři přes ✖.",
      buildSettingsKeyboard(chatId),
    );
    return new Response("ok");
  }

  if (!isTelegramRegistered(chatId)) {
    await sendTelegramToChat(chatId, "Pošli /start pro registraci a přijímání notifikací.");
    return new Response("ok");
  }

  if (effectiveCmd === "/stav") {
    await sendTyping(s.telegramBotToken, chatId);
    await sendTelegramToChat(chatId, formatStav(), buildStavKeyboard(chatId));
  } else if (effectiveCmd === "/souhrn") {
    await sendTyping(s.telegramBotToken, chatId);
    await sendTelegramToChat(chatId, formatSouhrn(), buildStavKeyboard(chatId));
  } else if (effectiveCmd === "/menu" || effectiveCmd.startsWith("/menu ")) {
    const dayArg = effectiveCmd.startsWith("/menu ") ? effectiveCmd.slice(6).trim() : "";
    const dayCode = dayArg ? DAY_INPUT_MAP[dayArg] : null;
    if (dayArg && !dayCode) {
      await sendTelegramToChat(chatId, "⚠️ Neznámý den — vyber ze seznamu:", buildTydenKeyboard());
    } else if (dayCode) {
      const jsDay = Object.entries({ 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá" }).find(([, v]) => v === dayCode)?.[0];
      const date = jsDay ? getDateForDay(getPragueNow(), Number(jsDay)) : getPragueNow();
      const dateStr = date.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
      await sendTelegramToChat(chatId, formatMenuForDay(dayCode, dateStr), buildMenuKeyboard());
    } else {
      await sendTelegramToChat(chatId, formatMenu(), buildMenuKeyboard());
    }
  } else if (effectiveCmd === "/tyden") {
    await sendTelegramToChat(chatId, "📅 <b>Jídelníček na týden</b>\n\nVyber den:", buildTydenKeyboard());
  } else if (effectiveCmd === "/pizza") {
    await sendTyping(s.telegramBotToken, chatId);
    await sendTelegramToChat(chatId, await formatPizza(), buildPizzaKeyboard());
  } else if (effectiveCmd === "/zitra") {
    await sendTyping(s.telegramBotToken, chatId);
    await sendTelegramToChat(chatId, formatZitra(), buildMenuKeyboard());
  } else if (effectiveCmd === "/statistiky") {
    await sendTyping(s.telegramBotToken, chatId);
    await sendTelegramToChat(chatId, formatStatistiky(), buildStatisticsKeyboard());
  } else if (effectiveCmd === "/nastaveni" || effectiveCmd === "/upozorneni") {
    await sendTelegramToChat(chatId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));
  } else if (effectiveCmd === "/pozvat") {
    const botUsername = await getBotUsername(s.telegramBotToken);
    if (botUsername) {
      const botUrl = `https://t.me/${botUsername}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(botUrl)}`;
      await sendPhotoToChat(
        s.telegramBotToken,
        chatId,
        qrUrl,
        `📲 <b>Přidej kolegu k Objednávkám LIMA</b>\n\nNechte naskenovat QR kód nebo pošlete odkaz:\n${botUrl}`,
      );
    } else {
      await sendTelegramToChat(chatId, "⚠️ Nepodařilo se načíst odkaz na bota.");
    }
  } else if (effectiveCmd.startsWith("/nastavit cas ")) {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      const time = effectiveCmd.replace("/nastavit cas ", "").trim();
      const [hh, mm] = time.split(":").map(Number);
      if (!/^\d{1,2}:\d{2}$/.test(time) || hh > 23 || mm > 59) {
        await sendTelegramToChat(chatId, CAS_TEXT, buildCasKeyboard(null));
      } else {
        const padded = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        saveSettings({ autoSendTime: padded });
        await sendTelegramToChat(chatId, CAS_TEXT + `\n\n✅ Nastaveno na <b>${padded}</b>.`, buildCasKeyboard(padded));
      }
    }
  } else if (effectiveCmd === "/odeslat") {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      const data = getTodayOrderData();
      if (data.order.status === "sent") {
        await sendTelegramToChat(chatId, "⚠️ Objednávka je již odeslána.");
      } else {
        try {
          await sendOrder(data.order.id, "manual");
          broadcast();
          const tp = data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length;
          const ds = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
          await sendTelegramOrderSent(
            `✅ <b>Objednávka odeslána</b>\n📅 ${ds}\n👥 ${tp} osob  ·  💰 ${data.totalPrice} Kč`,
            flattenSubmittedRows(data),
          );
        } catch (err) {
          await sendTelegramToChat(
            chatId,
            `❌ Odeslání selhalo: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  } else if (effectiveCmd === "/zrusit") {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      const data = getTodayOrderData();
      if (data.order.status !== "sent") {
        await sendTelegramToChat(chatId, "⚠️ Objednávka nebyla odeslána — není co rušit.");
      } else {
        reopenOrder(data.order.id);
        broadcast();
        await sendTelegramToAdmins("🔓 Objednávka byla znovu otevřena — lze ještě upravovat.");
      }
    }
  } else if (effectiveCmd === "/pdf") {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      await sendTelegramToChat(chatId, "📄 Vyber PDF:", buildPdfKeyboard());
    }
  } else if (effectiveCmd.startsWith("/nastavit reminder ")) {
    const time = effectiveCmd.replace("/nastavit reminder ", "").trim();
    const [hh, mm] = time.split(":").map(Number);
    if (!/^\d{1,2}:\d{2}$/.test(time) || hh > 23 || mm > 59) {
      await sendTelegramToChat(chatId, REMINDER_TEXT, buildReminderKeyboard(null));
    } else {
      const padded = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      setPersonalReminderTime(chatId, padded);
      await sendTelegramToChat(chatId, REMINDER_TEXT, buildReminderKeyboard(padded));
    }
  } else if (effectiveCmd === "/zrusit reminder") {
    setPersonalReminderTime(chatId, null);
    await sendTelegramToChat(chatId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));
  } else if (effectiveCmd === "/admin") {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      const orderData = getTodayOrderData();
      const isSent = orderData.order.status === "sent";
      await sendTelegramToChat(
        chatId,
        "👑 <b>Admin příkazy</b>\n\n" +
          `Objednávka: ${isSent ? "✅ Odeslána" : "📝 Rozepsána"}\n\n` +
          "Pro hromadnou zprávu všem uživatelům:\n<code>/zprava [text]</code>",
        buildAdminKeyboard(),
      );
    }
  } else if (effectiveCmd.startsWith("/zprava ") || effectiveCmd === "/zprava") {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      const text = effectiveCmd.slice(8).trim();
      if (!text) {
        await sendTelegramToChat(chatId, "⚠️ Použití: <code>/zprava [text zprávy]</code>");
      } else {
        await sendTelegramMessage(`📢 <b>Zpráva od admina:</b>\n\n${text}`);
        const preview = text.length > 50 ? text.slice(0, 50) + "…" : text;
        await sendTelegramToChat(chatId, `✅ Zpráva rozeslána: <i>${preview}</i>`);
      }
    }
  } else if (effectiveCmd === "/chybi") {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      await sendTyping(s.telegramBotToken, chatId);
      await sendTelegramToChat(chatId, formatChybi(), buildAdminChybiKeyboard());
    }
  } else if (effectiveCmd === "/pomoc" || effectiveCmd === "/help") {
    const admin = isTelegramAdmin(chatId);
    await sendTelegramToChat(
      chatId,
      "<b>Dostupné příkazy:</b>\n" +
        "/stav — podrobný přehled objednávky\n" +
        "/souhrn — kompaktní tabulka (jméno + kód jídla)\n" +
        "/menu — dnešní jídelníček\n" +
        "/menu Po|Ut|St|Ct|Pa — jídelníček pro konkrétní den\n" +
        "/tyden — jídelníček na celý týden\n" +
        "/zitra — jídelníček na zítřek\n" +
        "/pizza — aktuální nabídka pizzerie\n" +
        "/statistiky — statistiky posledních 7 dní\n" +
        "/nastaveni — nastavení notifikací\n" +
        "/nastavit reminder HH:MM — osobní připomenutí (např. 11:00)\n" +
        "/zrusit reminder — zrušit osobní připomenutí\n" +
        "/pozvat — QR kód pro přidání kolegy\n" +
        (admin
          ? "/pdf — stáhnout PDF objednávky nebo jídelníčku\n" +
            "/admin — admin příkazy (odeslat, znovu otevřít, kdo chybí)\n" +
            "/zprava [text] — rozeslat zprávu všem uživatelům\n" +
            "/chybi — kdo ještě dnes neobjednal\n" +
            "/odeslat — ruční odeslání objednávky\n" +
            "/zrusit — znovu otevřít odeslanou objednávku\n" +
            "/nastavit cas HH:MM — změnit čas auto-odesílání\n"
          : "") +
        "/pomoc — tento seznam",
    );
  }

  return new Response("ok");
}
