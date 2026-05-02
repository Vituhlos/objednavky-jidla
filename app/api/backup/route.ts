import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export function GET() {
  const db = getDb();
  const orders = db.prepare("SELECT * FROM orders ORDER BY date DESC").all();
  const orderRows = db.prepare("SELECT * FROM order_rows").all();
  const menuItems = db.prepare("SELECT * FROM menu_items").all();
  const departments = db.prepare("SELECT * FROM departments ORDER BY sort_order").all();
  const settings = getSettings();

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
