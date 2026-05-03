export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getRecentAuditLog } from "@/lib/audit";
import { getTodayOrderData } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SettingsPage from "@/app/components/SettingsPage";

export default async function Page() {
  const settings = getSettings();
  const departments = getDepartments();
  const auditLog = getRecentAuditLog(200);
  const todayData = getTodayOrderData();
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  return (
    <SettingsPage
      auditLog={auditLog}
      departments={departments}
      isAdmin={currentUser?.role === "admin"}
      settings={settings}
      todayOrder={{ id: todayData.order.id, status: todayData.order.status }}
    />
  );
}
