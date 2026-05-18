import { getGlobalDb } from "@/lib/global-db";
import { getTenantDb } from "@/lib/tenant-db";
import TenantManager from "../TenantManager";

export const dynamic = "force-dynamic";

interface TenantRow {
  id: number;
  slug: string;
  display_name: string;
  join_code: string;
  active: number;
  created_at: string;
  city: string;
  plan: string;
}

function getTenantUserCount(slug: string): number {
  try {
    const db = getTenantDb(slug);
    const { count } = db.prepare("SELECT COUNT(*) as count FROM users WHERE active = 1").get() as { count: number };
    return count;
  } catch {
    return 0;
  }
}

export default function NajemniciPage() {
  const rows = getGlobalDb()
    .prepare("SELECT id, slug, display_name, join_code, active, created_at, city, plan FROM tenants ORDER BY created_at DESC")
    .all() as TenantRow[];

  const tenants = rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    displayName: t.display_name,
    joinCode: t.join_code,
    active: t.active === 1,
    createdAt: t.created_at,
    userCount: getTenantUserCount(t.slug),
    city: t.city ?? "",
    plan: t.plan ?? "standard",
  }));

  return <TenantManager tenants={tenants} />;
}
