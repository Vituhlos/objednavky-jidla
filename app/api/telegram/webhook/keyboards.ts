import { getSettings } from "@/lib/settings";
import { isTelegramAdmin, getTelegramSubscription } from "@/lib/telegram";
import { getDb } from "@/lib/db";
import { getTodayOrderData, orderPdfExists } from "@/lib/orders";
import { getPragueNow } from "@/lib/time";
import { DAY_CODE } from "./messages";

// ─── Inline keyboards ─────────────────────────────────────────────────────────

export const SETTINGS_TEXT = "⚙️ <b>Nastavení notifikací</b>\n\nZapni nebo vypni, co ti má bot posílat:";

export function buildSettingsKeyboard(chatId: string) {
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
      // Připomínky mohou obsahovat citlivé výtky — nabízí se jen adminům
      ...(sub?.isAdmin
        ? [[{ text: `💬 Nové připomínky  ${sub.notifyFeedback ? on : off}`, callback_data: "toggle:feedback" }]]
        : []),
    ],
  };
}

export function buildWelcomeKeyboard() {
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

export function buildStavKeyboard(chatId = "") {
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

export function buildMenuKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "cmd:menu" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
      { text: "➡️ Zítra", callback_data: "cmd:zitra" },
    ]],
  };
}

export function buildPizzaKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "cmd:pizza" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
    ]],
  };
}

export function buildMainReplyKeyboard(isAdmin: boolean) {
  const { telegramAppUrl, pizzaEnabled } = getSettings();
  type KeyboardButton = { text: string } | { text: string; web_app: { url: string } };
  const rows: Array<Array<KeyboardButton>> = [
    [{ text: "📋 Objednávka" }, { text: "📊 Souhrn" }],
    [{ text: "🍽 Menu dnes" },  { text: "📅 Celý týden" }],
  ];
  // Bez pizzy: "Nastavení" zůstane samo na řádku
  rows.push(
    pizzaEnabled !== "false"
      ? [{ text: "🍕 Pizza" }, { text: "⚙️ Nastavení" }]
      : [{ text: "⚙️ Nastavení" }],
  );
  if (telegramAppUrl) {
    rows.push([{ text: "🌐 Otevřít appku", web_app: { url: telegramAppUrl } }]);
  }
  if (isAdmin) {
    rows.push([{ text: "👑 Admin" }, { text: "📄 PDF" }]);
  }
  return { keyboard: rows, resize_keyboard: true };
}

export const REMINDER_TEXT = "⏰ <b>Osobní připomenutí</b>\n\nVyber čas, kdy ti bot každý pracovní den pošle připomenutí uzávěrky:";
export const REMINDER_TIMES = ["09:30", "10:00", "10:30", "11:00", "11:15", "11:30"];

export const CAS_TEXT = "🕐 <b>Čas auto-odesílání</b>\n\nVyber čas, kdy se objednávka každý den automaticky odešle:";
export const CAS_TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"];

export const MORNING_TEXT = "🌅 <b>Osobní čas ranního jídelníčku</b>\n\nVyber čas, kdy ti bot každý pracovní den ráno pošle jídelníček:";
export const MORNING_TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30"];

export function buildCasKeyboard(currentTime: string | null) {
  const rows: object[][] = [];
  for (let i = 0; i < CAS_TIMES.length; i += 3) {
    rows.push(CAS_TIMES.slice(i, i + 3).map((t) => ({
      text: currentTime === t ? `✅ ${t}` : t,
      callback_data: `cas:${t}`,
    })));
  }
  return { inline_keyboard: rows };
}

export function buildReminderKeyboard(currentTime: string | null) {
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

export function buildMorningKeyboard(currentTime: string | null) {
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

export function buildPdfKeyboard() {
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

export function buildPdfHistoryKeyboard(): object {
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

export function buildTydenKeyboard() {
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

export function buildStatisticsKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "cmd:statistiky" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
    ]],
  };
}

export function buildAdminChybiKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🔄 Obnovit", callback_data: "admin:chybi" },
      { text: "← Admin panel", callback_data: "cmd:admin" },
    ]],
  };
}

export function buildDayViewKeyboard() {
  return {
    inline_keyboard: [[
      { text: "← Týden", callback_data: "cmd:tyden" },
      { text: "📋 Objednávka", callback_data: "cmd:stav" },
    ]],
  };
}

export function buildAdminKeyboard() {
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
export const BUTTON_MAP: Record<string, string> = {
  "📋 objednávka":    "/stav",
  "📊 souhrn":        "/souhrn",
  "🍽 menu dnes":     "/menu",
  "📅 celý týden":    "/tyden",
  "🍕 pizza":         "/pizza",
  "⚙️ nastavení":     "/nastaveni",
  "👑 admin":         "/admin",
  "📄 pdf":           "/pdf",
};
