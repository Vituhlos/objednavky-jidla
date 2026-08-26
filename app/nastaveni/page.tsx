export const dynamic = "force-dynamic";

import { getSettingsForClient } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getRecentAuditLog } from "@/lib/audit";
import { getTodayOrderData } from "@/lib/orders";
import SettingsPage from "@/app/components/SettingsPage";
import { requireAdmin } from "@/lib/auth/guards";

export default async function Page() {
  await requireAdmin();

  // Tajemství jsou write-only. PIN brána je klientská, takže celý objekt by se
  // jinak dostal do RSC odpovědi ještě před jejím zobrazením.
  const settings = getSettingsForClient();
  const departments = getDepartments();
  const auditLog = getRecentAuditLog(200);
  const todayData = getTodayOrderData();
  return (
    <SettingsPage
      auditLog={auditLog}
      departments={departments}
      settings={settings}
      todayOrder={{ id: todayData.order.id, status: todayData.order.status }}
    />
  );
}
