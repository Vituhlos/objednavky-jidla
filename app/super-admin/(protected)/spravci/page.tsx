import { redirect } from "next/navigation";
import { requireSuperAdmin, TenantAuthError } from "@/lib/tenant-auth";
import { getGlobalDb } from "@/lib/global-db";
import SpravciManager from "./SpravciManager";

export const dynamic = "force-dynamic";

export default async function SpravciPage() {
  let currentAdmin;
  try {
    currentAdmin = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/super-admin/login");
    throw e;
  }

  const rows = getGlobalDb()
    .prepare("SELECT id, email, created_at FROM super_admins ORDER BY created_at ASC")
    .all() as { id: number; email: string; created_at: string }[];

  const admins = rows.map((r) => ({
    id: r.id,
    email: r.email,
    createdAt: r.created_at,
    isSelf: r.id === currentAdmin.id,
  }));

  return <SpravciManager admins={admins} />;
}
