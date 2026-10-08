"use client";

import type { MenuWeek } from "@/app/jidelnicek/page";
import { useSlidingPill } from "../useSlidingPill";
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
  // Hook musí být před předčasným návratem níž.
  const dayTrackRef = useSlidingPill<HTMLDivElement>(activeDay);
  if (activeWeekData.weekClosure) {
    return <WeekClosurePanel closure={activeWeekData.weekClosure} />;
  }

  const dayDates = weekDayDates(activeWeekStart);
  const { soups = [], meals = [] } = activeMenu[activeDay] ?? {};

  return (
    <>
      {/* Day tabs — mobile only */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-2 shrink-0" ref={dayTrackRef}>
        {DAY_ORDER.map((day) => {
          const active = activeDay === day;
          const isToday = day === visibleTodayCode;
          const hasData = !!activeMenu[day];
          return (
            <button
              key={day}
              className={`relative isolate shrink-0 flex flex-col items-center px-3 py-2 rounded-xl active:scale-[0.95] transition ${!hasData && !active ? "opacity-40" : ""}`}
              data-pill-key={day}
              onClick={() => onSelectDay(day)}
              /* Pozadí mají všechny dny stejné; vybraný ho překrývá pilulkou, která mezi dny klouže. */
              style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)" }}
              type="button"
            >
              {active && <span aria-hidden="true" className="day-pill" data-pill />}
              <span className={`text-[11px] font-bold uppercase tracking-wide leading-none ${active ? "text-white/80" : "text-stone-500"}`}>{day}</span>
              <span className={`font-display font-bold text-[14px] leading-tight mt-0.5 ${active ? "text-white" : "text-stone-700"}`}>{dayDates[day]}</span>
              {isToday && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: active ? "rgba(255,255,255,0.8)" : "#F59E0B" }} />}
            </button>
          );
        })}
      </div>

      {/* Desktop: full week grid */}
      <div className="hidden md:block flex-1 overflow-y-auto scroll-area px-4 pb-8 pt-3">
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
      <div className="md:hidden flex-1 overflow-y-auto scroll-area px-4 pb-nav">
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
    </>
  );
}
