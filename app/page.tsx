import { getOrderDataForDate, getDeptSuggestions, type DeptSuggestion } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { getMenuWeekLabel, getMenuDates, getMondayISO } from "@/lib/menu";
import { getHolidayName, getHolidayDescription } from "@/lib/holidays";
import { getPragueNow, toLocalISODate } from "@/lib/time";
import { getCurrentUser } from "@/lib/auth";
import OrderPage from "@/app/components/OrderPage";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ date?: string; prefill_main?: string; prefill_soup?: string }> }) {
  const params = await searchParams;
  const pragueNow = getPragueNow();
  const todayISO = toLocalISODate(pragueNow);

  const tomorrowDate = new Date(pragueNow);
  tomorrowDate.setDate(pragueNow.getDate() + 1);
  const tomorrowISO = toLocalISODate(tomorrowDate);

  const menuDates = getMenuDates();
  const allDates = [...new Set([todayISO, ...menuDates.filter((d) => d >= todayISO)])].sort();

  const isAfterNoon = pragueNow.getHours() >= 12;
  const autoDate = isAfterNoon && menuDates.includes(tomorrowISO) ? tomorrowISO : todayISO;
  const selectedDate = params.date && allDates.includes(params.date) ? params.date : autoDate;

  const data = getOrderDataForDate(selectedDate);
  const s = getSettings();
  const currentUser = await getCurrentUser();

  const suggestions: Record<string, DeptSuggestion[]> = Object.fromEntries(
    data.departments.map((d) => [d.name, getDeptSuggestions(d.name, 4)])
  );

  const prefillMain = params.prefill_main ? Number(params.prefill_main) : null;
  const prefillSoup = params.prefill_soup ? Number(params.prefill_soup) : null;

  const selectedWeekStart = getMondayISO(new Date(`${selectedDate}T12:00:00`));
  const menuEmpty = getMenuWeekLabel(selectedWeekStart) === null;
  const holidayName = getHolidayName(selectedDate);
  const holidayDescription = getHolidayDescription(holidayName);

  return (
    <OrderPage
      availableDates={allDates}
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
      autoSendError={s.autoSendLastError && s.autoSendErrorAcked !== "true" ? s.autoSendLastError : undefined}
      autoSendErrorTs={s.autoSendLastErrorTs || undefined}
      suggestions={suggestions}
      prefillMain={prefillMain && Number.isFinite(prefillMain) ? prefillMain : null}
      prefillSoup={prefillSoup && Number.isFinite(prefillSoup) ? prefillSoup : null}
      currentUserId={currentUser?.id}
      isAdmin={currentUser?.role === "admin"}
      currentUserName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}
    />
  );
}
