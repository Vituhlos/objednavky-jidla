export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireTenantAdmin, TenantAuthError } from "@/lib/tenant-auth";
import { getTenantDb } from "@/lib/tenant-db";
import { getGlobalDb } from "@/lib/global-db";
import { getDepartments } from "@/lib/departments";
import { getPragueISODate } from "@/lib/time";
import TenantAdminPage from "./TenantAdminPage";

export default async function TenantAdminRoute({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  try {
    await requireTenantAdmin(tenantSlug);
  } catch (e) {
    if (e instanceof TenantAuthError) redirect(`/t/${tenantSlug}/login`);
    throw e;
  }

  const tdb = getTenantDb(tenantSlug);
  const gdb = getGlobalDb();

  // Users
  const users = tdb
    .prepare(
      "SELECT id, email, first_name, last_name, role, active, created_at FROM users ORDER BY last_name, first_name"
    )
    .all() as {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      active: number;
      created_at: string;
    }[];

  // Stats
  const today = getPragueISODate();
  const monthStart = today.slice(0, 7) + "-01";

  const ordersThisMonth = (
    tdb
      .prepare("SELECT COUNT(*) as n FROM orders WHERE date >= ? AND status = 'sent'")
      .get(monthStart) as { n: number }
  ).n;

  const activeToday = (
    tdb
      .prepare(
        "SELECT COUNT(DISTINCT user_id) as n FROM order_rows WHERE order_id = (SELECT id FROM orders WHERE date = ?) AND user_id IS NOT NULL"
      )
      .get(today) as { n: number }
  ).n;

  // Join code
  const tenantRow = gdb
    .prepare("SELECT join_code, display_name FROM tenants WHERE slug = ?")
    .get(tenantSlug) as { join_code: string; display_name: string } | undefined;

  const departments = getDepartments();

  return (
    <TenantAdminPage
      tenantSlug={tenantSlug}
      tenantName={tenantRow?.display_name ?? tenantSlug}
      joinCode={tenantRow?.join_code ?? ""}
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role as "user" | "admin",
        active: u.active === 1,
        createdAt: u.created_at,
      }))}
      userCount={users.filter((u) => u.active === 1).length}
      ordersThisMonth={ordersThisMonth}
      activeToday={activeToday}
      departments={departments}
    />
  );
}
