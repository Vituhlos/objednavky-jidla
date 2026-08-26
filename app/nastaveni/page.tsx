export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getRecentAuditLog } from "@/lib/audit";
import { getTodayOrderData } from "@/lib/orders";
import SettingsPage from "@/app/components/SettingsPage";
import { getAccountView } from "@/lib/auth/account-view";
import { accountsEnabled } from "@/lib/auth/policy";
import { AccessNotice } from "@/app/components/account/AccessNotice";

export default async function Page() {
  // Nastavení je správce + PIN (R12). PIN zůstává druhým krokem uvnitř stránky,
  // ne obchvatem účtů — chrání před „nechal jsem přihlášený mobil na stole“.
  if (accountsEnabled()) {
    const account = await getAccountView();
    if (!account) {
      return (
        <AccessNotice
          action={{ href: "/ucet/prihlaseni?dalsi=%2Fnastaveni", label: "Přihlásit se" }}
          emoji="🔐"
          text="Nastavení otevře jen přihlášený správce."
          title="Nejdřív se přihlaste"
        />
      );
    }
    if (account.role !== "admin") {
      return (
        <AccessNotice
          action={{ href: "/", label: "Zpět na objednávku" }}
          emoji="🔑"
          text="Nastavení spravuje správce Kantýny. Kdyby něco potřebovalo změnit, ozvěte se mu."
          title="Sem správce nepustil"
        />
      );
    }
  }

  const settings = getSettings();
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
