"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenant-db";
import { getGlobalDb } from "@/lib/global-db";
import { requireTenantAdmin } from "@/lib/tenant-auth";
import crypto from "crypto";

export async function actionChangeUserRole(
  tenantSlug: string,
  userId: number,
  role: "user" | "admin"
): Promise<{ error?: string }> {
  try {
    await requireTenantAdmin(tenantSlug);
    getTenantDb(tenantSlug)
      .prepare("UPDATE users SET role = ? WHERE id = ?")
      .run(role, userId);
    revalidatePath(`/t/${tenantSlug}/admin`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Chyba" };
  }
}

export async function actionAnonymizeUser(
  tenantSlug: string,
  userId: number
): Promise<{ error?: string }> {
  try {
    await requireTenantAdmin(tenantSlug);
    const suffix = crypto.randomBytes(4).toString("hex");
    getTenantDb(tenantSlug)
      .prepare(
        "UPDATE users SET first_name = 'Anonymní', last_name = 'uživatel', email = ?, active = 0, role = 'user' WHERE id = ?"
      )
      .run(`smazany_${suffix}@anonymized.cz`, userId);
    revalidatePath(`/t/${tenantSlug}/admin`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Chyba" };
  }
}

export async function actionRegenerateJoinCode(
  tenantSlug: string
): Promise<{ code?: string; error?: string }> {
  try {
    await requireTenantAdmin(tenantSlug);
    const code = `${tenantSlug.toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    getGlobalDb()
      .prepare("UPDATE tenants SET join_code = ? WHERE slug = ?")
      .run(code, tenantSlug);
    revalidatePath(`/t/${tenantSlug}/admin`);
    return { code };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Chyba" };
  }
}
