// Logika jídelníčku.
//
// `DAY_ORDER`, `DAY_LABELS` a `resolveActiveDay` jsou shodné s větví
// feat/heroui-migration. Zbytek je navíc: heroui má místo `describeDay`
// bohatší `menu-summary.ts` se `summarizeDay()`, protože tam stránka umí
// přehled celého týdne („je týden kompletní?"), který tady není.
//
// ⚠️ Při slučování pozor na pořadí, co přebíjí co: `summarizeDay` dává
// přednost svátku a uzavírce před položkami, zdejší `describeDay` se ptá
// jen na položky a svátek se řeší až v JSX. Pro den, který má svátek
// *a zároveň* zadaná jídla, se ty dvě verze rozejdou.

import type { MenuItem } from "@/lib/types";

export const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"] as const;

export const DAY_LABELS: Record<string, string> = {
  Po: "Pondělí",
  Út: "Úterý",
  St: "Středa",
  Čt: "Čtvrtek",
  Pá: "Pátek",
};

export type DayMenu = { soups: MenuItem[]; meals: MenuItem[] };
export type WeekMenu = Record<string, DayMenu>;

export function resolveActiveDay(
  menu: WeekMenu,
  visibleTodayCode: string | null,
  currentDay?: string,
): string {
  if (currentDay && menu[currentDay]) return currentDay;
  if (visibleTodayCode && menu[visibleTodayCode]) return visibleTodayCode;
  return DAY_ORDER.find((day) => menu[day]) ?? DAY_ORDER[0];
}

export interface DayView {
  /** Den je uzavřený — nese *jen* zástupné položky „Zavřeno". */
  isClosed: boolean;
  /** Položky bez zástupných „Zavřeno", tedy to, co se opravdu vypisuje. */
  soups: MenuItem[];
  meals: MenuItem[];
  hasItems: boolean;
}

/**
 * Rozpad jednoho dne na to, co stránka potřebuje vědět.
 *
 * Uzavřený den se v databázi nepozná příznakem, ale zástupnou položkou
 * s názvem „Zavřeno" (zakládá ji `lib/menu.ts`). Rozdíl mezi „zavřeno"
 * a „ještě nezadáno" je tedy jen v tom, jestli tam ta zástupná položka je —
 * a prázdný den se za zavřený nepovažuje.
 */
export function describeDay(dayMenu: DayMenu | undefined): DayView {
  const { soups = [], meals = [] } = dayMenu ?? {};
  const isClosed =
    soups.length + meals.length > 0 &&
    [...soups, ...meals].every((item) => item.name === "Zavřeno");

  const visibleSoups = soups.filter((item) => item.name !== "Zavřeno");
  const visibleMeals = meals.filter((item) => item.name !== "Zavřeno");

  return {
    isClosed,
    soups: visibleSoups,
    meals: visibleMeals,
    hasItems: visibleSoups.length + visibleMeals.length > 0,
  };
}

/** Čísla dnů v měsíci pro záhlaví karet, Po–Pá od pondělí daného týdne. */
export function weekDayDates(weekStart: string): Record<string, number> {
  const base = new Date(`${weekStart}T00:00:00`);
  const dates: Record<string, number> = {};

  DAY_ORDER.forEach((day, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    dates[day] = date.getDate();
  });

  return dates;
}

/**
 * Skloňovaný název týdne do potvrzení mazání.
 *
 * Mazat jde každý týden, který není aktuální — ne jen ten příští — takže
 * popisek musí umět obojí: „příští týden" i „týden 32".
 */
export function describeWeekName(tabLabel: string): string {
  return tabLabel === "Příští týden" ? "příští týden" : `týden ${tabLabel}`;
}
