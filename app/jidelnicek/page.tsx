import {
  getFullMenu,
  getMenuWeekLabel,
  getTodayDayCode,
  getMondayISO,
  getNextMondayISO,
  getMenuDates,
  getClosedDates,
  getAllMenuWeeks,
} from "@/lib/menu";
import { getHolidayName } from "@/lib/holidays";
import { getClosureForDate, getClosureDates } from "@/lib/closures";
import MenuPage from "@/app/components/MenuPage";
import { getSettings } from "@/lib/settings";
import type { MenuItem } from "@/lib/types";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"] as const;

// How far ahead a week may sit and still earn a tab. Without a cap, a closure
// entered for Christmas would grow the tab strip in July.
const HORIZON_WEEKS = 6;

function isoOfWeekday(weekStart: string, index: number): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = new Date(year, month - 1, day + index, 12, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildHolidayMap(weekStart: string): Record<string, string | null> {
  return Object.fromEntries(
    DAY_ORDER.map((dayCode, index) => [dayCode, getHolidayName(isoOfWeekday(weekStart, index))])
  );
}

// Per-day closure label (from settings) for a week — null when the day isn't covered.
// Empty label becomes a generic text so the UI always has something to show.
function buildClosureMap(weekStart: string): Record<string, { label: string; icon: string } | null> {
  return Object.fromEntries(
    DAY_ORDER.map((dayCode, index) => {
      const closure = getClosureForDate(isoOfWeekday(weekStart, index));
      return [dayCode, closure ? { label: closure.label || "Dovolená", icon: closure.icon } : null];
    })
  );
}

export interface WeekClosure {
  label: string;
  icon: string;
  startDate: string;
  endDate: string;
  lastOrderable: string | null;
  reopens: string | null;
}

// A closure is a property of a SPAN, not of a day. When it swallows the whole
// displayed week there is nothing per-day left to say, so the page states it once.
// Returns null unless all five weekdays are covered by the *same* closure.
function buildWeekClosure(weekStart: string): WeekClosure | null {
  const closures = DAY_ORDER.map((_, i) => getClosureForDate(isoOfWeekday(weekStart, i)));
  const first = closures[0];
  if (!first || closures.some((c) => c?.id !== first.id)) return null;

  const closed = new Set(getClosedDates());
  const orderable = getMenuDates().filter((d) => !closed.has(d));
  return {
    label: first.label || "Dovolená",
    icon: first.icon,
    startDate: first.startDate,
    endDate: first.endDate,
    lastOrderable: orderable.filter((d) => d < first.startDate).pop() ?? null,
    reopens: orderable.find((d) => d > first.endDate) ?? null,
  };
}

// "10.–14. 8." — tab label for weeks beyond "příští"
function weekRangeLabel(weekStart: string): string {
  const from = weekStart.split("-").map(Number);
  const to = isoOfWeekday(weekStart, 4).split("-").map(Number);
  if (from[1] === to[1]) return `${from[2]}.–${to[2]}. ${from[1]}.`;
  return `${from[2]}. ${from[1]}. – ${to[2]}. ${to[1]}.`;
}

export interface MenuWeek {
  weekStart: string;
  tabLabel: string;
  weekLabel: string | null;
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  holidayNames: Record<string, string | null>;
  closureLabels: Record<string, { label: string; icon: string } | null>;
  weekClosure: WeekClosure | null;
  hasPdf: boolean;
  isCurrent: boolean;
}

// Which weeks deserve a tab. Current + next are always there (you must be able to
// import into them); anything further only shows up once it holds real data —
// an imported menu or a closure. Otherwise the strip is padded with empty weeks.
function collectWeekStarts(currentWeekStart: string, nextWeekStart: string): string[] {
  const horizon = isoOfWeekday(currentWeekStart, HORIZON_WEEKS * 7);
  const starts = new Set([currentWeekStart, nextWeekStart]);

  for (const week of getAllMenuWeeks()) {
    if (week.weekStart > nextWeekStart && week.weekStart <= horizon) starts.add(week.weekStart);
  }
  for (const iso of getClosureDates()) {
    const monday = getMondayISO(new Date(`${iso}T12:00:00`));
    if (monday > nextWeekStart && monday <= horizon) starts.add(monday);
  }

  return [...starts].sort();
}

export default async function JidelnicekPage() {
  const currentWeekStart = getMondayISO();
  const nextWeekStart = getNextMondayISO();
  const pdfsDir = path.join(process.cwd(), "data", "pdfs");

  const weeks: MenuWeek[] = collectWeekStarts(currentWeekStart, nextWeekStart).map((weekStart) => ({
    weekStart,
    tabLabel:
      weekStart === currentWeekStart ? "Aktuální týden"
      : weekStart === nextWeekStart ? "Příští týden"
      : weekRangeLabel(weekStart),
    weekLabel: getMenuWeekLabel(weekStart),
    menu: getFullMenu(weekStart),
    holidayNames: buildHolidayMap(weekStart),
    closureLabels: buildClosureMap(weekStart),
    weekClosure: buildWeekClosure(weekStart),
    hasPdf: fs.existsSync(path.join(pdfsDir, `${weekStart}.pdf`)),
    isCurrent: weekStart === currentWeekStart,
  }));

  const settings = getSettings();

  return (
    <MenuPage
      defaultMealPrice={parseInt(settings.defaultMealPrice) || 110}
      defaultSoupPrice={parseInt(settings.defaultSoupPrice) || 30}
      todayCode={getTodayDayCode()}
      weeks={weeks}
    />
  );
}
