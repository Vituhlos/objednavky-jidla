import { redirect, notFound } from "next/navigation";
import { requireSuperAdmin, TenantAuthError } from "@/lib/tenant-auth";
import { getGlobalDb } from "@/lib/global-db";
import { getTenantDb } from "@/lib/tenant-db";
import TenantUsersRescue from "./TenantUsersRescue";

export const dynamic = "force-dynamic";

export default async function TenantUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/super-admin/login");
    throw e;
  }

  const { slug } = await params;

  const tenant = getGlobalDb()
    .prepare("SELECT slug, display_name FROM tenants WHERE slug = ?")
    .get(slug) as { slug: string; display_name: string } | undefined;
  if (!tenant) notFound();

  const rows = getTenantDb(slug)
    .prepare("SELECT id, email, first_name, last_name, role, active, created_at FROM users ORDER BY role DESC, first_name ASC")
    .all() as { id: number; email: string; first_name: string; last_name: string; role: string; active: number; created_at: string }[];

  const users = rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role as "user" | "admin",
    active: r.active === 1,
    joinedAt: r.created_at,
  }));

  return <TenantUsersRescue tenantName={tenant.display_name} tenantSlug={slug} users={users} />;
}
