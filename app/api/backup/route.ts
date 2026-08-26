import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, requireSettingsPin } from "@/lib/api-auth";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Cokoli, čím se dá někam přihlásit nebo se za appku vydávat. Token bota
// a webhookový secret tu dřív chyběly — se získaným tokenem jde bota převzít.
const SENSITIVE_KEYS = new Set([
  "smtpPass",
  "imapPass",
  "settingsPin",
  "vapidPrivateKey",
  "telegramBotToken",
  "googleClientSecret",
  "telegramWebhookSecret",
]);

export function GET(req: NextRequest) {
  const denied = requireSettingsPin(req);
  if (denied) return denied;

  const ip = getClientIp(req);
  if (!checkRateLimit(`backup:${ip}`, 5, 3600_000)) {
    return new Response("Příliš mnoho požadavků. Zkuste to za hodinu.", { status: 429 });
  }

  const db = getDb();
  const orders = db.prepare("SELECT * FROM orders ORDER BY date DESC").all();
  const orderRows = db.prepare("SELECT * FROM order_rows").all();
  const menuItems = db.prepare("SELECT * FROM menu_items").all();
  const departments = db.prepare("SELECT * FROM departments ORDER BY sort_order").all();
  const allSettings = getSettings();
  const settings = Object.fromEntries(
    Object.entries(allSettings).filter(([k]) => !SENSITIVE_KEYS.has(k))
  );

  const payload = JSON.stringify(
    { exported_at: new Date().toISOString(), orders, order_rows: orderRows, menu_items: menuItems, departments, settings },
    null,
    2
  );

  const date = new Date().toISOString().slice(0, 10);
  return new Response(payload, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="objednavky-zaloha-${date}.json"`,
    },
  });
}
