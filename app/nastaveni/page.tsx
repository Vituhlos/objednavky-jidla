export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { getDepartments } from "@/lib/departments";
import { getRecentAuditLog } from "@/lib/audit";
import { getTodayOrderData } from "@/lib/orders";
import SettingsPage from "@/app/components/SettingsPage";
import { getAccountView } from "@/lib/auth/account-view";
import { accountsEnabled } from "@/lib/auth/policy";

export default async function Page() {
  // Nastavení otevře správce, nebo kdokoli se správným PINem.
  //
  // PIN zůstává zádními vrátky záměrně: kdyby se přihlašování rozbilo, je to
  // jediná cesta zpátky — a bez Nastavení nejde spravit ani SMTP, přes které
  // se obnovuje heslo. Odchyluje se to od R12, které chtělo PIN až jako druhý
  // krok; rozhodnuto vědomě, dokud si účty nesednou.
  //
  // Cena je reálná: na veřejné adrese stačí uhodnout PIN a člověk má zálohu
  // celé databáze. Proto se vstup bez správcovského účtu zapisuje do auditu
  // a stránka na něj upozorňuje.
  const account = accountsEnabled() ? await getAccountView() : null;
  const jenPin = accountsEnabled() && account?.role !== "admin";

  const settings = getSettings();
  const departments = getDepartments();
  const auditLog = getRecentAuditLog(200);
  const todayData = getTodayOrderData();
  return (
    <SettingsPage
      auditLog={auditLog}
      pinOnly={jenPin}
      departments={departments}
      settings={settings}
      todayOrder={{ id: todayData.order.id, status: todayData.order.status }}
    />
  );
}
