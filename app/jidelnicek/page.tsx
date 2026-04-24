import { getFullMenu, getMenuWeekLabel, getTodayDayCode, getMondayISO, getNextMondayISO } from "@/lib/menu";
import MenuPage from "@/app/components/MenuPage";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export default async function JidelnicekPage() {
  const currentWeekStart = getMondayISO();
  const nextWeekStart = getNextMondayISO();

  const currentMenu = getFullMenu(currentWeekStart);
  const currentWeekLabel = getMenuWeekLabel(currentWeekStart);
  const nextMenu = getFullMenu(nextWeekStart);
  const nextWeekLabel = getMenuWeekLabel(nextWeekStart);
  const todayCode = getTodayDayCode();

  const pdfsDir = path.join(process.cwd(), "data", "pdfs");
  const hasPdfCurrent = fs.existsSync(path.join(pdfsDir, `${currentWeekStart}.pdf`));
  const hasPdfNext = fs.existsSync(path.join(pdfsDir, `${nextWeekStart}.pdf`));

  return (
    <MenuPage
      currentMenu={currentMenu}
      currentWeekLabel={currentWeekLabel}
      currentWeekStart={currentWeekStart}
      hasPdfCurrent={hasPdfCurrent}
      hasPdfNext={hasPdfNext}
      nextMenu={nextMenu}
      nextWeekLabel={nextWeekLabel}
      nextWeekStart={nextWeekStart}
      todayCode={todayCode}
    />
  );
}
