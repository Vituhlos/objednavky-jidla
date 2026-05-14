import { type NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { sendTelegramMessage } from "@/lib/telegram";
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
  const lines: string[] = [];
  if (menu.soups.length > 0) {
    lines.push("<b>Polévky:</b>");
    menu.soups.forEach((s) => lines.push(`  ${s.code ? s.code + " " : ""}${s.name}`));
  }
  if (menu.meals.length > 0) {
    lines.push("<b>Jídla:</b>");
    menu.meals.forEach((m) => lines.push(`  ${m.code ? m.code + " " : ""}${m.name}`));
  }
  return lines.join("\n");
}

function formatStav(): string {
  const data = getTodayOrderData();
  const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
  const statusLabel = data.order.status === "sent" ? "✅ Odesláno" : "📝 Rozepsáno";
  const rows = data.departments.flatMap((d) => d.rows.filter((r) => r.personName));
  const total = data.totalPrice;
  const lines = [`<b>Objednávka ${dateStr}</b>`, `Stav: ${statusLabel}`, `Celkem: ${rows.length} osob · ${total} Kč`, ""];
  data.departments.forEach((dept) => {
    const active = dept.rows.filter((r) => r.personName);
    if (active.length === 0) return;
    lines.push(`<b>${dept.label}</b>`);
    active.forEach((r) => lines.push(`  ${r.personName}${r.mainItem ? " — " + r.mainItem.name : ""}`));
  });
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const s = getSettings();

  let update: { message?: { chat: { id: number }; text?: string } };
  try { update = await req.json(); } catch { return new Response("ok"); }

  const message = update.message;
  if (!message?.text) return new Response("ok");

  const chatId = String(message.chat.id);
  if (chatId !== s.telegramChatId) return new Response("ok");

  const cmd = message.text.split("@")[0].toLowerCase().trim();

  if (cmd === "/stav") {
    await sendTelegramMessage(formatStav());
  } else if (cmd === "/menu") {
    await sendTelegramMessage(formatMenu());
  } else if (cmd === "/odeslat") {
    const data = getTodayOrderData();
    if (data.order.status === "sent") {
      await sendTelegramMessage("⚠️ Objednávka je již odeslána.");
    } else {
      try {
        await sendOrder(data.order.id, "manual");
        broadcast();
        await sendTelegramMessage("✅ Objednávka byla odeslána.");
      } catch (err) {
        await sendTelegramMessage(`❌ Odeslání selhalo: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else if (cmd === "/zrusit") {
    const data = getTodayOrderData();
    if (data.order.status !== "sent") {
      await sendTelegramMessage("⚠️ Objednávka nebyla odeslána — není co rušit.");
    } else {
      reopenOrder(data.order.id);
      broadcast();
      await sendTelegramMessage("🔓 Objednávka byla znovu otevřena.");
    }
  } else if (cmd === "/pomoc" || cmd === "/help") {
    await sendTelegramMessage(
      "<b>Dostupné příkazy:</b>\n" +
      "/stav — přehled dnešní objednávky\n" +
      "/menu — dnešní jídelníček\n" +
      "/odeslat — ruční odeslání objednávky\n" +
      "/zrusit — znovu otevřít odeslanou objednávku"
    );
  }

  return new Response("ok");
}
