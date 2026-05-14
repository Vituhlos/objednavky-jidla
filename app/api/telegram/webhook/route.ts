import { type NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import {
  sendTelegramToChat,
  sendTelegramMessage,
  sendTelegramToSubscribers,
  registerTelegramUser,
  isTelegramAdmin,
  isTelegramRegistered,
  getTelegramSubscription,
  toggleNotifySetting,
} from "@/lib/telegram";
import { getDb } from "@/lib/db";
import { getTodayOrderData, sendOrder, reopenOrder } from "@/lib/orders";
import { getMenuItemsForDay } from "@/lib/menu";
import { broadcast } from "@/lib/sse-broadcast";
import { getPragueNow } from "@/lib/time";
import { scrapePizzaMenu } from "@/lib/pizza-scraper";

export const dynamic = "force-dynamic";

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
  const statusLine = sent
    ? `✅ <b>Odesláno</b>  ·  👥 ${data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length} osob  ·  💰 ${data.totalPrice} Kč`
    : `📝 <b>Rozepsáno</b>  ·  👥 ${data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length} osob  ·  💰 ${data.totalPrice} Kč`;
  const lines: string[] = [`📋 <b>Objednávka ${dateStr}</b>`, statusLine];
  data.departments.forEach((dept) => {
    const active = dept.rows.filter((r) => r.personName);
    if (active.length === 0) return;
    lines.push("");
    lines.push(`<b>📂 ${dept.label}</b>`);
    active.forEach((r) => {
      const meal = r.mainItem ? `  <i>${r.mainItem.name}</i>` : "";
      lines.push(`  • <b>${r.personName}</b>${meal}`);
    });
  });
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
  return {
    inline_keyboard: [
      [{ text: `🔔 Připomenutí uzávěrky  ${sub?.notifyReminder ? on : off}`, callback_data: "toggle:reminder" }],
      [{ text: `🌅 Ranní jídelníček  ${sub?.notifyMorningMenu ? on : off}`, callback_data: "toggle:morning" }],
      [{ text: `📬 Objednávka odeslána  ${sub?.notifyOrderSent ? on : off}`, callback_data: "toggle:order_sent" }],
      [{ text: `📋 Nový jídelníček  ${sub?.notifyMenuImported ? on : off}`, callback_data: "toggle:menu_imported" }],
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

function buildStavKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "cmd:stav" },
      { text: "📊 Souhrn", callback_data: "cmd:souhrn" },
      { text: "🍽 Jídelníček", callback_data: "cmd:menu" },
    ]],
  };
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
    rows.push([{ text: "👑 Admin" }]);
  }
  return { keyboard: rows, resize_keyboard: true };
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
};

// ─── Telegram API helpers ─────────────────────────────────────────────────────

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
      }
    }

    // Quick-command buttons
    if (data === "cmd:stav") await sendTelegramToChat(chatId, formatStav(), buildStavKeyboard());
    if (data === "cmd:souhrn") await sendTelegramToChat(chatId, formatSouhrn(), buildStavKeyboard());
    if (data === "cmd:menu") await sendTelegramToChat(chatId, formatMenu(), buildMenuKeyboard());
    if (data === "cmd:zitra") await sendTelegramToChat(chatId, formatZitra(), buildMenuKeyboard());
    if (data === "cmd:tyden") await sendTelegramToChat(chatId, formatTyden());
    if (data === "cmd:pizza") await sendTelegramToChat(chatId, await formatPizza(), buildPizzaKeyboard());
    if (data === "cmd:nastaveni") await sendTelegramToChat(chatId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));

    // Admin inline actions
    if (isTelegramAdmin(chatId)) {
      if (data === "admin:odeslat") {
        const orderData = getTodayOrderData();
        if (orderData.order.status === "sent") {
          await sendTelegramToChat(chatId, "⚠️ Objednávka je již odeslána.");
        } else {
          try {
            await sendOrder(orderData.order.id, "manual");
            broadcast();
            await sendTelegramMessage("✅ Objednávka byla odeslána přes Telegram.");
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
          await sendTelegramToSubscribers("notify_order_sent", "🔓 Objednávka byla znovu otevřena — lze ještě upravovat.");
        }
      }
      if (data === "admin:chybi") {
        await sendTelegramToChat(chatId, formatChybi());
      }
    }

    return new Response("ok");
  }

  // ── Inline query (@bot pizza / @bot menu) ───────────────────────────────
  if (update.inline_query) {
    const iq = update.inline_query;
    const query = iq.query.toLowerCase().trim();
    const isPizza = query === "pizza" || query.startsWith("pizza");
    const text = isPizza ? await formatPizza() : formatMenu();
    const title = isPizza ? "🍕 Pizza nabídka" : "🍽 Dnešní menu";
    await answerInlineQuery(s.telegramBotToken, iq.id, [{
      type: "article",
      id: isPizza ? "pizza" : "menu",
      title,
      description: "Klepni pro zobrazení v chatu",
      input_message_content: { message_text: text, parse_mode: "HTML" },
    }]);
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

  if (cmd === "/start") {
    const { isNew, isAdmin } = registerTelegramUser(chatId, firstName, senderUsername);
    const name = firstName ? `, <b>${firstName}</b>` : "";
    const adminNote = isAdmin && isNew
      ? "\n\n👑 Jsi první registrovaný — máš roli <b>admin</b>. Můžeš ručně odesílat a rušit objednávky přes tlačítka níže."
      : "";
    const welcomeText =
      `👋 Vítej${name}!\n\n` +
      `Jsem bot systému <b>Objednávky LIMA</b> — firemního objednávání obědů.${adminNote}\n\n` +
      `<b>Co ti posílám:</b>\n` +
      `  🔔 Upozornění před uzávěrkou objednávek\n` +
      `  🌅 Ranní jídelníček (pokud si zapneš)\n` +
      `  📬 Potvrzení o odeslání objednávky\n` +
      `  📋 Notifikaci při importu nového jídelníčku\n\n` +
      `Vše ovládáš přes tlačítka dole nebo příkazy jako /menu, /stav apod.`;
    await sendTelegramToChat(chatId, welcomeText, buildMainReplyKeyboard(isAdmin));
    return new Response("ok");
  }

  if (!isTelegramRegistered(chatId)) {
    await sendTelegramToChat(chatId, "Pošli /start pro registraci a přijímání notifikací.");
    return new Response("ok");
  }

  if (effectiveCmd === "/stav") {
    await sendTelegramToChat(chatId, formatStav(), buildStavKeyboard());
  } else if (effectiveCmd === "/souhrn") {
    await sendTelegramToChat(chatId, formatSouhrn(), buildStavKeyboard());
  } else if (effectiveCmd === "/menu" || effectiveCmd.startsWith("/menu ")) {
    const dayArg = effectiveCmd.startsWith("/menu ") ? effectiveCmd.slice(6).trim() : "";
    const dayCode = dayArg ? DAY_INPUT_MAP[dayArg] : null;
    if (dayArg && !dayCode) {
      await sendTelegramToChat(chatId, "⚠️ Neznámý den. Použij zkratku: <code>Po Ut St Ct Pa</code>");
    } else if (dayCode) {
      const jsDay = Object.entries({ 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá" }).find(([, v]) => v === dayCode)?.[0];
      const date = jsDay ? getDateForDay(getPragueNow(), Number(jsDay)) : getPragueNow();
      const dateStr = date.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
      await sendTelegramToChat(chatId, formatMenuForDay(dayCode, dateStr), buildMenuKeyboard());
    } else {
      await sendTelegramToChat(chatId, formatMenu(), buildMenuKeyboard());
    }
  } else if (effectiveCmd === "/tyden") {
    await sendTelegramToChat(chatId, formatTyden());
  } else if (effectiveCmd === "/pizza") {
    await sendTelegramToChat(chatId, await formatPizza(), buildPizzaKeyboard());
  } else if (effectiveCmd === "/zitra") {
    await sendTelegramToChat(chatId, formatZitra(), buildMenuKeyboard());
  } else if (effectiveCmd === "/statistiky") {
    await sendTelegramToChat(chatId, formatStatistiky());
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
      if (!/^\d{1,2}:\d{2}$/.test(time)) {
        await sendTelegramToChat(chatId, "⚠️ Neplatný formát. Použij např. <code>/nastavit cas 08:00</code>");
      } else {
        const [hh, mm] = time.split(":").map(Number);
        if (hh > 23 || mm > 59) {
          await sendTelegramToChat(chatId, "⚠️ Neplatný čas.");
        } else {
          const padded = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
          saveSettings({ autoSendTime: padded });
          await sendTelegramToChat(chatId, `✅ Čas auto-odesílání nastaven na <b>${padded}</b>.`);
        }
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
          await sendTelegramMessage("✅ Objednávka byla odeslána přes Telegram.");
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
        await sendTelegramToSubscribers("notify_order_sent", "🔓 Objednávka byla znovu otevřena — lze ještě upravovat.");
      }
    }
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
      await sendTelegramToChat(chatId, formatChybi());
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
        "/pozvat — QR kód pro přidání kolegy\n" +
        (admin
          ? "/admin — admin příkazy (odeslat, znovu otevřít, kdo chybí)\n" +
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
