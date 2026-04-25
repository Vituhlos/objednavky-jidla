import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const db = getDb();
  const orders = db.prepare("SELECT * FROM orders ORDER BY date DESC").all();
  const orderRows = db.prepare("SELECT * FROM order_rows").all();
  const menuItems = db.prepare("SELECT * FROM menu_items").all();
  const departments = db.prepare("SELECT * FROM departments WHERE active = 1 ORDER BY sort_order").all();
  const auditLog = db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 5000").all();

  const payload = JSON.stringify(
    { exported_at: new Date().toISOString(), orders, order_rows: orderRows, menu_items: menuItems, departments, audit_log: auditLog },
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
