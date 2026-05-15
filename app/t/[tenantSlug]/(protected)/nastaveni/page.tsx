export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { requireTenantAdmin, TenantAuthError } from "@/lib/tenant-auth";
import { redirect } from "next/navigation";
import TenantSettingsPage from "@/app/components/TenantSettingsPage";

export default async function TenantSettingsRoute({
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

  return (
    <TenantSettingsPage
      departments={departments}
      settings={settings}
      tenantSlug={tenantSlug}
    />
  );
}
