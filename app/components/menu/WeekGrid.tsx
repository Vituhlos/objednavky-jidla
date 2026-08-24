"use client";

import { memo } from "react";
import { getHolidayEmoji } from "@/lib/holidays";
import type { MenuItem } from "@/lib/types";
import MIcon from "../MIcon";
import { MenuItemRow } from "./MenuItemRow";
import { DAY_LABELS, DAY_ORDER, describeDay, type WeekMenu } from "./menu-utils";

/**
 * Celý pracovní týden vedle sebe — desktopové zobrazení.
 *
 * Větev feat/heroui-migration tenhle soubor nemá: tam pět dnů pod sebou
 * nahradil accordion, který se chová stejně na desktopu i na mobilu, a obsah
 * dne renderuje jediná `MenuDaySection`. Tady rošt zůstává, takže se den sází
 * dvakrát — kompaktně sem a naplno do `MenuDaySection` na mobilu.
 */
export const WeekGrid = memo(function WeekGrid({
  menu, dayDates, todayCode, holidayNames, closureLabels, editMode, disabled, weekStart, onAdd, onEdit, onCloseDay, onOpenDay,
}: {
  menu: WeekMenu;
  dayDates: Record<string, number>;
  todayCode: string | null;
  holidayNames: Record<string, string | null>;
  closureLabels: Record<string, { label: string; icon: string } | null>;
  editMode: boolean;
  disabled: boolean;
  weekStart: string;
  onAdd: (day: string, type: "Polévka" | "Jídlo") => void;
  onEdit: (item: MenuItem) => void;
  onCloseDay: (day: string) => void;
  onOpenDay: (day: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-3 items-start">
      {DAY_ORDER.map((day) => {
        const isToday = day === todayCode;
        const holidayName = holidayNames[day];
        const dayClosure = closureLabels[day];
        const closureLabel = dayClosure?.label ?? null;
        const holidayEmoji = getHolidayEmoji(holidayName);
        const { isClosed, soups: displaySoups, meals: displayMeals, hasItems } = describeDay(menu[day]);
        return (
          <div
            key={day}
            className="glass-card rounded-3xl overflow-hidden"
            style={isToday ? {
              borderColor: "rgba(245,158,11,0.38)",
              boxShadow: "0 8px 32px -8px rgba(245,158,11,0.22)",
            } : {}}
          >
            {/* Day header */}
            <div className="px-3 pt-3 pb-2.5 border-b border-white/40">
              <div className="flex items-start justify-between gap-1">
                <span className="font-display font-extrabold text-[28px] leading-none text-stone-950">{dayDates[day]}</span>
                {isToday && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white mt-1 shrink-0"
                    style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
                  >
                    Dnes
                  </span>
                )}
              </div>
              <span className="text-[12px] font-semibold mt-0.5 block text-stone-500">{DAY_LABELS[day]}</span>
            </div>

            {isClosed ? (
              <div className="px-3 py-3">
                {holidayName ? (
                  <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.14)" }}>
                    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/40">
                      <div
                        className="w-8 h-8 rounded-xl inline-flex items-center justify-center shrink-0"
                        style={{ background: "rgba(245,158,11,0.14)" }}
                      >
                        <span className="emoji text-[16px] leading-none">{holidayEmoji}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-[12px] text-stone-900 leading-none">{holidayName}</div>
                        <div className="text-[10.5px] text-stone-500 mt-0.5">Svátek / zavřeno</div>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 text-[11px] text-stone-600 leading-snug">
                      V tento den jídelníček neprobíhá.
                    </div>
                  </div>
                ) : closureLabel ? (
                  /* Only reached when part of the week is closed — a whole closed week
                     is handled by WeekClosurePanel. This is a placeholder for an absence,
                     so it gets no card of its own and says "closed" exactly once. */
                  <div className="flex flex-col items-center text-center gap-1 py-4 px-2">
                    <span className="emoji text-[22px] leading-none">{dayClosure!.icon}</span>
                    <span className="text-[11.5px] font-semibold text-stone-500 mt-0.5">Zavřeno</span>
                    <span className="text-[10.5px] text-stone-400 leading-snug">{closureLabel}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2.5">
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-stone-400"
                      style={{ background: "rgba(26,18,8,0.05)", border: "1px solid rgba(26,18,8,0.08)" }}
                    >
                      Zavřeno
                    </span>
                    {editMode && (
                      <button
                        className="text-[12px] font-semibold px-2.5 py-1 rounded-xl glass-btn text-stone-600"
                        disabled={disabled}
                        onClick={() => onOpenDay(day)}
                        type="button"
                      >
                        Otevřít den
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : !hasItems && !editMode ? (
              <div className="px-3 py-5 text-[11.5px] text-stone-400 text-center">Jídla ještě nebyla zadána</div>
            ) : (
              <div className="px-3 py-2.5 space-y-3">
                {/* Soups */}
                {(displaySoups.length > 0 || editMode) && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(245,158,11,0.6)" }} />
                      <span className="font-display text-[10px] uppercase tracking-widest font-semibold text-stone-500">Polévky</span>
                      {editMode && (
                        <button
                          aria-label="Přidat polévku"
                          className="ml-auto inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-semibold text-white hover:opacity-80 transition"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Polévka" as const)}
                          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
                          type="button"
                        ><MIcon name="add" size={13} />Přidat</button>
                      )}
                    </div>
                    {displaySoups.map((item) => (
                      <MenuItemRow disabled={disabled} editMode={editMode} item={item} key={item.id} onEdit={onEdit} />
                    ))}
                    {displaySoups.length === 0 && editMode && <p className="text-[11px] text-stone-300 py-0.5">Žádné</p>}
                  </div>
                )}
                {/* Meals */}
                {(displayMeals.length > 0 || editMode) && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(234,88,12,0.55)" }} />
                      <span className="font-display text-[10px] uppercase tracking-widest font-semibold text-stone-500">Jídla</span>
                      {editMode && (
                        <button
                          aria-label="Přidat jídlo"
                          className="ml-auto inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-semibold text-white hover:opacity-80 transition"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Jídlo" as const)}
                          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
                          type="button"
                        ><MIcon name="add" size={13} />Přidat</button>
                      )}
                    </div>
                    {displayMeals.map((item) => (
                      <MenuItemRow disabled={disabled} editMode={editMode} item={item} key={item.id} onEdit={onEdit} />
                    ))}
                    {displayMeals.length === 0 && editMode && <p className="text-[11px] text-stone-300 py-0.5">Žádné</p>}
                  </div>
                )}
                {editMode && (
                  <div className="pt-1.5 pb-0.5">
                    <button
                      className="w-full text-[10.5px] font-semibold py-1.5 rounded-xl glass-btn-danger text-red-600"
                      disabled={disabled}
                      onClick={() => onCloseDay(day)}
                      type="button"
                    >
                      Uzavřít den
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
