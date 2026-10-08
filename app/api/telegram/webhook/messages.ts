import { escapeHtml } from "@/lib/telegram";
import { getDb } from "@/lib/db";
import { formatOrderTotals, describeRowItems, describeRowCodes } from "@/lib/order-summary";
import { getTodayOrderData } from "@/lib/orders";
import { getMenuItemsForDay, getMondayISO } from "@/lib/menu";
import { getClosureForDate } from "@/lib/closures";
import { getPragueNow } from "@/lib/time";
import { scrapePizzaMenu } from "@/lib/pizza-scraper";

// Texty odpovědí bota: jídelníček, stav objednávky, souhrn, statistiky.

export const DAY_CODE: Record<number, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá", 6: "So", 0: "Ne" };

// Normalised user input → DB day code (handles diacritics variants)
export const DAY_INPUT_MAP: Record<string, string> = {
  po: "Po", pondeli: "Po", "pondělí": "Po",
  ut: "Út", "út": "Út", utery: "Út", "úterý": "Út",
  st: "St", streda: "St", "středa": "St",
  ct: "Čt", "čt": "Čt", ctvrtek: "Čt", "čtvrtek": "Čt",
  pa: "Pá", "pá": "Pá", patek: "Pá", "pátek": "Pá",
};

// ISO date of a weekday code within the current Prague week, for closure lookups
export function isoForDayCode(dayCode: string): string | null {
  const offsets: Record<string, number> = { Po: 0, "Út": 1, St: 2, "Čt": 3, "Pá": 4 };
  const offset = offsets[dayCode];
  if (offset === undefined) return null;
  const [y, m, d] = getMondayISO().split("-").map(Number);
  const date = new Date(y, m - 1, d + offset, 12, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function closureForDay(dayCode: string): { label: string; icon: string } | null {
  const iso = isoForDayCode(dayCode);
  if (!iso) return null;
  const closure = getClosureForDate(iso);
  return closure ? { label: closure.label || "dovolená", icon: closure.icon } : null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatMenuForDay(dayCode: string, dateStr: string): string {
  const menu = getMenuItemsForDay(dayCode);
  // A closed day comes back as a single synthetic "Zavřeno" item — printing it as a
  // dish (and promising a cutoff) is nonsense, so say what actually happens.
  const closure = closureForDay(dayCode);
  if (closure) {
    return `${closure.icon} <b>${dateStr}</b>\n\nV LIMĚ se dnes nevaří – ${escapeHtml(closure.label)}.`;
  }
  if (menu.soups.length === 0 && menu.meals.length === 0)
    return `🍽 <b>Jídelníček ${dateStr}</b>\n\nJídelníček zatím není k dispozici.`;
  const lines: string[] = [`🍽 <b>Jídelníček ${dateStr}</b>`];
  if (menu.soups.length > 0) {
    lines.push("");
    lines.push("<b>🍲 Polévky</b>");
    menu.soups.forEach((s) => lines.push(`  • ${escapeHtml(s.name)}`));
  }
  if (menu.meals.length > 0) {
    lines.push("");
    lines.push("<b>🍽 Hlavní jídla</b>");
    menu.meals.forEach((m) => lines.push(`  • ${escapeHtml(m.name)}`));
  }
  return lines.join("\n");
}

export function formatMenu(): string {
  const now = getPragueNow();
  const dayCode = DAY_CODE[now.getDay()];
  if (!dayCode || now.getDay() === 0 || now.getDay() === 6) return "Dnes není pracovní den.";
  const dateStr = now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
  return formatMenuForDay(dayCode, dateStr);
}

export function formatZitra(): string {
  const now = getPragueNow();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const jsDay = tomorrow.getDay();
  const dayCode = DAY_CODE[jsDay];
  if (!dayCode || jsDay === 0 || jsDay === 6) return "Zítra není pracovní den.";
  const dateStr = tomorrow.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
  return formatMenuForDay(dayCode, dateStr);
}

export function formatStav(): string {
  const data = getTodayOrderData();
  const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "numeric",
  });
  const sent = data.order.status === "sent";
  const totalPeople = data.departments.flatMap((d) => d.rows.filter((r) => r.personName)).length;
  const statusLine = `${sent ? "✅ <b>Odesláno</b>" : "📝 <b>Rozepsáno</b>"}  ·  ${formatOrderTotals(data)}`;
  const lines: string[] = [`📋 <b>Objednávka ${dateStr}</b>`, statusLine];
  if (totalPeople === 0) {
    lines.push("", "<i>Zatím nikdo neobjednal.</i>");
  } else {
    data.departments.forEach((dept) => {
      const active = dept.rows.filter((r) => r.personName);
      if (active.length === 0) return;
      lines.push("");
      lines.push(`<b>📂 ${escapeHtml(dept.label)}</b>`);
      active.forEach((r) => {
        const parts = describeRowItems(r);
        const detail = parts.length > 0 ? `  –  ${parts.join("  +  ")}` : "";
        lines.push(`  • <b>${escapeHtml(r.personName)}</b>${detail}`);
      });
    });
  }
  return lines.join("\n");
}

export function formatSouhrn(): string {
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
      return `${name}  ${describeRowCodes(r)}`;
    });
    blocks.push(`${escapeHtml(dept.label)}\n${escapeHtml(rows.join("\n"))}`);
  });
  return (
    `📊 <b>Souhrn ${dateStr}</b>\n` +
    `${statusIcon} ${statusLabel}  ·  ${formatOrderTotals(data)}\n\n` +
    `<pre>${blocks.join("\n\n")}</pre>`
  );
}

// Returns the date of a given JS weekday (1=Mon…5=Fri) within the current Prague week
export function getDateForDay(now: Date, targetJsDay: number): Date {
  const currentJsDay = now.getDay();
  const mondayOffset = currentJsDay === 0 ? -6 : 1 - currentJsDay;
  const d = new Date(now);
  d.setDate(d.getDate() + mondayOffset + (targetJsDay - 1));
  return d;
}

export async function formatPizza(): Promise<string> {
  try {
    const items = await scrapePizzaMenu();
    if (items.length === 0) return "🍕 <b>Pizza Dublovice</b>\n\nNabídka není momentálně k dispozici.";
    const nameWidth = Math.min(32, Math.max(...items.map((i) => i.name.length)));
    const rows = items.map((item) => {
      const code = String(item.code).padStart(2);
      const name = item.name.slice(0, nameWidth).padEnd(nameWidth);
      return `${code}  ${name}  ${item.price} Kč`;
    });
    return `🍕 <b>Pizza Dublovice</b>\n\n<pre>${rows.join("\n")}</pre>`;
  } catch {
    return "⚠️ Nepodařilo se načíst nabídku pizzy. Zkus to znovu.";
  }
}

export function formatTyden(): string {
  const now = getPragueNow();
  const WEEKDAYS: Array<{ jsDay: number; code: string }> = [
    { jsDay: 1, code: "Po" }, { jsDay: 2, code: "Út" }, { jsDay: 3, code: "St" },
    { jsDay: 4, code: "Čt" }, { jsDay: 5, code: "Pá" },
  ];
  const blocks = WEEKDAYS.map(({ jsDay, code }) => {
    const date = getDateForDay(now, jsDay);
    const dateStr = date.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
    return formatMenuForDay(code, dateStr);
  });
  return `📅 <b>Jídelníček na celý týden</b>\n\n` + blocks.join("\n\n―――――――――――――\n\n");
}

export function formatStatistiky(): string {
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

export function formatChybi(): string {
  const db = getDb();
  const data = getTodayOrderData();
  const twoWeeksAgo = new Date(getPragueNow());
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoISO = twoWeeksAgo.toISOString().slice(0, 10);
  const recentPeople = db.prepare(`
    SELECT DISTINCT r.person_name FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE r.person_name != '' AND o.date >= ? AND o.id != ? AND o.status = 'sent'
    ORDER BY r.person_name
  `).all(twoWeeksAgoISO, data.order.id) as { person_name: string }[];
  const orderedToday = new Set(
    data.departments.flatMap((d) => d.rows.filter((r) => r.personName).map((r) => r.personName)),
  );
  const missing = recentPeople.map((r) => r.person_name).filter((n) => !orderedToday.has(n));
  if (missing.length === 0) return "✅ Všichni, kdo obvykle objednávají, dnes mají řádek.";
  const dateStr = new Date(`${data.order.date}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "numeric",
  });
  return (
    `👥 <b>Kdo ještě neobjednal (${dateStr})</b>\n\n` +
    missing.map((n) => `  • ${n}`).join("\n") +
    `\n\n<i>Celkem ${missing.length} osob</i>`
  );
}
