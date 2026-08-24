"use client";

import { useState, useRef, useTransition, useCallback, useEffect, memo, useMemo } from "react";
import { getHolidayEmoji } from "@/lib/holidays";
import type { MenuItem } from "@/lib/types";
import {
  actionDeleteMenuWeek,
  actionAddMenuItem,
  actionUpdateMenuItem,
  actionDeleteMenuItem,
  actionCloseDay,
  actionOpenDay,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import type { MenuWeek } from "@/app/jidelnicek/page";
import {
  DAY_LABELS,
  DAY_ORDER,
  describeDay,
  describeWeekName,
  resolveActiveDay,
  weekDayDates,
  type WeekMenu,
} from "./menu/menu-utils";
import { useMenuDeletion } from "./menu/useMenuDeletion";
import { useMenuImport } from "./menu/useMenuImport";
import { MenuItemEditModal } from "./menu/MenuItemEditModal";
import { MenuItemRow } from "./menu/MenuItemRow";
import { MenuSection } from "./menu/MenuSection";
import { PreviewTable } from "./menu/PreviewTable";
import { WeekClosurePanel } from "./menu/WeekClosurePanel";

interface Props {
  weeks: MenuWeek[];
  todayCode: string | null;
  defaultMealPrice: number;
  defaultSoupPrice: number;
}

// ── Week grid (desktop read/edit view) ────────────────────────────────────────

const WeekGrid = memo(function WeekGrid({
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

// ── Main component ────────────────────────────────────────────────────────────

export default function MenuPage({
  weeks,
  todayCode,
  defaultMealPrice,
  defaultSoupPrice,
}: Props) {
  const currentWeekStart = weeks.find((w) => w.isCurrent)?.weekStart ?? weeks[0].weekStart;
  const [activeWeekStart, setActiveWeekStart] = useState(currentWeekStart);
  // Optimistic per-week overrides of the server menu, keyed by weekStart.
  // Replaces the old pair of currentMenu/nextMenu states.
  const [menuEdits, setMenuEdits] = useState<Record<string, WeekMenu>>({});
  const prevWeeksRef = useRef(weeks);
  const [editMode, setEditMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const activeWeekData = weeks.find((w) => w.weekStart === activeWeekStart) ?? weeks[0];
  const nextWeekStart = weeks.find((w) => !w.isCurrent)?.weekStart ?? currentWeekStart;
  const activeWeekLabel = activeWeekData.weekLabel;
  const hasPdfActive = activeWeekData.hasPdf;
  const activeMenu = menuEdits[activeWeekStart] ?? activeWeekData.menu;
  const activeHolidayNames = activeWeekData.holidayNames;
  const activeClosureLabels = activeWeekData.closureLabels;
  const activeWeekClosure = activeWeekData.weekClosure;
  const visibleTodayCode = activeWeekData.isCurrent ? todayCode : null;
  // Any non-current week holding a menu can be deleted (was: only "next week")
  const canDeleteActiveWeek = !activeWeekData.isCurrent && Object.keys(activeWeekData.menu).length > 0;
  const activeWeekName = describeWeekName(activeWeekData.tabLabel);
  const weekLabelOf = useCallback(
    (weekStart: string) => weeks.find((w) => w.weekStart === weekStart)?.weekLabel ?? null,
    [weeks]
  );
  const [activeDayOverride, setActiveDayOverride] = useState<string | null>(null);

  useEffect(() => {
    if (prevWeeksRef.current !== weeks) {
      prevWeeksRef.current = weeks;
      setMenuEdits({});
    }
  }, [weeks]);


  const activeDay = useMemo(
    () => activeDayOverride && activeMenu[activeDayOverride]
      ? activeDayOverride
      : resolveActiveDay(activeMenu, visibleTodayCode),
    [activeDayOverride, activeMenu, visibleTodayCode]
  );

  // ── Optimistické úpravy položek ───────────────────────────────────────────

  // Úpravy se zapisují vždy do přepisu pro *aktivní* týden; jako výchozí stav
  // se bere serverové menu, dokud pro ten týden žádný přepis neexistuje.
  const setActiveWeekMenu = useCallback(
    (fn: (prev: WeekMenu) => WeekMenu) =>
      setMenuEdits((edits) => ({ ...edits, [activeWeekStart]: fn(edits[activeWeekStart] ?? activeWeekData.menu) })),
    [activeWeekStart, activeWeekData]
  );

  const handleUpdate = useCallback((id: number, updates: Partial<{ code: string; name: string; price: number; allergens: string }>) => {
    setActiveWeekMenu((prev) => {
      const next = { ...prev };
      for (const day of Object.keys(next)) {
        next[day] = {
          soups: next[day].soups.map((s) => s.id === id ? { ...s, ...updates } : s),
          meals: next[day].meals.map((m) => m.id === id ? { ...m, ...updates } : m),
        };
      }
      return next;
    });
    startTransition(async () => { await actionUpdateMenuItem(id, updates); });
  }, [setActiveWeekMenu]);

  const handleDelete = useCallback((id: number) => {
    startTransition(async () => {
      await actionDeleteMenuItem(id);
      setActiveWeekMenu((prev) => {
        const next = { ...prev };
        for (const day of Object.keys(next)) {
          next[day] = {
            soups: next[day].soups.filter((s) => s.id !== id),
            meals: next[day].meals.filter((m) => m.id !== id),
          };
        }
        return next;
      });
    });
  }, [setActiveWeekMenu]);

  const handleAdd = useCallback((day: string, type: "Polévka" | "Jídlo") => {
    startTransition(async () => {
      const newItem = await actionAddMenuItem({
        day, type,
        code: type === "Polévka" ? "A" : "1",
        name: "",
        price: type === "Polévka" ? defaultSoupPrice : defaultMealPrice,
        weekStart: activeWeekStart,
      });
      setActiveWeekMenu((prev) => {
        const dayData = prev[day] ?? { soups: [], meals: [] };
        return {
          ...prev,
          [day]: {
            soups: type === "Polévka" ? [...dayData.soups, newItem] : dayData.soups,
            meals: type === "Jídlo" ? [...dayData.meals, newItem] : dayData.meals,
          },
        };
      });
      setEditingItem(newItem);
    });
  }, [activeWeekStart, setActiveWeekMenu, defaultSoupPrice, defaultMealPrice]);

  // ── Domény ────────────────────────────────────────────────────────────────

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleDeleteWeek = useCallback(() => {
    startTransition(async () => {
      await actionDeleteMenuWeek(activeWeekStart);
      refresh();
    });
  }, [activeWeekStart, refresh]);

  const deletion = useMenuDeletion({ onDeleteItem: handleDelete, onDeleteWeek: handleDeleteWeek });

  const menuImport = useMenuImport({
    currentWeekStart,
    nextWeekStart,
    weekLabelOf,
    startTransition,
    onImported: refresh,
  });

  const { importState, closeImport, openImport } = menuImport;
  const { cancelDeleteWeek } = deletion;

  const handleWeekSwitch = useCallback((weekStart: string) => {
    setActiveWeekStart(weekStart);
    setActiveDayOverride(null);
    setEditMode(false);
    cancelDeleteWeek();
  }, [cancelDeleteWeek]);

  // Úpravy a import se navzájem vylučují — otevření jednoho zavírá druhý.
  const handleToggleEdit = useCallback(() => {
    setEditMode((v) => !v);
    closeImport();
  }, [closeImport]);

  const handleOpenImport = useCallback(() => {
    setEditMode(false);
    openImport();
  }, [openImport]);

  const dayView = describeDay(activeMenu[activeDay]);
  const activeHolidayName = activeHolidayNames[activeDay];
  const activeClosure = activeClosureLabels[activeDay];
  const activeClosureLabel = activeClosure?.label ?? null;
  const activeHolidayEmoji = getHolidayEmoji(activeHolidayName);
  const isReadOnly = false;

  const dayDates = weekDayDates(activeWeekStart);

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-stone-900">Jídelníček LIMA</span>
        {activeWeekLabel && (
          <span className="text-[12px] text-stone-500">Týden <strong className="text-stone-700">{activeWeekLabel}</strong></span>
        )}
        {hasPdfActive && (
          <a className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600"
            download href={`/api/menu/pdf/${activeWeekStart}`}>
            ↓ PDF
          </a>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
            onClick={handleToggleEdit}
            type="button"
          >
            {editMode ? "Zavřít úpravu" : "Upravit ručně"}
          </button>
          {canDeleteActiveWeek && (
            <button
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger active:scale-[0.97] transition disabled:opacity-50"
              disabled={isPending}
              onClick={deletion.requestDeleteWeek}
              type="button"
            >
              Smazat {activeWeekName}
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
            onClick={handleOpenImport}
            type="button"
          >
            <MIcon name="upload_file" size={14} /> Import PDF
          </button>
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Jídelníček LIMA</span>
          {activeWeekLabel && <span className="text-[11px] text-stone-500">{activeWeekLabel}</span>}
          <button
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600"
            onClick={handleOpenImport}
            type="button"
          >
            <MIcon name="upload_file" size={13} /> PDF
          </button>
        </div>
      </div>

      {/* Week tabs */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex p-1 rounded-2xl gap-0.5 shrink-0" style={{ background: "rgba(26,18,8,0.07)", border: "1px solid rgba(255,255,255,0.55)" }}>
          {weeks.map((week) => {
            const active = week.weekStart === activeWeekStart;
            return (
              <button
                key={week.weekStart}
                /* Same metrics as the day picker on the order page: one visual language, and
                     44px is the touch-target minimum this strip was under. */
                  className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center rounded-xl text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.97] whitespace-nowrap ${active ? "" : "text-stone-500 hover:text-stone-700 hover:bg-white/60"}`}
                onClick={() => handleWeekSwitch(week.weekStart)}
                style={active ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", color: "white", boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)" } : {}}
                type="button"
              >
                {/* A fully closed week says so in the tab — no need to click to find out */}
                {week.weekClosure && <span className="emoji mr-1">{week.weekClosure.icon}</span>}
                {week.tabLabel}
              </button>
            );
          })}
        </div>
        {hasPdfActive && (
          <a className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600 md:hidden"
            download href={`/api/menu/pdf/${activeWeekStart}`}>
            ↓ PDF
          </a>
        )}
        {activeWeekData.isCurrent && (
          <button
            className={`md:hidden inline-flex items-center text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
            onClick={handleToggleEdit}
            type="button"
          >
            {editMode ? "Zavřít" : "Upravit"}
          </button>
        )}
      </div>

      {activeWeekClosure ? (
        <WeekClosurePanel closure={activeWeekClosure} />
      ) : (
      <>
      {/* Day tabs — mobile only */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-2 shrink-0">
        {DAY_ORDER.map((day) => {
          const active = activeDay === day;
          const isToday = day === visibleTodayCode;
          const hasData = !!activeMenu[day];
          return (
            <button
              key={day}
              className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl active:scale-[0.95] transition ${!hasData && !active ? "opacity-40" : ""}`}
              onClick={() => setActiveDayOverride(day)}
              style={active
                ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 14px -4px rgba(245,158,11,0.55)" }
                : { background: "rgba(255,255,255,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }
              }
              type="button"
            >
              <span className={`text-[9.5px] font-bold uppercase tracking-wide leading-none ${active ? "text-white/80" : "text-stone-500"}`}>{day}</span>
              <span className={`font-display font-bold text-[14px] leading-tight mt-0.5 ${active ? "text-white" : "text-stone-700"}`}>{dayDates[day]}</span>
              {isToday && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: active ? "rgba(255,255,255,0.8)" : "#F59E0B" }} />}
            </button>
          );
        })}
      </div>

      {/* Desktop: full week grid */}
      <div className="hidden md:block flex-1 overflow-y-auto scroll-area px-4 pb-8 pt-3">
        <WeekGrid
          dayDates={dayDates}
          disabled={isPending}
          editMode={!isReadOnly && editMode}
          holidayNames={activeHolidayNames}
          closureLabels={activeClosureLabels}
          menu={activeMenu}
          onAdd={(day, type) => handleAdd(day, type)}
          onCloseDay={(day) => {
            startTransition(async () => { await actionCloseDay(day, activeWeekStart); router.refresh(); });
          }}
          onEdit={(item) => setEditingItem(item)}
          onOpenDay={(day) => {
            startTransition(async () => { await actionOpenDay(day, activeWeekStart); router.refresh(); });
          }}
          todayCode={visibleTodayCode}
          weekStart={activeWeekStart}
        />
      </div>

      {/* Mobile: single day view */}
      <div className="md:hidden flex-1 overflow-y-auto scroll-area px-4 pb-nav">
        <div className="space-y-3">
          <div className="font-display font-bold text-[17px] text-stone-900 mb-1 pt-2">{DAY_LABELS[activeDay]}</div>
          {dayView.isClosed ? (
            <div className="glass-card rounded-3xl overflow-hidden">
              <div
                className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40"
                style={{ background: activeHolidayName || !activeClosureLabel ? "rgba(245,158,11,0.08)" : "rgba(148,163,184,0.10)" }}
              >
                <div
                  className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
                  style={{ background: activeHolidayName || !activeClosureLabel ? "rgba(245,158,11,0.14)" : "rgba(148,163,184,0.16)" }}
                >
                  {activeHolidayName ? (
                    <span className="emoji text-[18px] leading-none">{activeHolidayEmoji}</span>
                  ) : activeClosureLabel ? (
                    <span className="emoji text-[18px] leading-none">{activeClosure!.icon}</span>
                  ) : (
                    <MIcon
                      name="event_busy"
                      size={18}
                      fill
                      style={{ color: "#D97706" }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-[13.5px] text-stone-900 leading-none">
                    {activeHolidayName ?? activeClosureLabel ?? "Zavřeno"}
                  </div>
                  <div className="text-[11.5px] text-stone-500 mt-0.5">
                    {activeHolidayName
                      ? "Svátek / zavřeno"
                      : activeClosureLabel
                        ? "Zavřeno — v tento den se nevaří"
                        : "V tento den není jídelníček k dispozici."}
                  </div>
                </div>
              </div>
              <div className="px-4 py-4 flex flex-col items-center gap-3">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium text-stone-600"
                  style={{ background: "rgba(255,255,255,0.58)", border: "1px solid rgba(245,158,11,0.14)" }}
                >
                  <MIcon name="info" size={14} style={{ color: "#D97706" }} />
                  <span>
                    {activeHolidayName
                      ? "V tento den se jídla nevydávají."
                      : activeClosureLabel
                        ? (editMode ? "Zavřeno je nastavené v Nastavení → Zavřeno / dovolená." : "V tento den se v LIMA nevaří.")
                        : "Zkuste jiný den nebo doplnit menu v editaci."}
                  </span>
                </div>
                {!isReadOnly && editMode && !activeClosureLabel && (
                  <button
                    className="text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                    disabled={isPending}
                    onClick={() => startTransition(async () => { await actionOpenDay(activeDay, activeWeekStart); router.refresh(); })}
                    type="button"
                  >
                    Otevřít den
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <MenuSection
                accent="rgba(245,158,11,0.12)"
                disabled={isPending}
                editMode={!isReadOnly && editMode}
                emptyLabel="Žádné polévky pro tento den."
                icon="restaurant"
                iconColor="#D97706"
                items={dayView.soups}
                onAdd={() => handleAdd(activeDay, "Polévka")}
                onEdit={(item) => setEditingItem(item)}
                title="Polévky"
              />
              <MenuSection
                accent="rgba(234,88,12,0.1)"
                disabled={isPending}
                editMode={!isReadOnly && editMode}
                emptyLabel="Žádná jídla pro tento den."
                icon="restaurant_menu"
                iconColor="#EA580C"
                items={dayView.meals}
                onAdd={() => handleAdd(activeDay, "Jídlo")}
                onEdit={(item) => setEditingItem(item)}
                title="Jídla"
              />
              {!isReadOnly && editMode && (
                <button
                  className="w-full text-[12px] font-semibold py-2 rounded-2xl glass-btn-danger text-red-600"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await actionCloseDay(activeDay, activeWeekStart); router.refresh(); })}
                  type="button"
                >
                  Uzavřít den
                </button>
              )}
            </>
          )}
        </div>
      </div>
      </>
      )}

      {/* Menu item edit modal */}
      {editingItem !== null && (
        <MenuItemEditModal
          disabled={isPending}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onRequestDelete={(id) => { setEditingItem(null); deletion.requestDeleteItem(id); }}
          onSave={(id, updates) => handleUpdate(id, updates)}
        />
      )}

      {/* Confirm modals */}
      {deletion.pendingItemId !== null && (
        <ConfirmModal
          message="Tato položka jídelníčku bude trvale odstraněna."
          onClose={deletion.cancelDeleteItem}
          onConfirm={deletion.confirmDeleteItem}
          title="Smazat položku"
        />
      )}
      {deletion.isWeekConfirmOpen && (
        <ConfirmModal
          confirmLabel="Smazat"
          isPending={isPending}
          message={`Celý jídelníček (${activeWeekName}) bude trvale odstraněn.`}
          onClose={deletion.cancelDeleteWeek}
          onConfirm={deletion.confirmDeleteWeek}
          title={`Smazat ${activeWeekName}`}
        />
      )}

      {/* Import modal */}
      {menuImport.isImportOpen && (
        <div
          className="modal-overlay"
          onClick={closeImport}
        >
          <div
            className={`modal-sheet${importState.phase === "preview" ? " !w-full sm:!w-[760px]" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-sheet__header">
              <h3 className="modal-sheet__title" id="import-modal-title">
                {importState.phase === "preview" ? "Náhled importu" : "Importovat PDF jídelníčku"}
              </h3>
              <button
                aria-label="Zavřít"
                className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 font-bold"
                onClick={closeImport}
                type="button"
              >
                <MIcon name="close" size={16} />
              </button>
            </div>
            <div className="modal-sheet__body">
              {importState.phase === "uploading" && (
                <>
                  <div
                    className={`flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition ${isDragging ? "border-amber-400 bg-amber-50/50" : "border-white/50 glass-soft"}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragLeave={() => setIsDragging(false)}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) menuImport.handleFile(f); }}
                  >
                    <MIcon name="upload_file" size={32} style={{ color: "#D97706" }} />
                    <p className="text-[13px] text-stone-600 text-center">Přetáhněte PDF sem nebo klikněte pro výběr</p>
                    <input accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) menuImport.handleFile(f); }} ref={fileInputRef} style={{ display: "none" }} type="file" />
                  </div>
                  <p className="text-[12px] text-stone-400 text-center">Čekám na soubor...</p>
                </>
              )}
              {importState.phase === "error" && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700">
                  <strong>Chyba:</strong> {importState.message}
                  <button className="ml-3 text-[12px] font-semibold text-red-600 underline" onClick={menuImport.retryImport} type="button">Zkusit znovu</button>
                </div>
              )}
              {importState.phase === "preview" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] text-stone-600">
                      Rozpoznáno <strong>{importState.result.items.length}</strong> položek
                      {importState.result.weekLabel && <>, týden <strong>{importState.result.weekLabel}</strong></>}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-[11px] text-stone-400">Uložit jako:</span>
                      <button
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${importState.targetWeekStart === currentWeekStart ? "text-white" : "glass-btn text-stone-600"}`}
                        onClick={menuImport.selectCurrentWeek}
                        style={importState.targetWeekStart === currentWeekStart ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
                        type="button"
                      >
                        Aktuální
                      </button>
                      <button
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${importState.targetWeekStart === nextWeekStart ? "text-white" : "glass-btn text-stone-600"}`}
                        onClick={menuImport.selectNextWeek}
                        style={importState.targetWeekStart === nextWeekStart ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
                        type="button"
                      >
                        Příští
                      </button>
                    </div>
                  </div>
                  <PreviewTable items={importState.result.items} />
                </>
              )}
              {importState.phase === "saving" && (
                <p className="text-[13px] text-stone-500 text-center py-4">Ukládám jídelníček...</p>
              )}
            </div>
            {importState.phase === "preview" && (
              <div className="modal-sheet__footer">
                <button className="modal-btn modal-btn--secondary" onClick={closeImport} type="button">Zrušit</button>
                <button className="modal-btn modal-btn--primary" disabled={isPending} onClick={menuImport.confirmImport} type="button">
                  {isPending ? "Ukládám..." : "Uložit jídelníček"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
