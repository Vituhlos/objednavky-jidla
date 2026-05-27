import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getDepartments } from "@/lib/departments";
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

  return (
    <ProfilePage
      firstName={user.firstName}
      lastName={user.lastName}
      email={user.email}
      role={user.role}
      emailVerified={user.emailVerified}
      hasPassword={!!user.passwordHash}
      defaultDepartment={user.defaultDepartment}
      departments={departments.map((d) => ({ name: d.name, label: d.label }))}
      totalOrders={totalOrders}
      thisMonthOrders={thisMonthOrders}
      showSettingsLink={user.role === "admin"}
    />
  );
}
