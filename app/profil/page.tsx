export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { getDepartments } from "@/lib/departments";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import ProfilePage from "@/app/components/ProfilePage";

export default async function Page() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const departments = getDepartments();
  const db = getDb();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

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

  return (
    <ProfilePage
      user={currentUser}
      departments={departments}
      stats={{
        totalOrders: total,
        thisMonthOrders: thisMonth,
        favoriteDish: favRow?.name ?? null,
      }}
    />
  );
}
