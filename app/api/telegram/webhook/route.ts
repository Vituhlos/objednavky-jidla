import { type NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import {
  sendTelegramToChat,
  sendTelegramMessage,
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

export const dynamic = "force-dynamic";

const DAY_CODE: Record<number, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 0: "Ne" };

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatMenuForDay(dayCode: string, dateStr: string): string {
  const menu = getMenuItemsForDay(dayCode);
  if (menu.soups.length === 0 && menu.meals.length === 0)
    return `🍽 <b>Jídelníček ${dateStr}</b>\n\nJídelníček zatím není k dispozici.`;
  const lines: string[] = [`🍽 <b>Jídelníček ${dateStr}</b>`, ""];
  if (menu.soups.length > 0) {
    lines.push("<b>Polévky</b>");
    menu.soups.forEach((s) => lines.push(`  • ${s.name}`));
    lines.push("");
  }
  if (menu.meals.length > 0) {
    lines.push("<b>Jídla</b>");
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
  const statusIcon = data.order.status === "sent" ? "✅" : "📝";
  const statusLabel = data.order.status === "sent" ? "Odesláno" : "Rozepsáno";
  const totalRows = data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length;
  const lines: string[] = [
    `📋 <b>Objednávka ${dateStr}</b>`,
    `${statusIcon} ${statusLabel}  ·  👥 ${totalRows} osob  ·  💰 ${data.totalPrice} Kč`,
  ];
  data.departments.forEach((dept) => {
    const active = dept.rows.filter((r) => r.personName);
    if (active.length === 0) return;
    lines.push("");
    lines.push(`<b>${dept.label}</b>`);
    active.forEach((r) => {
      const meal = r.mainItem ? `\n    <i>${r.mainItem.name}</i>` : "";
      lines.push(`  • ${r.personName}${meal}`);
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
    if (data === "cmd:stav") await sendTelegramToChat(chatId, formatStav());
    if (data === "cmd:menu") await sendTelegramToChat(chatId, formatMenu());
    if (data === "cmd:nastaveni") await sendTelegramToChat(chatId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));

    return new Response("ok");
  }

  // ── Regular message ──────────────────────────────────────────────────────
  const message = update.message;
  if (!message?.text) return new Response("ok");

  const chatId = String(message.chat.id);
  const firstName = message.from?.first_name ?? "";
  const senderUsername = message.from?.username ?? "";
  const cmd = message.text.split("@")[0].toLowerCase().trim();

  if (cmd === "/start") {
    const { isNew, isAdmin } = registerTelegramUser(chatId, firstName, senderUsername);
    const name = firstName ? `, <b>${firstName}</b>` : "";
    const adminNote = isAdmin && isNew
      ? "\n\n👑 Jsi první registrovaný — máš roli <b>admin</b>. Můžeš ručně odesílat a rušit objednávky příkazem /odeslat a /zrusit."
      : "";
    const welcomeText =
      `👋 Vítej${name}!\n\n` +
      `Jsem bot systému <b>Objednávky LIMA</b> — firemního objednávání obědů.${adminNote}\n\n` +
      `<b>Co ti posílám:</b>\n` +
      `  🔔 Upozornění před uzávěrkou objednávek\n` +
      `  🌅 Ranní jídelníček (pokud si zapneš)\n` +
      `  📬 Potvrzení o odeslání objednávky\n` +
      `  📋 Notifikaci při importu nového jídelníčku\n\n` +
      `Co a kdy ti chodí si nastavíš přes /nastaveni nebo níže.`;
    await sendTelegramToChat(chatId, welcomeText, buildWelcomeKeyboard());
    return new Response("ok");
  }

  if (!isTelegramRegistered(chatId)) {
    await sendTelegramToChat(chatId, "Pošli /start pro registraci a přijímání notifikací.");
    return new Response("ok");
  }

  if (cmd === "/stav") {
    await sendTelegramToChat(chatId, formatStav());
  } else if (cmd === "/souhrn") {
    await sendTelegramToChat(chatId, formatSouhrn());
  } else if (cmd === "/menu") {
    await sendTelegramToChat(chatId, formatMenu());
  } else if (cmd === "/zitra") {
    await sendTelegramToChat(chatId, formatZitra());
  } else if (cmd === "/statistiky") {
    await sendTelegramToChat(chatId, formatStatistiky());
  } else if (cmd === "/nastaveni") {
    await sendTelegramToChat(chatId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));
  } else if (cmd === "/upozorneni") {
    // Legacy alias
    await sendTelegramToChat(chatId, SETTINGS_TEXT, buildSettingsKeyboard(chatId));
  } else if (cmd === "/pozvat") {
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
  } else if (cmd.startsWith("/nastavit cas ")) {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      const time = cmd.replace("/nastavit cas ", "").trim();
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
  } else if (cmd === "/odeslat") {
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
  } else if (cmd === "/zrusit") {
    if (!isTelegramAdmin(chatId)) {
      await sendTelegramToChat(chatId, "⛔ Tento příkaz může použít pouze admin.");
    } else {
      const data = getTodayOrderData();
      if (data.order.status !== "sent") {
        await sendTelegramToChat(chatId, "⚠️ Objednávka nebyla odeslána — není co rušit.");
      } else {
        reopenOrder(data.order.id);
        broadcast();
        await sendTelegramMessage("🔓 Objednávka byla znovu otevřena přes Telegram.");
      }
    }
  } else if (cmd === "/pomoc" || cmd === "/help") {
    const admin = isTelegramAdmin(chatId);
    await sendTelegramToChat(
      chatId,
      "<b>Dostupné příkazy:</b>\n" +
        "/stav — podrobný přehled objednávky\n" +
        "/souhrn — kompaktní tabulka (jméno + kód jídla)\n" +
        "/menu — dnešní jídelníček\n" +
        "/zitra — jídelníček na zítřek\n" +
        "/statistiky — statistiky posledních 7 dní\n" +
        "/nastaveni — nastavení notifikací\n" +
        "/pozvat — QR kód pro přidání kolegy\n" +
        (admin
          ? "/odeslat — ruční odeslání objednávky\n" +
            "/zrusit — znovu otevřít odeslanou objednávku\n" +
            "/nastavit cas HH:MM — změnit čas auto-odesílání\n"
          : "") +
        "/pomoc — tento seznam",
    );
  }

  return new Response("ok");
}
