"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getGlobalDb } from "@/lib/global-db";
import { requireSuperAdmin } from "@/lib/tenant-auth";
import { getTenantDb, evictTenantDb } from "@/lib/tenant-db";

function genJoinCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export async function saCreateTenant(formData: FormData): Promise<{ error?: string }> {
  const admin = await requireSuperAdmin();
  const slug = (formData.get("slug") as string).trim().toLowerCase();
  const displayName = (formData.get("displayName") as string).trim();
  const rawCode = (formData.get("joinCode") as string | null)?.trim().toUpperCase();
  const joinCode = rawCode || genJoinCode();

  if (!SLUG_RE.test(slug)) return { error: "Neplatný slug (a-z, 0-9, pomlčka, začíná písmenem/číslicí)." };
  if (!displayName) return { error: "Název kantýny je povinný." };

  const existing = getGlobalDb().prepare("SELECT id FROM tenants WHERE slug = ?").get(slug);
  if (existing) return { error: `Tenant se slugem "${slug}" již existuje.` };

  getGlobalDb().prepare(
    "INSERT INTO tenants (slug, display_name, join_code) VALUES (?, ?, ?)"
  ).run(slug, displayName, joinCode);

  // Initialize tenant DB (runs all migrations)
  getTenantDb(slug);

  getGlobalDb().prepare(
    "INSERT INTO platform_audit (action, actor_email, tenant_slug, details) VALUES (?, ?, ?, ?)"
  ).run("tenant_created", admin.email, slug, `display_name=${displayName}`);

  revalidatePath("/super-admin");
  return {};
}

export async function saToggleTenant(id: number, active: boolean): Promise<void> {
  const admin = await requireSuperAdmin();
  const tenant = getGlobalDb().prepare("SELECT slug FROM tenants WHERE id = ?").get(id) as { slug: string } | undefined;
  if (!tenant) return;
  getGlobalDb().prepare("UPDATE tenants SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  if (!active) evictTenantDb(tenant.slug);
  getGlobalDb().prepare(
    "INSERT INTO platform_audit (action, actor_email, tenant_slug) VALUES (?, ?, ?)"
  ).run(active ? "tenant_activated" : "tenant_deactivated", admin.email, tenant.slug);
  revalidatePath("/super-admin");
}

export async function saRegenerateJoinCode(id: number): Promise<{ code?: string; error?: string }> {
  await requireSuperAdmin();
  const newCode = genJoinCode();
  const result = getGlobalDb().prepare("UPDATE tenants SET join_code = ? WHERE id = ?").run(newCode, id);
  if (result.changes === 0) return { error: "Tenant nenalezen." };
  revalidatePath("/super-admin");
  return { code: newCode };
}
