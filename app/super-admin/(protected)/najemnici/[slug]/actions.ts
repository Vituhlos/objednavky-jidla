"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/tenant-auth";
import { getTenantDb } from "@/lib/tenant-db";
import { getGlobalDb } from "@/lib/global-db";

export async function saSetTenantUserRole(
  tenantSlug: string,
  userId: number,
  role: "user" | "admin"
): Promise<{ error?: string }> {
  const actor = await requireSuperAdmin();
  const db = getTenantDb(tenantSlug);

  if (role === "user") {
    const { c } = db
      .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1 AND id != ?")
      .get(userId) as { c: number };
    if (c === 0) return { error: "Kantýna musí mít aspoň jednoho admina." };
  }

  const target = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);

  getGlobalDb().prepare(
    "INSERT INTO platform_audit (action, actor_email, tenant_slug, details) VALUES (?, ?, ?, ?)"
  ).run("sa_tenant_user_role", actor.email, tenantSlug, `userId=${userId},role=${role},email=${target?.email ?? "?"}`);

  revalidatePath(`/super-admin/najemnici/${tenantSlug}`);
  return {};
}
