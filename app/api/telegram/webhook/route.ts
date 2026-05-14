import { type NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import {
  sendTelegramToChat,
  sendTelegramMessage,
  registerTelegramUser,
  isTelegramAdmin,
  isTelegramRegistered,
} from "@/lib/telegram";
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
  } else if (cmd === "/menu") {
    await sendTelegramToChat(chatId, formatMenu());
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
        "/stav — přehled dnešní objednávky\n" +
        "/menu — dnešní jídelníček\n" +
        (admin
          ? "/odeslat — ruční odeslání objednávky\n/zrusit — znovu otevřít odeslanou objednávku\n"
          : "") +
        "/pomoc — tento seznam",
    );
  }

  return new Response("ok");
}
