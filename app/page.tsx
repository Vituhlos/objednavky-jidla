import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getGlobalDb } from "@/lib/global-db";
import { getSuperAdminByToken, SA_COOKIE_NAME } from "@/lib/tenant-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Žádní tenanti = první spuštění → rovnou na setup super-admina
  const { count: tenantCount } = getGlobalDb()
    .prepare("SELECT COUNT(*) as count FROM tenants")
    .get() as { count: number };
  if (tenantCount === 0) redirect("/super-admin/login");

  // Přihlášený super-admin → rovnou na dashboard
  const jar = await cookies();
  const saToken = jar.get(SA_COOKIE_NAME)?.value;
  if (saToken && getSuperAdminByToken(saToken)) redirect("/super-admin/najemnici");

  // V multi-tenant módu root nemá obsah — uživatelé se připojují přes /join
  redirect("/join");
}
