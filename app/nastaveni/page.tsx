export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getRecentAuditLog } from "@/lib/audit";
import { getTodayOrderData } from "@/lib/orders";
import SettingsPage from "@/app/components/SettingsPage";
import { getAppSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";

export default async function Page() {
  const session = await getAppSession();
  if (!session || session.user.role !== "admin") {
    redirect("/profil?denied=admin");
  }

  const settings = getSettings();
  const departments = getDepartments();
  const auditLog = getRecentAuditLog(200);
  const todayData = getTodayOrderData();
  const appUsers = listUsers();
  return (
    <SettingsPage
      auditLog={auditLog}
      departments={departments}
      settings={settings}
      todayOrder={{ id: todayData.order.id, status: todayData.order.status }}
      adminUnlocked
      appUsers={appUsers}
      currentUserId={session.userId}
    />
  );
}
