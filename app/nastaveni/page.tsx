export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import SettingsPage from "@/app/components/SettingsPage";

export default function Page() {
  const settings = getSettings();
  const departments = getDepartments();
  return <SettingsPage departments={departments} settings={settings} />;
}
