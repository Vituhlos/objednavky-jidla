export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { getDepartments } from "@/lib/departments";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { redirect } from "next/navigation";
import ProfilePage from "@/app/components/ProfilePage";

export default async function Page() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const departments = getDepartments();
  const db = getDb();
  const s = getSettings();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const dSoup = parseInt(s.defaultSoupPrice) || 30;
  const dMeal = parseInt(s.defaultMealPrice) || 110;
  const pRoll = parseInt(s.priceRoll) || 5;
  const pBread = parseInt(s.priceBreadDumpling) || 40;
  const pPotato = parseInt(s.pricePotatoDumpling) || 45;
  const pKetchup = parseInt(s.priceKetchup) || 20;
  const pTatarka = parseInt(s.priceTatarka) || 20;
  const pBbq = parseInt(s.priceBbq) || 20;

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE r.user_id = ? AND (r.soup_item_id IS NOT NULL OR r.main_item_id IS NOT NULL OR r.roll_count > 0)
  `).get(currentUser.id) as { total: number };

  const { thisMonth } = db.prepare(`
    SELECT COUNT(*) as thisMonth FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE r.user_id = ? AND o.date >= ? AND r.main_item_id IS NOT NULL
  `).get(currentUser.id, monthStart) as { thisMonth: number };

  const favRow = db.prepare(`
    SELECT mi.name, COUNT(*) as cnt FROM order_rows r
    JOIN menu_items mi ON mi.id = r.main_item_id
    WHERE r.user_id = ? AND r.main_item_id IS NOT NULL
    GROUP BY r.main_item_id ORDER BY cnt DESC LIMIT 1
  `).get(currentUser.id) as { name: string; cnt: number } | undefined;

  const { monthSpending } = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN r.soup_item_id IS NOT NULL THEN COALESCE(s1.price, ?) ELSE 0 END +
      CASE WHEN r.soup_item_id_2 IS NOT NULL THEN COALESCE(s2.price, ?) ELSE 0 END +
      CASE WHEN r.main_item_id IS NOT NULL THEN COALESCE(m.price, ?) * MAX(r.meal_count, 1) ELSE 0 END +
      r.roll_count * ? + r.bread_dumpling_count * ? + r.potato_dumpling_count * ? +
      r.ketchup_count * ? + r.tatarka_count * ? + r.bbq_count * ?
    ), 0) as monthSpending
    FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    LEFT JOIN menu_items s1 ON r.soup_item_id = s1.id
    LEFT JOIN menu_items s2 ON r.soup_item_id_2 = s2.id
    LEFT JOIN menu_items m ON r.main_item_id = m.id
    WHERE r.user_id = ? AND o.date >= ? AND o.status = 'sent'
    AND (r.soup_item_id IS NOT NULL OR r.main_item_id IS NOT NULL OR r.roll_count > 0)
  `).get(dSoup, dSoup, dMeal, pRoll, pBread, pPotato, pKetchup, pTatarka, pBbq, currentUser.id, monthStart) as { monthSpending: number };

  return (
    <ProfilePage
      user={currentUser}
      departments={departments}
      stats={{
        totalOrders: total,
        thisMonthOrders: thisMonth,
        favoriteDish: favRow?.name ?? null,
        monthlySpending: monthSpending,
      }}
    />
  );
}
