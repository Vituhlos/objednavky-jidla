import { type NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import {
  sendTelegramToChat,
  sendTelegramMessage,
  registerTelegramUser,
  isTelegramAdmin,
  isTelegramRegistered,
  toggleTelegramReminder,
} from "@/lib/telegram";
import { saveSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { getTodayOrderData, sendOrder, reopenOrder } from "@/lib/orders";
import { getMenuItemsForDay } from "@/lib/menu";
import { broadcast } from "@/lib/sse-broadcast";
import { getPragueNow } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAY_CODE: Record<number, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 0: "Ne" };

function formatMenu(): string {
  const now = getPragueNow();
  const dayCode = DAY_CODE[now.getDay()];
  if (!dayCode || now.getDay() === 0 || now.getDay() === 6) return "Dnes není pracovní den.";
  const menu = getMenuItemsForDay(dayCode);
  if (menu.soups.length === 0 && menu.meals.length === 0) return "Jídelníček pro dnešní den není k dispozici.";
  const dateStr = now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
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

function formatStav(): string {
  const data = getTodayOrderData();
  const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
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
    weekday: "long",
    day: "numeric",
    month: "numeric",
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

function formatZitra(): string {
  const now = getPragueNow();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const jsDay = tomorrow.getDay();
  const dayCode = DAY_CODE[jsDay];
  if (!dayCode || jsDay === 0 || jsDay === 6) return "Zítra není pracovní den.";
  const dateStr = tomorrow.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
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

  const totalSent = db.prepare(`
    SELECT COUNT(*) as cnt FROM orders WHERE status = 'sent'
  `).get() as { cnt: number };

  const lines = [
    `📊 <b>Statistiky</b>`,
    "",
    `<b>Posledních 7 dní</b>`,
    `  Objednávek: ${weekStats.cnt}`,
    "",
  ];

  if (topMeals.length > 0) {
    lines.push("<b>Nejoblíbenější jídla (7 dní)</b>");
    topMeals.forEach((m, i) => lines.push(`  ${i + 1}. ${m.name} (${m.cnt}×)`));
    lines.push("");
  }

  lines.push(`<b>Celkem</b>`);
  lines.push(`  Odeslaných objednávek: ${totalSent.cnt}`);

  return lines.join("\n");
}

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
};

export async function POST(req: NextRequest) {
  const s = getSettings();
  if (s.telegramEnabled !== "true" || !s.telegramBotToken) return new Response("ok");

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  const message = update.message;
  if (!message?.text) return new Response("ok");

  const chatId = String(message.chat.id);
  const firstName = message.from?.first_name ?? "";
  const username = message.from?.username ?? "";
  const cmd = message.text.split("@")[0].toLowerCase().trim();

  if (cmd === "/start") {
    const { isNew, isAdmin } = registerTelegramUser(chatId, firstName, username);
    if (isNew) {
      const adminNote = isAdmin ? " Jsi první — máš roli <b>admin</b> (můžeš odesílat objednávky)." : "";
      await sendTelegramToChat(
        chatId,
        `👋 Vítej${firstName ? `, ${firstName}` : ""}!${adminNote}\n\nBudeš dostávat notifikace o objednávkách.\n\n/pomoc — seznam příkazů`,
      );
    } else {
      await sendTelegramToChat(chatId, "✅ Jsi zaregistrovaný, notifikace ti chodí.\n\n/pomoc — seznam příkazů");
    }
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
  } else if (cmd === "/upozorneni") {
    const enabled = toggleTelegramReminder(chatId);
    const s = getSettings();
    const minutes = parseInt(s.pushReminderMinutes) || 20;
    await sendTelegramToChat(
      chatId,
      enabled
        ? `🔔 Upozornění na uzávěrku <b>zapnuto</b>. Budeš dostávat zprávu ${minutes} minut před uzávěrkou.`
        : `🔕 Upozornění na uzávěrku <b>vypnuto</b>.`,
    );
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
        (admin
          ? "/odeslat — ruční odeslání objednávky\n/zrusit — znovu otevřít odeslanou objednávku\n"
          : "") +
        "/pomoc — tento seznam",
    );
  }

  return new Response("ok");
}
