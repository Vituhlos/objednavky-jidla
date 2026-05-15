import { getGlobalDb } from "./global-db";
import { getTenantDb } from "./tenant-db";
import { getGlobalSettings } from "./global-settings";
import { getPragueNow, toLocalISODate } from "./time";
import type { MenuItem, DayCode } from "./types";

const JS_DAY_TO_CODE: Record<number, DayCode> = {
  1: "Po",
  2: "Út",
  3: "St",
  4: "Čt",
  5: "Pá",
};

export function getTodayDayCode(): DayCode | null {
  const day = getPragueNow().getDay();
  return JS_DAY_TO_CODE[day] ?? null;
}

export function getDayCodeForISO(iso: string): DayCode | null {
  const [y, m, d] = iso.split("-").map(Number);
  return JS_DAY_TO_CODE[new Date(y, m - 1, d).getDay()] ?? null;
}

export function getMenuDates(): string[] {
  const rows = getGlobalDb()
    .prepare("SELECT DISTINCT week_start, day FROM menu_items WHERE week_start IS NOT NULL ORDER BY week_start, day")
    .all() as { week_start: string; day: string }[];
  const offsets: Record<string, number> = { Po: 0, Út: 1, St: 2, Čt: 3, Pá: 4 };
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const r of rows) {
    const off = offsets[r.day];
    if (off === undefined) continue;
    const [y, m, d] = r.week_start.split("-").map(Number);
    const date = new Date(y, m - 1, d + off);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (!seen.has(iso)) { seen.add(iso); dates.push(iso); }
  }
  return dates.sort();
}

// ISO date of Monday of the week containing `date`
export function getMondayISO(date: Date = getPragueNow()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalISODate(d);
}

// ISO date of next week's Monday
export function getNextMondayISO(): string {
  const d = getPragueNow();
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
    allergens: (row.allergens as string | null) ?? "",
  };
}

export function getMenuItemsForDay(day: string, weekStart?: string): {
  soups: MenuItem[];
  meals: MenuItem[];
} {
  const ws = weekStart ?? getMondayISO();
  const items = getGlobalDb()
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
  const row = getGlobalDb()
    .prepare("SELECT * FROM menu_items WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function getMenuItemsByIds(ids: number[]): Map<number, MenuItem> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = getGlobalDb()
    .prepare(`SELECT * FROM menu_items WHERE id IN (${placeholders})`)
    .all(...ids) as Record<string, unknown>[];
  return new Map(rows.map((row) => [row.id as number, mapRow(row)]));
}

export function getWeekLabel(): string {
  const now = getPragueNow();
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
  const ws = weekStart ?? getMondayISO();
  const row = getGlobalDb()
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
  const ws = weekStart ?? getMondayISO();
  const all = getGlobalDb()
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
// After replacing, re-links order_rows in all active tenant DBs by matching day+code+name
// so that re-importing the same PDF doesn't wipe meal selections.
export function setMenuForWeek(
  weekStart: string,
  weekLabel: string,
  items: import("./parse-menu").ParsedMenuItem[]
): void {
  const globalDb = getGlobalDb();
  const s = getGlobalSettings();
  const soupPrice = parseInt(s.defaultSoupPrice) || 30;
  const mealPrice = parseInt(s.defaultMealPrice) || 110;

  type ItemMeta = { id: number; day: string; type: string; code: string; name: string };

  // Capture old item metadata for re-linking before deletion
  const oldItems = globalDb
    .prepare("SELECT id, day, type, code, name FROM menu_items WHERE week_start = ?")
    .all(weekStart) as ItemMeta[];
  const oldIds = oldItems.map((r) => r.id);

  // Replace menu in global.db
  globalDb.transaction(() => {
    globalDb.prepare("DELETE FROM menu_items WHERE week_start = ?").run(weekStart);
    const insert = globalDb.prepare(
      "INSERT INTO menu_items (week_start, week_label, day, type, code, name, price, allergens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const item of items) {
      const price = item.type === "Polévka" ? soupPrice : mealPrice;
      insert.run(weekStart, weekLabel, item.day, item.type, item.code, item.name, price, item.allergens ?? "");
    }
  })();

  if (oldIds.length === 0) return; // Fresh week, no existing order_rows to re-link

  // Build lookup maps for re-linking: day|type|code|name → newId
  const newItems = globalDb
    .prepare("SELECT id, day, type, code, name FROM menu_items WHERE week_start = ?")
    .all(weekStart) as ItemMeta[];

  const exactKey = (i: ItemMeta) => `${i.day}|${i.type}|${i.code}|${i.name}`;
  const codeKey  = (i: ItemMeta) => `${i.day}|${i.type}|${i.code}`;
  const byExact = new Map(newItems.map((i) => [exactKey(i), i.id]));
  const byCode  = new Map(newItems.map((i) => [codeKey(i), i.id]));

  const findNewId = (day: string, type: string, code: string, name: string): number | null =>
    byExact.get(`${day}|${type}|${code}|${name}`) ?? byCode.get(`${day}|${type}|${code}`) ?? null;

  // Build a meta map for the old items (needed for extra_meals JSON re-linking)
  const oldMeta = new Map(oldItems.map((i) => [i.id, i]));
  const oldIdSet = new Set(oldIds);

  // Re-link order_rows in each active tenant DB
  const tenants = globalDb
    .prepare("SELECT slug FROM tenants WHERE active = 1")
    .all() as { slug: string }[];

  for (const { slug } of tenants) {
    try {
      const tdb = getTenantDb(slug);

      // Find rows referencing any of the old item IDs
      const placeholders = oldIds.map(() => "?").join(",");
      const affectedRows = tdb.prepare(`
        SELECT id, soup_item_id, soup_item_id_2, main_item_id, extra_meals
        FROM order_rows
        WHERE soup_item_id   IN (${placeholders})
           OR soup_item_id_2 IN (${placeholders})
           OR main_item_id   IN (${placeholders})
      `).all(...oldIds, ...oldIds, ...oldIds) as {
        id: number;
        soup_item_id: number | null;
        soup_item_id_2: number | null;
        main_item_id: number | null;
        extra_meals: string;
      }[];

      tdb.transaction(() => {
        for (const row of affectedRows) {
          if (row.soup_item_id && oldIdSet.has(row.soup_item_id)) {
            const meta = oldMeta.get(row.soup_item_id);
            const newId = meta ? findNewId(meta.day, "Polévka", meta.code, meta.name) : null;
            tdb.prepare("UPDATE order_rows SET soup_item_id = ? WHERE id = ?").run(newId, row.id);
          }
          if (row.soup_item_id_2 && oldIdSet.has(row.soup_item_id_2)) {
            const meta = oldMeta.get(row.soup_item_id_2);
            const newId = meta ? findNewId(meta.day, "Polévka", meta.code, meta.name) : null;
            tdb.prepare("UPDATE order_rows SET soup_item_id_2 = ? WHERE id = ?").run(newId, row.id);
          }
          if (row.main_item_id && oldIdSet.has(row.main_item_id)) {
            const meta = oldMeta.get(row.main_item_id);
            const newId = meta ? findNewId(meta.day, "Jídlo", meta.code, meta.name) : null;
            tdb.prepare("UPDATE order_rows SET main_item_id = ? WHERE id = ?").run(newId, row.id);
          }
          // Re-link extra_meals JSON entries
          try {
            type ExtraMealEntry = { itemId: number; count: number };
            const entries: ExtraMealEntry[] = JSON.parse(row.extra_meals || "[]");
            let changed = false;
            const updated = entries.map((e) => {
              if (!oldIdSet.has(e.itemId)) return e;
              const meta = oldMeta.get(e.itemId);
              if (!meta) return e;
              const newId = findNewId(meta.day, meta.type, meta.code, meta.name);
              if (newId && newId !== e.itemId) { changed = true; return { ...e, itemId: newId }; }
              return e;
            });
            if (changed) {
              tdb.prepare("UPDATE order_rows SET extra_meals = ? WHERE id = ?")
                .run(JSON.stringify(updated), row.id);
            }
          } catch { /* ignore malformed JSON */ }
        }
      })();
    } catch (err) {
      console.error(`[menu] Chyba při re-linkování order_rows pro tenant ${slug}:`, err);
    }
  }
}

export function deleteMenuForWeek(weekStart: string): void {
  const globalDb = getGlobalDb();

  // Get IDs before deletion for tenant re-linking
  const ids = (globalDb
    .prepare("SELECT id FROM menu_items WHERE week_start = ?")
    .all(weekStart) as { id: number }[]).map((r) => r.id);

  globalDb.transaction(() => {
    globalDb.prepare("DELETE FROM menu_items WHERE week_start = ?").run(weekStart);
  })();

  if (ids.length === 0) return;

  const placeholders = ids.map(() => "?").join(",");
  const tenants = globalDb
    .prepare("SELECT slug FROM tenants WHERE active = 1")
    .all() as { slug: string }[];

  for (const { slug } of tenants) {
    try {
      const tdb = getTenantDb(slug);
      tdb.prepare(`UPDATE order_rows SET soup_item_id   = NULL WHERE soup_item_id   IN (${placeholders})`).run(...ids);
      tdb.prepare(`UPDATE order_rows SET soup_item_id_2 = NULL WHERE soup_item_id_2 IN (${placeholders})`).run(...ids);
      tdb.prepare(`UPDATE order_rows SET main_item_id   = NULL WHERE main_item_id   IN (${placeholders})`).run(...ids);
    } catch (err) {
      console.error(`[menu] Chyba při mazání referencí pro tenant ${slug}:`, err);
    }
  }
}

export function getAllMenuWeeks(): { weekStart: string; weekLabel: string | null }[] {
  const rows = getGlobalDb()
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
  const db = getGlobalDb();
  const ws = item.weekStart ?? getMondayISO();
  const labelRow = db
    .prepare("SELECT week_label FROM menu_items WHERE week_start = ? LIMIT 1")
    .get(ws) as { week_label: string | null } | undefined;
  const result = db
    .prepare(
      "INSERT INTO menu_items (week_start, week_label, day, type, code, name, price, allergens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(ws, labelRow?.week_label ?? null, item.day, item.type, item.code, item.name, item.price, "");
  return mapRow(
    db.prepare("SELECT * FROM menu_items WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>
  );
}

export function updateMenuItem(
  id: number,
  updates: Partial<{ code: string; name: string; price: number; allergens: string }>
): MenuItem {
  const db = getGlobalDb();
  const fieldMap: Record<string, string> = { code: "code", name: "name", price: "price", allergens: "allergens" };
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
  getGlobalDb().prepare("DELETE FROM menu_items WHERE id = ?").run(id);
}

export function closeDay(dayCode: string, weekStart: string): void {
  const db = getGlobalDb();
  db.transaction(() => {
    db.prepare("DELETE FROM menu_items WHERE day = ? AND week_start = ?").run(dayCode, weekStart);
    db.prepare("INSERT INTO menu_items (week_start, day, type, code, name, price) VALUES (?, ?, 'Jídlo', '0', 'Zavřeno', 0)").run(weekStart, dayCode);
  })();
}

export function openDay(dayCode: string, weekStart: string): void {
  getGlobalDb().prepare("DELETE FROM menu_items WHERE day = ? AND week_start = ? AND name = 'Zavřeno'").run(dayCode, weekStart);
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
  const db = getGlobalDb();
  const count = (
    db.prepare("SELECT COUNT(*) as c FROM menu_items").get() as { c: number }
  ).c;
  if (count > 0) return;

  const ws = getMondayISO();
  const insert = db.prepare(
    "INSERT INTO menu_items (week_start, week_label, day, type, code, name, price) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const SAMPLE_MENU = getSampleMenu();
  db.transaction(() => {
    for (const item of SAMPLE_MENU) {
      insert.run(ws, weekLabel, item.day, item.type, item.code, item.name, item.price);
    }
  })();
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
