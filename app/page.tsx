import { getOrderDataForDate } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { getMenuWeekLabel, getMenuDates, getClosedDates, getMondayISO, withOrderableBounds } from "@/lib/menu";
import { getClosures, getClosureForDate, getUpcomingClosure } from "@/lib/closures";
import { getHolidayName, getHolidayDescription } from "@/lib/holidays";
import { getPragueNow, toLocalISODate } from "@/lib/time";
import { redirect } from "next/navigation";
import OrderPage from "@/app/components/OrderPage";
import { getAccountView } from "@/lib/auth/account-view";
import { accountsEnabled } from "@/lib/auth/policy";

export const dynamic = "force-dynamic";

/**
 * Kam poslat návštěvníka podle stavu, se kterým se vrátil od Googlu.
 *
 * Callback umí přesměrovat jen na jedno místo, takže stav přichází v adrese.
 * Tady se přeloží na obrazovku a z adresy zmizí — nemá smysl, aby ve historii
 * prohlížeče zůstávalo visící ?auth=.
 */
const GOOGLE_STAVY: Record<string, string> = {
  "google-link-required": "/ucet/propojit-google",
  "google-failed": "/ucet/prihlaseni?chyba=google",
  blocked: "/ucet/blokovano",
  "google-ok": "/",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; auth?: string }>;
}) {
  const params = await searchParams;

  if (params.auth) {
    const cil = GOOGLE_STAVY[params.auth] ?? "/";
    redirect(cil);
  }

  const pragueNow = getPragueNow();
  const todayISO = toLocalISODate(pragueNow);

  const tomorrowDate = new Date(pragueNow);
  tomorrowDate.setDate(pragueNow.getDate() + 1);
  const tomorrowISO = toLocalISODate(tomorrowDate);

  const menuDates = getMenuDates();
  const allDates = [...new Set([todayISO, ...menuDates.filter((d) => d >= todayISO)])].sort();

  // Closed days that fall inside the span of the day picker — these fill the gap
  // that would otherwise look like an unexplained jump (např. Zítra → Po 10.8.).
  const lastDate = allDates[allDates.length - 1];
  const closedDates = getClosedDates().filter((d) => d >= todayISO && d <= lastDate);

  const isAfterNoon = pragueNow.getHours() >= 12;
  const autoDate = isAfterNoon && menuDates.includes(tomorrowISO) ? tomorrowISO : todayISO;
  const selectedDate = params.date && allDates.includes(params.date) ? params.date : autoDate;

  const data = getOrderDataForDate(selectedDate);
  const s = getSettings();

  // Dokud účty nikdo nezaložil, chová se appka jako dřív — jinak by upgrade
  // zamkl objednávání všem najednou.
  const account = await getAccountView();
  const canEdit = !accountsEnabled() || account !== null;
  const canManage = !accountsEnabled() || account?.role === "admin";

  const selectedWeekStart = getMondayISO(new Date(`${selectedDate}T12:00:00`));
  const menuEmpty = getMenuWeekLabel(selectedWeekStart) === null;
  const holidayName = getHolidayName(selectedDate);
  const holidayDescription = getHolidayDescription(holidayName);
  const selectedClosure = getClosureForDate(selectedDate);
  const upcomingClosure = getUpcomingClosure(todayISO);

  return (
    <OrderPage
      availableDates={allDates}
      canEdit={canEdit}
      canManage={canManage}
      closedDates={closedDates}
      activeClosure={selectedClosure ? withOrderableBounds(selectedClosure) : null}
      closureRanges={getClosures().map((c) => ({ startDate: c.startDate, endDate: c.endDate, icon: c.icon }))}
      upcomingClosure={upcomingClosure}
      holidayName={holidayName}
      holidayDescription={holidayDescription}
      cutoffTime={s.cutoffTime}
      defaultMealPrice={parseInt(s.defaultMealPrice) || 110}
      defaultSoupPrice={parseInt(s.defaultSoupPrice) || 30}
      extrasPrices={{
        roll: parseInt(s.priceRoll) || 5,
        breadDumpling: parseInt(s.priceBreadDumpling) || 40,
        potatoDumpling: parseInt(s.pricePotatoDumpling) || 45,
        ketchup: parseInt(s.priceKetchup) || 20,
        tatarka: parseInt(s.priceTatarka) || 20,
        bbq: parseInt(s.priceBbq) || 20,
      }}
      initialData={data}
      menuEmpty={menuEmpty}
      selectedDate={selectedDate}
      todayDate={todayISO}
      autoSendEnabled={s.autoSendEnabled === "true"}
      autoSendTime={s.autoSendTime}
      autoSendError={s.autoSendLastError && s.autoSendErrorAcked !== "true" ? s.autoSendLastError : undefined}
      autoSendErrorTs={s.autoSendLastErrorTs || undefined}
      forceOpenAt={s.orderForceOpenAt}
    />
  );
}
