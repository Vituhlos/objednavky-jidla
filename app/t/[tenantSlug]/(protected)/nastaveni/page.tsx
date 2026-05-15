export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getRecentAuditLog } from "@/lib/audit";
import { getTodayOrderData } from "@/lib/orders";
import { requireTenantAdmin, TenantAuthError } from "@/lib/tenant-auth";
import { redirect } from "next/navigation";
import SettingsPage from "@/app/components/SettingsPage";

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  try {
    await requireTenantAdmin(tenantSlug);
  } catch (e) {
    if (e instanceof TenantAuthError) redirect(`/t/${tenantSlug}`);
    throw e;
  }

  const settings = getSettings();
  const departments = getDepartments();
  const auditLog = getRecentAuditLog(200);
  const todayData = getTodayOrderData();

  return (
    <SettingsPage
      auditLog={auditLog}
      departments={departments}
      isAdmin={true}
      settings={settings}
      todayOrder={{ id: todayData.order.id, status: todayData.order.status }}
      apiBase={`/t/${tenantSlug}`}
    />
  );
}
