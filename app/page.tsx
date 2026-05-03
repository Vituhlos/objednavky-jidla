import { getOrderDataForDate } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { getMenuWeekLabel, getMenuDates, getMondayISO } from "@/lib/menu";
import { getHolidayName, getHolidayDescription } from "@/lib/holidays";
import { getPragueNow, toLocalISODate } from "@/lib/time";
import { getCurrentUser } from "@/lib/auth";
import OrderPage from "@/app/components/OrderPage";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
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
      currentUserId={currentUser?.id}
      isAdmin={currentUser?.role === "admin"}
      currentUserName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}
    />
  );
}
