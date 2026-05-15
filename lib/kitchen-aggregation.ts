import { getGlobalDb } from "./global-db";
import { getTenantDb } from "./tenant-db";

export interface TenantSummary {
  slug: string;
  displayName: string;
  orderStatus: "sent" | "draft" | "none";
  orderCount: number;
  mealCounts: { itemId: number; name: string; count: number }[];
  soupCount: number;
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
}

export interface KitchenAggregation {
  date: string;
  totalOrders: number;
  totalMeals: number;
  totalSoups: number;
  totalRolls: number;
  totalBreadDumplings: number;
  totalPotatoDumplings: number;
  perItem: { itemId: number; name: string; total: number }[];
  tenants: TenantSummary[];
}

function getMondayOfDate(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  dt.setDate(dt.getDate() + diff);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function aggregateOrdersForDate(date: string): KitchenAggregation {
  const gdb = getGlobalDb();

  const activeTenants = gdb
    .prepare("SELECT slug, display_name FROM tenants WHERE active = 1 ORDER BY display_name")
    .all() as { slug: string; display_name: string }[];

  // Menu item name lookup from global.db
  const weekStart = getMondayOfDate(date);
  const menuRows = gdb
    .prepare("SELECT id, name, type FROM menu_items WHERE week_start = ?")
    .all(weekStart) as { id: number; name: string; type: string }[];
  const menuLookup = new Map(menuRows.map((r) => [r.id, r.name]));

  const itemTotals = new Map<number, number>();
  const tenants: TenantSummary[] = [];
  let totalOrders = 0;
  let totalMeals = 0;
  let totalSoups = 0;
  let totalRolls = 0;
  let totalBreadDumplings = 0;
  let totalPotatoDumplings = 0;

  for (const tenant of activeTenants) {
    try {
      const tdb = getTenantDb(tenant.slug);
      const order = tdb
        .prepare("SELECT id, status FROM orders WHERE date = ?")
        .get(date) as { id: number; status: string } | undefined;

      if (!order) {
        tenants.push({ slug: tenant.slug, displayName: tenant.display_name, orderStatus: "none", orderCount: 0, mealCounts: [], soupCount: 0, rollCount: 0, breadDumplingCount: 0, potatoDumplingCount: 0 });
        continue;
      }

      type RawRow = { main_item_id: number | null; meal_count: number; soup_item_id: number | null; soup_item_id_2: number | null; extra_meals: string | null; roll_count: number; bread_dumpling_count: number; potato_dumpling_count: number };
      const rows = tdb
        .prepare("SELECT main_item_id, meal_count, soup_item_id, soup_item_id_2, extra_meals, roll_count, bread_dumpling_count, potato_dumpling_count FROM order_rows WHERE order_id = ?")
        .all(order.id) as RawRow[];

      const tenantItems = new Map<number, number>();
      let soupCount = 0, rollCount = 0, breadCount = 0, potatoCount = 0, orderCount = 0;

      for (const row of rows) {
        if (!row.main_item_id && !row.soup_item_id) continue;
        orderCount++;

        if (row.main_item_id) {
          const count = row.meal_count || 1;
          tenantItems.set(row.main_item_id, (tenantItems.get(row.main_item_id) ?? 0) + count);
          itemTotals.set(row.main_item_id, (itemTotals.get(row.main_item_id) ?? 0) + count);
          totalMeals += count;
        }
        if (row.soup_item_id) { soupCount++; totalSoups++; }
        if (row.soup_item_id_2) { soupCount++; totalSoups++; }

        if (row.extra_meals && row.extra_meals !== "[]") {
          try {
            const extras = JSON.parse(row.extra_meals) as Array<{ itemId: number; count: number }>;
            for (const e of extras) {
              tenantItems.set(e.itemId, (tenantItems.get(e.itemId) ?? 0) + e.count);
              itemTotals.set(e.itemId, (itemTotals.get(e.itemId) ?? 0) + e.count);
              totalMeals += e.count;
            }
          } catch { /* skip bad JSON */ }
        }

        rollCount += row.roll_count || 0;
        breadCount += row.bread_dumpling_count || 0;
        potatoCount += row.potato_dumpling_count || 0;
      }

      totalOrders += orderCount;
      totalRolls += rollCount;
      totalBreadDumplings += breadCount;
      totalPotatoDumplings += potatoCount;

      const mealCounts = Array.from(tenantItems.entries())
        .map(([itemId, count]) => ({ itemId, name: menuLookup.get(itemId) ?? `#${itemId}`, count }))
        .sort((a, b) => b.count - a.count);

      tenants.push({
        slug: tenant.slug,
        displayName: tenant.display_name,
        orderStatus: order.status as "sent" | "draft",
        orderCount,
        mealCounts,
        soupCount,
        rollCount,
        breadDumplingCount: breadCount,
        potatoDumplingCount: potatoCount,
      });
    } catch {
      tenants.push({ slug: tenant.slug, displayName: tenant.display_name, orderStatus: "none", orderCount: 0, mealCounts: [], soupCount: 0, rollCount: 0, breadDumplingCount: 0, potatoDumplingCount: 0 });
    }
  }

  const perItem = Array.from(itemTotals.entries())
    .map(([itemId, total]) => ({ itemId, name: menuLookup.get(itemId) ?? `#${itemId}`, total }))
    .sort((a, b) => b.total - a.total);

  return { date, totalOrders, totalMeals, totalSoups, totalRolls, totalBreadDumplings, totalPotatoDumplings, perItem, tenants };
}

export function getWorkingDayNeighbors(dateIso: string): { prev: string; next: string } {
  function shift(iso: string, delta: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + delta);
    // Skip weekend
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + (delta > 0 ? 1 : -1));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  return { prev: shift(dateIso, -1), next: shift(dateIso, 1) };
}
