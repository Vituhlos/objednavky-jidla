import { getFullMenu, getMenuWeekLabel, getTodayDayCode, getMondayISO, getNextMondayISO } from "@/lib/menu";
import { getHolidayName } from "@/lib/holidays";
import MenuPage from "@/app/components/MenuPage";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"] as const;

function buildHolidayMap(weekStart: string): Record<string, string | null> {
  const [year, month, day] = weekStart.split("-").map(Number);
  const monday = new Date(year, month - 1, day, 12, 0, 0);
  return Object.fromEntries(
    DAY_ORDER.map((dayCode, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return [dayCode, getHolidayName(iso)];
    })
  );
}

export default async function JidelnicekPage() {
  const currentWeekStart = getMondayISO();
  const nextWeekStart = getNextMondayISO();

  const currentMenu = getFullMenu(currentWeekStart);
  const currentWeekLabel = getMenuWeekLabel(currentWeekStart);
  const nextMenu = getFullMenu(nextWeekStart);
  const nextWeekLabel = getMenuWeekLabel(nextWeekStart);
  const todayCode = getTodayDayCode();
  const currentHolidayNames = buildHolidayMap(currentWeekStart);
  const nextHolidayNames = buildHolidayMap(nextWeekStart);

  const pdfsDir = path.join(process.cwd(), "data", "pdfs");
  const hasPdfCurrent = fs.existsSync(path.join(pdfsDir, `${currentWeekStart}.pdf`));
  const hasPdfNext = fs.existsSync(path.join(pdfsDir, `${nextWeekStart}.pdf`));

  return (
    <MenuPage
      currentMenu={currentMenu}
      currentWeekLabel={currentWeekLabel}
      currentWeekStart={currentWeekStart}
      currentHolidayNames={currentHolidayNames}
      hasPdfCurrent={hasPdfCurrent}
      hasPdfNext={hasPdfNext}
      nextMenu={nextMenu}
      nextHolidayNames={nextHolidayNames}
      nextWeekLabel={nextWeekLabel}
      nextWeekStart={nextWeekStart}
      todayCode={todayCode}
    />
  );
}
