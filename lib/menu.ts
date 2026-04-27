import { getDb } from "./db";
import { getSettings } from "./settings";
import type { MenuItem, DayCode } from "./types";

const JS_DAY_TO_CODE: Record<number, DayCode> = {
  1: "Po",
  2: "Út",
  3: "St",
  4: "Čt",
  5: "Pá",
};

export function getTodayDayCode(): DayCode | null {
  const day = new Date().getDay();
  return JS_DAY_TO_CODE[day] ?? null;
}

// ISO date of Monday of the week containing `date`
export function getMondayISO(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ISO date of next week's Monday
export function getNextMondayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return getMondayISO(d);
}

function mapRow(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as number,
    weekLabel: row.week_label as string | null,
    day: row.day as string,
    type: row.type as "Polévka" | "Jídlo",
    code: row.code as string,
    name: row.name as string,
    price: row.price as number,
  };
}

export function getMenuItemsForDay(day: string, weekStart?: string): {
  soups: MenuItem[];
  meals: MenuItem[];
} {
  const db = getDb();
  const ws = weekStart ?? getMondayISO();
  const items = db
    .prepare(
      "SELECT * FROM menu_items WHERE day = ? AND (week_start = ? OR week_start IS NULL) ORDER BY type DESC, CAST(code AS INTEGER) ASC, code ASC, id ASC"
    )
    .all(day, ws) as Record<string, unknown>[];
  const mapped = items.map(mapRow);
  return {
    soups: mapped.filter((i) => i.type === "Polévka"),
    meals: mapped.filter((i) => i.type === "Jídlo"),
  };
}

export function getMenuItemById(id: number): MenuItem | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM menu_items WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function getWeekLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
  return `${fmt(monday)}-${fmt(friday)}${friday.getFullYear()}`;
}

export function getMenuWeekLabel(weekStart?: string): string | null {
  const db = getDb();
  const ws = weekStart ?? getMondayISO();
  const row = db
    .prepare(
      "SELECT week_label FROM menu_items WHERE (week_start = ? OR week_start IS NULL) AND week_label IS NOT NULL LIMIT 1"
    )
    .get(ws) as { week_label: string } | undefined;
  return row?.week_label ?? null;
}

export function getFullMenu(weekStart?: string): Record<
  string,
  { soups: MenuItem[]; meals: MenuItem[] }
> {
  const db = getDb();
  const ws = weekStart ?? getMondayISO();
  const all = db
    .prepare(
      "SELECT * FROM menu_items WHERE week_start = ? OR week_start IS NULL ORDER BY day, type DESC, CAST(code AS INTEGER) ASC, code ASC, id ASC"
    )
    .all(ws) as Record<string, unknown>[];
  const result: Record<string, { soups: MenuItem[]; meals: MenuItem[] }> = {};
  for (const raw of all) {
    const item = mapRow(raw);
    if (!result[item.day]) result[item.day] = { soups: [], meals: [] };
    if (item.type === "Polévka") result[item.day].soups.push(item);
    else result[item.day].meals.push(item);
  }
  return result;
}

// Replace (or create) all menu items for a specific week.
// After replacing, tries to re-link order_rows to the new items by matching day+code+name
// so that re-importing the same PDF doesn't wipe meal selections.
export function setMenuForWeek(
  weekStart: string,
  weekLabel: string,
  items: import("./parse-menu").ParsedMenuItem[]
): void {
  const db = getDb();
  const s = getSettings();
  const soupPrice = parseInt(s.defaultSoupPrice) || 30;
  const mealPrice = parseInt(s.defaultMealPrice) || 110;

  interface RefRow {
    row_id: number;
    soup_day: string | null; soup_code: string | null; soup_name: string | null;
    soup2_day: string | null; soup2_code: string | null; soup2_name: string | null;
    main_day: string | null; main_code: string | null; main_name: string | null;
  }

  const transaction = db.transaction(() => {
    // Capture which order_rows reference this week's items before deletion
    const affected = db.prepare(`
      SELECT or2.id AS row_id,
        soup.day AS soup_day, soup.code AS soup_code, soup.name AS soup_name,
        soup2.day AS soup2_day, soup2.code AS soup2_code, soup2.name AS soup2_name,
        main.day AS main_day, main.code AS main_code, main.name AS main_name
      FROM order_rows or2
      LEFT JOIN menu_items soup  ON soup.id  = or2.soup_item_id   AND soup.week_start  = ?
      LEFT JOIN menu_items soup2 ON soup2.id = or2.soup_item_id_2 AND soup2.week_start = ?
      LEFT JOIN menu_items main  ON main.id  = or2.main_item_id   AND main.week_start  = ?
      WHERE or2.soup_item_id   IN (SELECT id FROM menu_items WHERE week_start = ?)
         OR or2.soup_item_id_2 IN (SELECT id FROM menu_items WHERE week_start = ?)
         OR or2.main_item_id   IN (SELECT id FROM menu_items WHERE week_start = ?)
    `).all(weekStart, weekStart, weekStart, weekStart, weekStart, weekStart) as RefRow[];

    db.prepare("UPDATE order_rows SET soup_item_id = NULL WHERE soup_item_id IN (SELECT id FROM menu_items WHERE week_start = ?)").run(weekStart);
    db.prepare("UPDATE order_rows SET soup_item_id_2 = NULL WHERE soup_item_id_2 IN (SELECT id FROM menu_items WHERE week_start = ?)").run(weekStart);
    db.prepare("UPDATE order_rows SET main_item_id = NULL WHERE main_item_id IN (SELECT id FROM menu_items WHERE week_start = ?)").run(weekStart);
    db.prepare("DELETE FROM menu_items WHERE week_start = ?").run(weekStart);

    const insert = db.prepare(
      "INSERT INTO menu_items (week_start, week_label, day, type, code, name, price) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const item of items) {
      const price = item.type === "Polévka" ? soupPrice : mealPrice;
      insert.run(weekStart, weekLabel, item.day, item.type, item.code, item.name, price);
    }

    // Re-link order rows: match by (day, code, name) — fall back to (day, code) first match
    const findNewId = (day: string, type: string, code: string, name: string): number | null => {
      const exact = db.prepare(
        "SELECT id FROM menu_items WHERE week_start=? AND day=? AND type=? AND code=? AND name=? LIMIT 1"
      ).get(weekStart, day, type, code, name) as { id: number } | undefined;
      if (exact) return exact.id;
      const byCode = db.prepare(
        "SELECT id FROM menu_items WHERE week_start=? AND day=? AND type=? AND code=? LIMIT 1"
      ).get(weekStart, day, type, code) as { id: number } | undefined;
      return byCode?.id ?? null;
    };

    for (const ref of affected) {
      if (ref.soup_day) {
        const newId = findNewId(ref.soup_day, "Polévka", ref.soup_code!, ref.soup_name ?? "");
        if (newId) db.prepare("UPDATE order_rows SET soup_item_id=? WHERE id=?").run(newId, ref.row_id);
      }
      if (ref.soup2_day) {
        const newId = findNewId(ref.soup2_day, "Polévka", ref.soup2_code!, ref.soup2_name ?? "");
        if (newId) db.prepare("UPDATE order_rows SET soup_item_id_2=? WHERE id=?").run(newId, ref.row_id);
      }
      if (ref.main_day) {
        const newId = findNewId(ref.main_day, "Jídlo", ref.main_code!, ref.main_name ?? "");
        if (newId) db.prepare("UPDATE order_rows SET main_item_id=? WHERE id=?").run(newId, ref.row_id);
      }
    }
  });
  transaction();
}

export function deleteMenuForWeek(weekStart: string): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE order_rows SET soup_item_id = NULL WHERE soup_item_id IN (SELECT id FROM menu_items WHERE week_start = ?)").run(weekStart);
    db.prepare("UPDATE order_rows SET main_item_id = NULL WHERE main_item_id IN (SELECT id FROM menu_items WHERE week_start = ?)").run(weekStart);
    db.prepare("DELETE FROM menu_items WHERE week_start = ?").run(weekStart);
  })();
}

export function getAllMenuWeeks(): { weekStart: string; weekLabel: string | null }[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT DISTINCT week_start, week_label FROM menu_items WHERE week_start IS NOT NULL ORDER BY week_start ASC"
    )
    .all() as { week_start: string; week_label: string | null }[];
  return rows.map((r) => ({ weekStart: r.week_start, weekLabel: r.week_label }));
}

export function addMenuItem(item: {
  day: string;
  type: "Polévka" | "Jídlo";
  code: string;
  name: string;
  price: number;
  weekStart?: string;
}): MenuItem {
  const db = getDb();
  const ws = item.weekStart ?? getMondayISO();
  const labelRow = db
    .prepare("SELECT week_label FROM menu_items WHERE week_start = ? LIMIT 1")
    .get(ws) as { week_label: string | null } | undefined;
  const result = db
    .prepare(
      "INSERT INTO menu_items (week_start, week_label, day, type, code, name, price) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(ws, labelRow?.week_label ?? null, item.day, item.type, item.code, item.name, item.price);
  return mapRow(
    db.prepare("SELECT * FROM menu_items WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>
  );
}

export function updateMenuItem(
  id: number,
  updates: Partial<{ code: string; name: string; price: number }>
): MenuItem {
  const db = getDb();
  const fieldMap: Record<string, string> = { code: "code", name: "name", price: "price" };
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length > 0) {
    const setClauses = entries.map(([k]) => `${fieldMap[k]} = ?`).join(", ");
    db.prepare(`UPDATE menu_items SET ${setClauses} WHERE id = ?`).run(
      ...entries.map(([, v]) => v),
      id
    );
  }
  return mapRow(
    db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function deleteMenuItem(id: number): void {
  getDb().prepare("DELETE FROM menu_items WHERE id = ?").run(id);
}

// Keep replaceMenu for backward compatibility (replaces current week)
export function replaceMenu(
  weekLabel: string,
  items: import("./parse-menu").ParsedMenuItem[]
): void {
  setMenuForWeek(getMondayISO(), weekLabel, items);
}

export function seedMenuIfEmpty(weekLabel: string): void {
  if (process.env.NODE_ENV === "production") return;
  const db = getDb();
  const count = (
    db.prepare("SELECT COUNT(*) as c FROM menu_items").get() as { c: number }
  ).c;
  if (count > 0) return;

  const ws = getMondayISO();
  const insert = db.prepare(
    "INSERT INTO menu_items (week_start, week_label, day, type, code, name, price) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const SAMPLE_MENU = getSampleMenu();
  const insertMany = db.transaction(() => {
    for (const item of SAMPLE_MENU) {
      insert.run(ws, weekLabel, item.day, item.type, item.code, item.name, item.price);
    }
  });
  insertMany();
}

function getSampleMenu(): Array<{
  day: DayCode;
  type: "Polévka" | "Jídlo";
  code: string;
  name: string;
  price: number;
}> {
  return [
    { day: "Po", type: "Polévka", code: "A", name: "Zeleninová s nudlemi", price: 30 },
    { day: "Po", type: "Polévka", code: "B", name: "Hovězí vývar s játrovými knedlíčky", price: 35 },
    { day: "Po", type: "Jídlo", code: "1", name: "Vepřový guláš, houskový knedlík", price: 115 },
    { day: "Po", type: "Jídlo", code: "2", name: "Pečené kuře, brambory, šalát", price: 120 },
    { day: "Út", type: "Polévka", code: "A", name: "Boršč", price: 32 },
    { day: "Út", type: "Polévka", code: "B", name: "Hovězí vývar s kořenovou zeleninou", price: 35 },
    { day: "Út", type: "Jídlo", code: "1", name: "Hovězí líčka na víně, bramborová kaše", price: 145 },
    { day: "Út", type: "Jídlo", code: "2", name: "Kuře na paprice, houskový knedlík", price: 120 },
    { day: "St", type: "Polévka", code: "A", name: "Gulášová z černého piva", price: 35 },
    { day: "St", type: "Polévka", code: "B", name: "Hovězí vývar s kořenovou zeleninou", price: 35 },
    { day: "St", type: "Jídlo", code: "1", name: "Hovězí španělský ptáček, rýže", price: 125 },
    { day: "St", type: "Jídlo", code: "2", name: "Konfitované kachní stehno, červené zelí, knedlík", price: 165 },
    { day: "Čt", type: "Polévka", code: "A", name: "Čočková s uzeným masem", price: 32 },
    { day: "Čt", type: "Polévka", code: "B", name: "Zeleninový vývar s celestýnskými nudlemi", price: 30 },
    { day: "Čt", type: "Jídlo", code: "1", name: "Svíčková na smetaně, houskový knedlík", price: 145 },
    { day: "Čt", type: "Jídlo", code: "2", name: "Smažené rybí filé, tartar, hranolky", price: 130 },
    { day: "Pá", type: "Polévka", code: "A", name: "Bramborová se slaninou", price: 30 },
    { day: "Pá", type: "Polévka", code: "B", name: "Hovězí vývar s kořenovou zeleninou", price: 35 },
    { day: "Pá", type: "Jídlo", code: "1", name: "Smažený řízek, bramborový salát", price: 125 },
    { day: "Pá", type: "Jídlo", code: "2", name: "Pečená kachna, zelí, knedlík", price: 155 },
  ];
}
