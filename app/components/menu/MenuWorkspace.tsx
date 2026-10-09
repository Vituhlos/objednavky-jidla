"use client";

import type { MenuWeek } from "@/app/jidelnicek/page";
import { useRef, useState } from "react";
import { useSlidingPill } from "../useSlidingPill";
import { useDaySwipe } from "../order/useDaySwipe";
import type { MenuItem } from "@/lib/types";
import { MenuDaySection } from "./MenuDaySection";
import { WeekClosurePanel } from "./WeekClosurePanel";
import { WeekGrid } from "./WeekGrid";
import { DAY_ORDER, weekDayDates, type WeekMenu } from "./menu-utils";

interface MenuWorkspaceProps {
  activeWeekData: MenuWeek;
  activeWeekStart: string;
  activeMenu: WeekMenu;
  activeDay: string;
  visibleTodayCode: string | null;
  editMode: boolean;
  isPending: boolean;
  onSelectDay: (day: string) => void;
  onAdd: (day: string, type: "Polévka" | "Jídlo") => void;
  onEdit: (item: MenuItem) => void;
  onCloseDay: (day: string) => void;
  onOpenDay: (day: string) => void;
}

/**
 * Pracovní plocha týdne: přepínač dnů, desktopový rošt a mobilní detail dne.
 *
 * Zavřený celý týden plochu nahrazuje — pět stejných karet „Zavřeno" by řeklo
 * jednu věc pětkrát, tak ji `WeekClosurePanel` řekne jednou.
 *
 * Desktop a mobil renderují jiné komponenty (`WeekGrid` vs `MenuDaySection`)
 * a přepíná mezi nimi CSS, ne JS — obojí je tedy v DOM. Větev
 * feat/heroui-migration tohle rozdvojení nemá, tam je accordion pro obojí.
 */
export function MenuWorkspace({
  activeWeekData,
  activeWeekStart,
  activeMenu,
  activeDay,
  visibleTodayCode,
  editMode,
  isPending,
  onSelectDay,
  onAdd,
  onEdit,
  onCloseDay,
  onOpenDay,
}: MenuWorkspaceProps) {
  // Hooky musí být před předčasným návratem níž.
  const dayTrackRef = useSlidingPill<HTMLDivElement>(activeDay);
  const mobileRef = useRef<HTMLDivElement>(null);
  const [dayDirection, setDayDirection] = useState<"next" | "prev">("next");
  const dayCodes: readonly string[] = DAY_ORDER;
  const dayIndex = dayCodes.indexOf(activeDay);
  const selectDay = (day: typeof activeDay) => {
    setDayDirection(dayCodes.indexOf(day) >= dayIndex ? "next" : "prev");
    onSelectDay(day);
  };
  useDaySwipe(mobileRef, {
    enabled: !activeWeekData.weekClosure,
    onPrev: () => { if (dayIndex > 0) selectDay(DAY_ORDER[dayIndex - 1]); },
    onNext: () => { if (dayIndex >= 0 && dayIndex < DAY_ORDER.length - 1) selectDay(DAY_ORDER[dayIndex + 1]); },
  });
  if (activeWeekData.weekClosure) {
    return <WeekClosurePanel closure={activeWeekData.weekClosure} />;
  }

  const dayDates = weekDayDates(activeWeekStart);
  const { soups = [], meals = [] } = activeMenu[activeDay] ?? {};

  return (
    <>
      {/* Dny — jen mobil. Jeden pás přes celou šířku, stejný tvar jako přepínač
          týdnů nad ním a dnů v objednávkách. Dnešek je popsaný slovem; tečka,
          která ho značila dřív, se pletla s označením vybraného dne. */}
      <div className="md:hidden px-4 pt-1 pb-2 shrink-0">
        <div
          className="grid grid-cols-5 gap-0.5 p-1 rounded-2xl"
          ref={dayTrackRef}
          style={{ background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
        >
          {DAY_ORDER.map((day) => {
            const active = activeDay === day;
            const isToday = day === visibleTodayCode;
            const hasData = !!activeMenu[day];
            return (
              <button
                aria-current={active ? "date" : undefined}
                className={`relative isolate min-w-0 min-h-[48px] flex flex-col items-center justify-center rounded-xl active:scale-[0.96] transition-opacity ${!hasData && !active ? "opacity-45" : ""}`}
                data-pill-key={day}
                key={day}
                onClick={() => selectDay(day)}
                type="button"
              >
                {active && <span aria-hidden="true" className="day-pill" data-pill />}
                <span className={`text-[11px] font-bold uppercase tracking-wide leading-none transition-colors ${active ? "text-white/85" : isToday ? "text-amber-700" : "text-stone-500"}`}>
                  {isToday ? "Dnes" : day}
                </span>
                <span className={`font-display font-bold text-[15px] leading-tight mt-0.5 transition-colors ${active ? "text-white" : "text-stone-700"}`}>{dayDates[day]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop: full week grid */}
      <div className="hidden md:block flex-1 overflow-y-auto scroll-area px-5 pb-8 pt-5">
        <WeekGrid
          closureLabels={activeWeekData.closureLabels}
          dayDates={dayDates}
          disabled={isPending}
          editMode={editMode}
          holidayNames={activeWeekData.holidayNames}
          menu={activeMenu}
          onAdd={onAdd}
          onCloseDay={onCloseDay}
          onEdit={onEdit}
          onOpenDay={onOpenDay}
          todayCode={visibleTodayCode}
          weekStart={activeWeekStart}
        />
      </div>

      {/* Mobile: single day view */}
      {/* Mezi dny jde listovat přejetím do strany; den vjede ze strany posunu. */}
      <div className="md:hidden flex-1 overflow-y-auto scroll-area px-4 pb-nav" ref={mobileRef}>
        <div className={`day-in day-in--${dayDirection}`} key={`${activeWeekStart}-${activeDay}`}>
        <MenuDaySection
          closure={activeWeekData.closureLabels[activeDay] ?? null}
          day={activeDay}
          disabled={isPending}
          editMode={editMode}
          holidayName={activeWeekData.holidayNames[activeDay] ?? null}
          meals={meals}
          onAdd={onAdd}
          onCloseDay={onCloseDay}
          onEdit={onEdit}
          onOpenDay={onOpenDay}
          soups={soups}
        />
        </div>
      </div>
    </>
  );
}
