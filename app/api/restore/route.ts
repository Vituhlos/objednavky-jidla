import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireSettingsPin } from "@/lib/api-auth";
import { FEEDBACK_CATEGORIES, FEEDBACK_LIMITS, FEEDBACK_STATUSES } from "@/lib/feedback-meta";

const FEEDBACK_CATEGORY_IDS = new Set<string>(FEEDBACK_CATEGORIES.map((c) => c.id));
const FEEDBACK_STATUS_IDS = new Set<string>(FEEDBACK_STATUSES.map((st) => st.id));

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

interface BackupFile {
  orders?: Row[];
  order_rows?: Row[];
  menu_items?: Row[];
  departments?: Row[];
  feedback?: Row[];
  feedback_votes?: Row[];
  settings?: Record<string, string>;
}

export interface RestoreResult {
  orders: number;
  orderRows: number;
  menuWeeks: number;
  departments: number;
  feedback: number;
  feedbackVotes: number;
  settings: number;
}

const SETTINGS_KEY_MAP: Record<string, string> = {
  smtpHost: "smtp_host", smtpPort: "smtp_port", smtpUser: "smtp_user", smtpPass: "smtp_pass",
  smtpFrom: "smtp_from", smtpReplyTo: "smtp_reply_to", smtpSecure: "smtp_secure",
  orderEmailTo: "order_email_to", orderExtraEmail: "order_extra_email",
  cutoffTime: "cutoff_time", settingsPin: "settings_pin",
  defaultSoupPrice: "default_soup_price", defaultMealPrice: "default_meal_price",
  priceRoll: "price_roll", priceBreadDumpling: "price_bread_dumpling",
  pricePotatoDumpling: "price_potato_dumpling", priceKetchup: "price_ketchup",
  priceTatarka: "price_tatarka", priceBbq: "price_bbq",
  autoSendEnabled: "auto_send_enabled", autoSendTime: "auto_send_time",
  autoSendDays: "auto_send_days", autoSendMinOrders: "auto_send_min_orders",
};

function remapId(oldId: number | null | undefined, map: Map<number, number>): number | null {
  if (oldId == null) return null;
  return map.get(oldId) ?? null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = requireSettingsPin(req);
  if (denied) return denied;

  try {
    const { backup, restoreSettings } = await req.json() as { backup: BackupFile; restoreSettings: boolean };
    const db = getDb();
    const result: RestoreResult = { orders: 0, orderRows: 0, menuWeeks: 0, departments: 0, feedback: 0, feedbackVotes: 0, settings: 0 };

    db.transaction(() => {
      // Menu items — by week_start; skip weeks already present
      const existingWeeks = new Set(
        (db.prepare("SELECT DISTINCT week_start FROM menu_items WHERE week_start IS NOT NULL").all() as Row[])
          .map((r) => r.week_start as string)
      );
      const menuIdMap = new Map<number, number>();
      const addedWeeks = new Set<string>();

      for (const item of backup.menu_items ?? []) {
        const ws = item.week_start as string | null;
        if (!ws || existingWeeks.has(ws)) continue;
        const r = db.prepare(
          "INSERT INTO menu_items (week_label, day, type, code, name, price, week_start) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(item.week_label ?? null, item.day, item.type, item.code, item.name, item.price ?? 0, ws);
        menuIdMap.set(item.id as number, r.lastInsertRowid as number);
        if (!addedWeeks.has(ws)) { addedWeeks.add(ws); result.menuWeeks++; }
      }

      // Orders — by date; skip dates already present
      const orderIdMap = new Map<number, number>();
      for (const order of backup.orders ?? []) {
        const existing = db.prepare("SELECT id FROM orders WHERE date = ?").get(order.date as string) as Row | undefined;
        if (existing) continue;
        const r = db.prepare(
          "INSERT INTO orders (date, status, extra_email, sent_at) VALUES (?, ?, ?, ?)"
        ).run(order.date, order.status ?? "draft", order.extra_email ?? null, order.sent_at ?? null);
        orderIdMap.set(order.id as number, r.lastInsertRowid as number);
        result.orders++;
      }

      // Order rows — only for orders that were just restored
      for (const row of backup.order_rows ?? []) {
        const newOrderId = orderIdMap.get(row.order_id as number);
        if (newOrderId === undefined) continue;

        let extraMeals = "[]";
        try {
          const parsed = JSON.parse((row.extra_meals as string) || "[]") as Array<{ itemId: number; count: number }>;
          extraMeals = JSON.stringify(
            parsed.map((em) => ({ ...em, itemId: menuIdMap.get(em.itemId) ?? em.itemId }))
          );
        } catch { /* keep default */ }

        db.prepare(`
          INSERT INTO order_rows
            (order_id, department, sort_order, person_name, soup_item_id, main_item_id,
             roll_count, bread_dumpling_count, potato_dumpling_count, ketchup_count,
             tatarka_count, bbq_count, note, meal_count, main_item_id_2, meal_count_2,
             soup_item_id_2, extra_meals)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newOrderId,
          row.department ?? "",
          row.sort_order ?? 0,
          row.person_name ?? "",
          remapId(row.soup_item_id as number | null, menuIdMap),
          remapId(row.main_item_id as number | null, menuIdMap),
          row.roll_count ?? 0,
          row.bread_dumpling_count ?? 0,
          row.potato_dumpling_count ?? 0,
          row.ketchup_count ?? 0,
          row.tatarka_count ?? 0,
          row.bbq_count ?? 0,
          row.note ?? "",
          row.meal_count ?? 1,
          remapId(row.main_item_id_2 as number | null, menuIdMap),
          row.meal_count_2 ?? 1,
          remapId(row.soup_item_id_2 as number | null, menuIdMap),
          extraMeals
        );
        result.orderRows++;
      }

      // Departments — by name; skip names already present
      for (const dept of backup.departments ?? []) {
        const existing = db.prepare("SELECT id FROM departments WHERE name = ?").get(dept.name as string);
        if (existing) continue;
        db.prepare(
          "INSERT INTO departments (name, label, email_label, accent, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(dept.name, dept.label, dept.email_label, dept.accent ?? "blue", dept.sort_order ?? 0, dept.active ?? 1);
        result.departments++;
      }

      // Feedback — skip entries already present (same time + text). Obnovuje se
      // i skrytí, „Co chystáme“ a číslo úkolu: skrytá připomínka se po obnově
      // nesmí znovu objevit na veřejné nástěnce.
      const feedbackIds = new Map<number, number>();
      const flag = (v: unknown) => (v === 1 || v === true ? 1 : 0);
      const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
      for (const fb of backup.feedback ?? []) {
        if (typeof fb.message !== "string" || typeof fb.created_at !== "string") continue;
        const oldId = Number(fb.id);
        const existing = db.prepare("SELECT id FROM feedback WHERE created_at = ? AND message = ?").get(fb.created_at, fb.message) as { id: number } | undefined;
        if (existing) {
          if (Number.isInteger(oldId)) feedbackIds.set(oldId, existing.id);
          continue;
        }
        const issue = Number(fb.github_issue);
        const r = db.prepare(
          `INSERT INTO feedback (created_at, category, message, author_name, page, device, status, admin_note, public_reply, resolved_at,
             secret_hash, context, app_version, status_changed_at, votable, vote_title, hidden, is_proposal, github_issue, github_issue_state)
           VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          fb.created_at,
          FEEDBACK_CATEGORY_IDS.has(String(fb.category)) ? String(fb.category) : "jine",
          fb.message,
          String(fb.page ?? ""), String(fb.device ?? ""),
          FEEDBACK_STATUS_IDS.has(String(fb.status)) ? String(fb.status) : "new",
          String(fb.admin_note ?? ""), String(fb.public_reply ?? ""),
          typeof fb.resolved_at === "string" ? fb.resolved_at : null,
          typeof fb.secret_hash === "string" && /^[0-9a-f]{64}$/.test(fb.secret_hash) ? fb.secret_hash : "",
          text(fb.context, 300), text(fb.app_version, 40),
          typeof fb.status_changed_at === "string" ? fb.status_changed_at : null,
          flag(fb.votable), text(fb.vote_title, FEEDBACK_LIMITS.voteTitleMax),
          flag(fb.hidden), flag(fb.is_proposal),
          Number.isInteger(issue) && issue > 0 ? issue : null,
          fb.github_issue_state === "open" || fb.github_issue_state === "closed" ? fb.github_issue_state : "",
        );
        if (Number.isInteger(oldId)) feedbackIds.set(oldId, Number(r.lastInsertRowid));
        result.feedback++;
      }

      // Hlasy — jen k připomínkám ze zálohy; stejný hlas dvakrát se nezapíše
      for (const v of backup.feedback_votes ?? []) {
        const feedbackId = feedbackIds.get(Number(v.feedback_id));
        if (!feedbackId || typeof v.voter_hash !== "string" || !/^[0-9a-f]{64}$/.test(v.voter_hash)) continue;
        const r = db.prepare(
          "INSERT OR IGNORE INTO feedback_votes (feedback_id, voter_hash, value, created_at) VALUES (?, ?, ?, COALESCE(?, datetime('now')))"
        ).run(feedbackId, v.voter_hash, v.value === -1 ? -1 : 1, typeof v.created_at === "string" ? v.created_at : null);
        result.feedbackVotes += r.changes;
      }

      // Settings — only keys not already set in DB (INSERT OR IGNORE)
      if (restoreSettings && backup.settings) {
        for (const [field, value] of Object.entries(backup.settings)) {
          const dbKey = SETTINGS_KEY_MAP[field];
          if (!dbKey) continue;
          const r = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(dbKey, value as string);
          if ((r.changes as number) > 0) result.settings++;
        }
      }
    })();

    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
