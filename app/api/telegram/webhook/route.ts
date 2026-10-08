import { type NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import {
  sendTelegramToChat,
  sendTelegramMessage,
  sendTelegramToAdmins,
  sendTelegramToSubscribers,
  registerTelegramUser,
  isTelegramAdmin,
  isTelegramRegistered,
  getTelegramSubscription,
  toggleNotifySetting,
  setPersonalReminderTime,
  setPersonalMorningMenuTime,
  escapeHtml,
} from "@/lib/telegram";
import { getDb } from "@/lib/db";
import { formatOrderTotals } from "@/lib/order-summary";
import {
  getTodayOrderData,
  sendOrder,
  reopenOrderAndUnlock,
  getOrderPdfPath,
  orderPdfExists,
} from "@/lib/orders";
import { getMondayISO } from "@/lib/menu";
import fs from "fs";
import path from "path";
import { broadcast } from "@/lib/sse-broadcast";
import { getPragueNow } from "@/lib/time";
import {
  DAY_INPUT_MAP,
  formatMenuForDay,
  formatMenu,
  formatZitra,
  formatStav,
  formatSouhrn,
  getDateForDay,
  formatPizza,
  formatStatistiky,
  formatChybi,
} from "./messages";
import {
  SETTINGS_TEXT,
  buildSettingsKeyboard,
  buildStavKeyboard,
  buildMenuKeyboard,
  buildPizzaKeyboard,
  buildMainReplyKeyboard,
  REMINDER_TEXT,
  CAS_TEXT,
  MORNING_TEXT,
  buildCasKeyboard,
  buildReminderKeyboard,
  buildMorningKeyboard,
  buildPdfKeyboard,
  buildPdfHistoryKeyboard,
  buildTydenKeyboard,
  buildStatisticsKeyboard,
  buildAdminChybiKeyboard,
  buildDayViewKeyboard,
  buildAdminKeyboard,
  BUTTON_MAP,
} from "./keyboards";
import {
  sendTyping,
  editMessageText,
  answerCallbackQuery,
  editMessageReplyMarkup,
  sendPhotoToChat,
  answerInlineQuery,
  sendDocument,
  getBotUsername,
} from "./telegram-api";

export const dynamic = "force-dynamic";

// In-memory state for force_reply custom time inputs (chatId → pending action)
// chatId → pending action. Expires so a reply typed hours later isn't swallowed
// as an invalid time; the map is in-memory and resets with the container anyway.
const PENDING_TTL_MS = 10 * 60 * 1000;
const pendingActions = new Map<string, { action: "reminder" | "morning"; at: number }>();


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

  // This endpoint is reachable from the internet — without the shared secret anyone
  // who knows the URL could drive the bot (including sending the order). The secret is
  // generated when the webhook is registered; if it isn't set yet, refuse rather than
  // run unauthenticated. Re-register the webhook in Nastavení to create it.
  if (s.telegramWebhookSecret) {
    if (req.headers.get("x-telegram-bot-api-secret-token") !== s.telegramWebhookSecret) {
      console.warn("[telegram] Odmítnut požadavek na webhook – neplatný secret token.");
      return new Response("forbidden", { status: 403 });
    }
  } else {
    console.warn("[telegram] Webhook běží BEZ ověření – přeregistrujte webhook v Nastavení.");
  }

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
        "toggle:feedback": "notify_feedback",
      };
      // callback_data posílá klient, takže ho lze podvrhnout i bez tlačítka
      const col = data === "toggle:feedback" && !isTelegramAdmin(chatId) ? undefined : colMap[data];
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
      if (data === "cmd:pizza") {
        if (s.pizzaEnabled === "false") {
          await editMessageText(s.telegramBotToken, chatId, messageId, "🍕 Modul Pizza je vypnutý.", { inline_keyboard: [[{ text: "✖ Zavřít", callback_data: "close" }]] });
        } else {
          await sendTyping(s.telegramBotToken, chatId);
          await editMessageText(s.telegramBotToken, chatId, messageId, await formatPizza(), buildPizzaKeyboard());
        }
      }
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
        pendingActions.set(chatId, { action: "reminder", at: Date.now() });
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
        pendingActions.set(chatId, { action: "morning", at: Date.now() });
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
          await sendTelegramToChat(chatId, "⚠️ PDF objednávky neexistuje – objednávka ještě nebyla odeslána.");
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
            await sendTelegramToSubscribers("notify_order_sent", `✅ <b>Objednávka odeslána</b>\n📅 ${dateStr}\n${formatOrderTotals(orderData)}`);
          } catch (err) {
            await sendTelegramToChat(chatId, `❌ Odeslání selhalo: ${escapeHtml(err instanceof Error ? err.message : String(err))}`);
          }
        }
      }
      if (data === "admin:zrusit") {
        const orderData = getTodayOrderData();
        if (orderData.order.status !== "sent") {
          await sendTelegramToChat(chatId, "⚠️ Objednávka nebyla odeslána – není co rušit.");
        } else {
          reopenOrderAndUnlock(orderData.order.id);
          broadcast();
          if (messageId) await editMessageText(s.telegramBotToken, chatId, messageId, "🔓 <b>Objednávka znovu otevřena.</b>", buildStavKeyboard(chatId));
          await sendTelegramToAdmins("🔓 Objednávka byla znovu otevřena – lze ještě upravovat.");
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
    // Inline queries arrive from ANY chat, so this is the only gate — without it
    // anyone who knows the bot's @username could read the whole company order.
    if (!isTelegramRegistered(String(iq.from.id))) {
      await answerInlineQuery(s.telegramBotToken, iq.id, [{
        type: "article",
        id: "unregistered",
        title: "Nejdřív se zaregistruj",
        description: "Napiš botovi /start",
        input_message_content: { message_text: "Bota Objednávky LIMA je potřeba nejdřív spustit příkazem /start." },
      }]);
      return new Response("ok");
    }
    const query = iq.query.toLowerCase().trim();
    const show = (key: string) => !query || key.startsWith(query) || query.includes(key);
    const results: object[] = [];
    const add = (id: string, title: string, text: string, description: string) =>
      results.push({ type: "article", id, title, description, input_message_content: { message_text: text, parse_mode: "HTML" } });
    if (show("menu")) add("menu", "🍽 Dnešní jídelníček", formatMenu(), "Jídelníček pro dnešní den");
    if (s.pizzaEnabled !== "false" && show("pizza")) add("pizza", "🍕 Pizza", await formatPizza(), "Aktuální nabídka pizzerie");
    if (show("stav")) add("stav", "📋 Stav objednávky", formatStav(), "Aktuální stav objednávky LIMA");
    if (show("souhrn")) add("souhrn", "📊 Souhrn", formatSouhrn(), "Kompaktní přehled objednávky");
    if (results.length === 0) add("menu", "🍽 Dnešní jídelníček", formatMenu(), "Jídelníček pro dnešní den");
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
  const pendingEntry = pendingActions.get(chatId);
  if (pendingEntry && Date.now() - pendingEntry.at > PENDING_TTL_MS) pendingActions.delete(chatId);
  const pendingAction = pendingActions.get(chatId)?.action;
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
    await sendTelegramToChat(chatId, `⚠️ Neplatný formát – napiš čas jako <code>HH:MM</code> (např. <code>11:45</code>).`, keyboard);
    return new Response("ok");
  }
  if (pendingAction && cmd.startsWith("/")) pendingActions.delete(chatId);

  if (cmd === "/start") {
    const { isNew, isAdmin } = registerTelegramUser(chatId, firstName, senderUsername);
    if (!isNew) {
      await sendTelegramToChat(
        chatId,
        `👋 Vítej zpět! Tady jsou tvé možnosti:`,
        buildMainReplyKeyboard(isAdmin),
      );
      return new Response("ok");
    }
    const adminNote = isAdmin
      ? "\n\n👑 Registrace proběhla jako první, takže máš roli <b>admin</b>. Můžeš ručně odesílat a rušit objednávky přímo z bota."
      : "";
    const welcomeText =
      `👋 Vítej!\n\n` +
      `Jsem bot systému <b>Objednávky LIMA</b> – firemního objednávání obědů.${adminNote}\n\n` +
      `<b>Co ti bot nabídne:</b>\n` +
      `  🍽 Jídelníček, objednávka a pizza kdykoliv\n` +
      `  🔔 Připomenutí před uzávěrkou (volitelné)\n` +
      `  🌅 Ranní jídelníček (volitelné)\n` +
      `  📋 Upozornění na nový jídelníček (volitelné)\n\n` +
      `Uprav si notifikace přes <b>⚙️ Nastavení</b> nebo /nastaveni.`;
    await sendTelegramToChat(chatId, welcomeText, buildMainReplyKeyboard(isAdmin));
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
      await sendTelegramToChat(chatId, "⚠️ Neznámý den – vyber ze seznamu:", buildTydenKeyboard());
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
    if (s.pizzaEnabled === "false") {
      await sendTelegramToChat(chatId, "🍕 Modul Pizza je vypnutý.");
    } else {
      await sendTyping(s.telegramBotToken, chatId);
      await sendTelegramToChat(chatId, await formatPizza(), buildPizzaKeyboard());
    }
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
        `📲 <b>Přidej kolegu k Objednávkám LIMA</b>\n\nNech naskenovat QR kód, nebo pošli odkaz:\n${botUrl}`,
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
          await sendTelegramToSubscribers("notify_order_sent", `✅ <b>Objednávka odeslána</b>\n📅 ${ds}\n${formatOrderTotals(data)}`);
          // The admin who ran the command may have order notifications switched off
          await sendTelegramToChat(chatId, "✅ <b>Objednávka byla odeslána.</b>");
        } catch (err) {
          await sendTelegramToChat(
            chatId,
            `❌ Odeslání selhalo: ${escapeHtml(err instanceof Error ? err.message : String(err))}`,
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
        await sendTelegramToChat(chatId, "⚠️ Objednávka nebyla odeslána – není co rušit.");
      } else {
        reopenOrderAndUnlock(data.order.id);
        broadcast();
        await sendTelegramToAdmins("🔓 Objednávka byla znovu otevřena – lze ještě upravovat.");
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
        "/stav – podrobný přehled objednávky\n" +
        "/souhrn – kompaktní tabulka (jméno + kód jídla)\n" +
        "/menu – dnešní jídelníček\n" +
        "/menu Po|Út|St|Čt|Pá – jídelníček pro konkrétní den\n" +
        "/tyden – jídelníček na celý týden\n" +
        "/zitra – jídelníček na zítřek\n" +
        (s.pizzaEnabled !== "false" ? "/pizza – aktuální nabídka pizzerie\n" : "") +
        "/statistiky – statistiky posledních 7 dní\n" +
        "/nastaveni – nastavení notifikací\n" +
        "/nastavit reminder HH:MM – osobní připomenutí (např. 11:00)\n" +
        "/zrusit reminder – zrušit osobní připomenutí\n" +
        "/pozvat – QR kód pro přidání kolegy\n" +
        (admin
          ? "/pdf – stáhnout PDF objednávky nebo jídelníčku\n" +
            "/admin – admin příkazy (odeslat, znovu otevřít, kdo chybí)\n" +
            "/zprava [text] – rozeslat zprávu všem uživatelům\n" +
            "/chybi – kdo ještě dnes neobjednal\n" +
            "/odeslat – ruční odeslání objednávky\n" +
            "/zrusit – znovu otevřít odeslanou objednávku\n" +
            "/nastavit cas HH:MM – změnit čas auto-odesílání\n"
          : "") +
        "/pomoc – tento seznam",
    );
  }

  return new Response("ok");
}
