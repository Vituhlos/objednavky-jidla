import { auth } from "@/auth";
import { getUserById, getLinkedProviders } from "@/lib/users";
import { getDepartments } from "@/lib/departments";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import ProfilePage from "@/app/components/ProfilePage";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilRoute() {
  const session = await auth();
  if (!session?.userId) redirect("/login");

  const userId = session.userId;
  const user = getUserById(userId);
  if (!user) redirect("/login");

  const departments = getDepartments();
  const settings = getSettings();
  const defaultMealPrice = parseInt(settings.defaultMealPrice ?? "110") || 110;

  const db = getDb();
  const personName = `${user.firstName} ${user.lastName}`.trim();

  const totalOrders = personName
    ? ((db.prepare(
        "SELECT COUNT(DISTINCT order_id) as c FROM order_rows WHERE person_name = ?"
      ).get(personName) as { c: number } | undefined)?.c ?? 0)
    : 0;

  const thisMonthOrders = personName
    ? ((db.prepare(
        "SELECT COUNT(DISTINCT order_id) as c FROM order_rows WHERE person_name = ? AND order_id IN (SELECT id FROM orders WHERE date >= date('now','start of month'))"
      ).get(personName) as { c: number } | undefined)?.c ?? 0)
    : 0;

  const favoriteDish = personName
    ? ((db.prepare(
        `SELECT mi.name FROM order_rows r
         JOIN menu_items mi ON mi.id = r.main_item_id
         WHERE r.person_name = ? AND r.main_item_id IS NOT NULL
         GROUP BY r.main_item_id ORDER BY COUNT(*) DESC LIMIT 1`
      ).get(personName) as { name: string } | undefined)?.name ?? null)
    : null;

  const monthlyRows = personName
    ? (db.prepare(
        `SELECT r.meal_count FROM order_rows r
         JOIN orders o ON o.id = r.order_id
         WHERE r.person_name = ? AND r.main_item_id IS NOT NULL
           AND o.date >= date('now','start of month')`
      ).all(personName) as { meal_count: number }[])
    : [];
  const monthlySpending = monthlyRows.reduce((s, r) => s + (r.meal_count || 1) * defaultMealPrice, 0);

  // Monthly history — 3 months
  const m0 = personName
    ? (db.prepare(
        `SELECT r.meal_count FROM order_rows r
         JOIN orders o ON o.id = r.order_id
         WHERE r.person_name = ? AND r.main_item_id IS NOT NULL
           AND o.date >= date('now','start of month')`
      ).all(personName) as { meal_count: number }[])
    : [];

  const m1 = personName
    ? (db.prepare(
        `SELECT r.meal_count FROM order_rows r
         JOIN orders o ON o.id = r.order_id
         WHERE r.person_name = ? AND r.main_item_id IS NOT NULL
           AND o.date >= date('now','start of month','-1 months')
           AND o.date < date('now','start of month')`
      ).all(personName) as { meal_count: number }[])
    : [];

  const m2 = personName
    ? (db.prepare(
        `SELECT r.meal_count FROM order_rows r
         JOIN orders o ON o.id = r.order_id
         WHERE r.person_name = ? AND r.main_item_id IS NOT NULL
           AND o.date >= date('now','start of month','-2 months')
           AND o.date < date('now','start of month','-1 months')`
      ).all(personName) as { meal_count: number }[])
    : [];

  const now = new Date();
  function mLabel(offset: number) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return d.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
  }

  const monthlyHistory = [
    { month: mLabel(2), spending: m2.reduce((s, r) => s + (r.meal_count || 1) * defaultMealPrice, 0) },
    { month: mLabel(1), spending: m1.reduce((s, r) => s + (r.meal_count || 1) * defaultMealPrice, 0) },
    { month: mLabel(0), spending: m0.reduce((s, r) => s + (r.meal_count || 1) * defaultMealPrice, 0) },
  ];

  const linkedProviders = getLinkedProviders(userId);
  const telegramConfigured = settings.telegramEnabled === "true" && !!settings.telegramBotToken;
  const telegramBotUrl = settings.telegramAppUrl || "";

  return (
    <ProfilePage
      firstName={user.firstName}
      lastName={user.lastName}
      email={user.email}
      role={user.role}
      emailVerified={user.emailVerified}
      hasPassword={!!user.passwordHash}
      defaultDepartment={user.defaultDepartment}
      emailOrderConfirmation={user.emailOrderConfirmation}
      departments={departments.map((d) => ({ name: d.name, label: d.label }))}
      totalOrders={totalOrders}
      thisMonthOrders={thisMonthOrders}
      favoriteDish={favoriteDish}
      monthlySpending={monthlySpending}
      showSettingsLink={user.role === "admin"}
      linkedProviders={linkedProviders}
      monthlyHistory={monthlyHistory}
      telegramConfigured={telegramConfigured}
      telegramBotUrl={telegramBotUrl}
    />
  );
}
