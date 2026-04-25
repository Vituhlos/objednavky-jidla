export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getRecentAuditLog } from "@/lib/audit";
import SettingsPage from "@/app/components/SettingsPage";

export default function Page() {
  const settings = getSettings();
  const departments = getDepartments();
  const auditLog = getRecentAuditLog(200);
  return <SettingsPage auditLog={auditLog} departments={departments} settings={settings} />;
}
