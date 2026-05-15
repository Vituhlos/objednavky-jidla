import { getTenantDb } from "@/lib/tenant-db";
import { getSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireTenantAdmin } from "@/lib/tenant-auth";
import { setTenantSlug } from "@/lib/tenant-context";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SENSITIVE_KEYS = new Set(["smtpPass", "imapPass", "settingsPin", "vapidPrivateKey"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  setTenantSlug(tenantSlug);

  try {
    await requireTenantAdmin(tenantSlug);
  } catch {
    return new Response("Nemáte oprávnění.", { status: 403 });
  }

  const db = getTenantDb(tenantSlug);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRateLimit(`backup:${ip}`, 5, 3600_000, db)) {
    return new Response("Příliš mnoho požadavků. Zkuste to za hodinu.", { status: 429 });
  }

  const orders = db.prepare("SELECT * FROM orders ORDER BY date DESC").all();
  const orderRows = db.prepare("SELECT * FROM order_rows").all();
  const menuItems = db.prepare("SELECT * FROM menu_items").all();
  const departments = db.prepare("SELECT * FROM departments ORDER BY sort_order").all();
  const allSettings = getSettings();
  const settings = Object.fromEntries(
    Object.entries(allSettings).filter(([k]) => !SENSITIVE_KEYS.has(k))
  );

  const payload = JSON.stringify(
    { exported_at: new Date().toISOString(), tenant: tenantSlug, orders, order_rows: orderRows, menu_items: menuItems, departments, settings },
    null,
    2
  );

  const date = new Date().toISOString().slice(0, 10);
  return new Response(payload, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="zaloha-${tenantSlug}-${date}.json"`,
    },
  });
}
