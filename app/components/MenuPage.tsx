"use client";

import { useState, useRef, useTransition, useCallback, useEffect, memo, useMemo, useId } from "react";
import { getHolidayEmoji } from "@/lib/holidays";
import type { MenuItem } from "@/lib/types";
import type { ParsedMenuItem, ParseResult } from "@/lib/parse-menu";
import {
  actionConfirmMenuImport,
  actionDeleteMenuWeek,
  actionAddMenuItem,
  actionUpdateMenuItem,
  actionDeleteMenuItem,
  actionCloseDay,
  actionOpenDay,
  actionQuickOrder,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import PageHeader from "./PageHeader";
import { useModalSwipe } from "@/app/hooks/useModalSwipe";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useDaySwipe } from "@/app/hooks/useDaySwipe";

function formatWeekRange(weekStart: string): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const monday = new Date(year, month - 1, day);
  const friday = new Date(year, month - 1, day + 4);
  const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}`;
  return `${fmt(monday)} – ${fmt(friday)}`;
}

// Controlled textarea that auto-grows to fit its content (used in modal)
function AutoResizeTextarea({ value, onChange, disabled, placeholder }: {
  value: string; onChange: (v: string) => void; disabled: boolean; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="modal-input w-full resize-none overflow-hidden leading-snug"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }}
      disabled={disabled}
      placeholder={placeholder}
      rows={2}
    />
  );
}

const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"];
const DAY_LABELS: Record<string, string> = {
  Po: "Pondělí", Út: "Úterý", St: "Středa", Čt: "Čtvrtek", Pá: "Pátek",
};

function resolveActiveDay(
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>,
  visibleTodayCode: string | null,
  currentDay?: string
): string {
  if (currentDay && menu[currentDay]) return currentDay;
  if (visibleTodayCode && menu[visibleTodayCode]) return visibleTodayCode;
  return DAY_ORDER.find((day) => menu[day]) ?? DAY_ORDER[0];
}

interface Props {
  currentMenu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  currentWeekLabel: string | null;
  currentWeekStart: string;
  currentHolidayNames: Record<string, string | null>;
  defaultMealPrice: number;
  defaultSoupPrice: number;
  nextMenu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  nextHolidayNames: Record<string, string | null>;
  nextWeekLabel: string | null;
  nextWeekStart: string;
  todayCode: string | null;
  hasPdfCurrent: boolean;
  hasPdfNext: boolean;
  userDefaultDepartment?: string | null;
}

type ImportDiagnostics = {
  warnings: string[];
  daysFound: number;
  mealCount: number;
  soupCount: number;
};

type ImportState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "preview"; result: ParseResult; targetWeekStart: string; targetLabel: string; tmpPdfName?: string }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string; diagnostics?: ImportDiagnostics };

// ── Preview table ──────────────────────────────────────────────────────────────

const PreviewTable = memo(function PreviewTable({ items }: { items: ParsedMenuItem[] }) {
  const byDay = useMemo(() => {
    const acc: Record<string, { soups: ParsedMenuItem[]; meals: ParsedMenuItem[] }> = {};
    for (const item of items) {
      if (!acc[item.day]) acc[item.day] = { soups: [], meals: [] };
      if (item.type === "Polévka") acc[item.day].soups.push(item);
      else acc[item.day].meals.push(item);
    }
    return acc;
  }, [items]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
      {DAY_ORDER.filter((d) => byDay[d]).map((day) => (
        <div className="glass-soft rounded-2xl p-3" key={day}>
          <h4 className="font-display font-bold text-[12px] text-stone-700 mb-2">{DAY_LABELS[day]}</h4>
          {byDay[day].soups.length > 0 && (
            <div className="mb-2">
              <p className="font-display text-[10px] uppercase tracking-wide text-stone-500 font-semibold mb-1">Polévky</p>
              {byDay[day].soups.map((s, i) => (
                <p className="text-[12px] text-stone-700 py-0.5" key={i}>
                  <span className="font-mono text-[10px] text-stone-400 mr-1">{s.code}</span>{s.name}
                </p>
              ))}
            </div>
          )}
          {byDay[day].meals.length > 0 && (
            <div>
              <p className="font-display text-[10px] uppercase tracking-wide text-stone-500 font-semibold mb-1">Jídla</p>
              {byDay[day].meals.map((m, i) => (
                <p className="text-[12px] text-stone-700 py-0.5" key={i}>
                  <span className="font-mono text-[10px] text-stone-400 mr-1">{m.code}</span>{m.name}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// ── Week grid (desktop read/edit view) ────────────────────────────────────────

const WeekGrid = memo(function WeekGrid({
  menu, dayDates, todayCode, holidayNames, editMode, disabled, defaultSoupPrice, defaultMealPrice, filteredAllergens, onAdd, onEdit, onCloseDay, onOpenDay, traySoupId, trayMainId, onTrayToggle,
}: {
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  dayDates: Record<string, number>;
  todayCode: string | null;
  holidayNames: Record<string, string | null>;
  editMode: boolean;
  disabled: boolean;
  defaultSoupPrice: number;
  defaultMealPrice: number;
  filteredAllergens: Set<number>;
  onAdd: (day: string, type: "Polévka" | "Jídlo") => void;
  onEdit: (item: MenuItem) => void;
  onCloseDay: (day: string) => void;
  onOpenDay: (day: string) => void;
  traySoupId?: number | null;
  trayMainId?: number | null;
  onTrayToggle?: (item: MenuItem) => void;
}) {
  const todayIdx = todayCode ? DAY_ORDER.indexOf(todayCode) : -1;
  return (
    <div className="grid grid-cols-5 gap-3 items-start min-w-[1100px] lg:min-w-0">
      {DAY_ORDER.map((day, idx) => {
        const isToday = day === todayCode;
        const isPast = todayIdx >= 0 && idx < todayIdx;
        const { soups = [], meals = [] } = menu[day] ?? {};
        const holidayName = holidayNames[day];
        const holidayEmoji = getHolidayEmoji(holidayName);
        const isClosed = [...soups, ...meals].every(i => i.name === "Zavřeno") && (soups.length + meals.length) > 0;
        const displaySoups = soups.filter(i => i.name !== "Zavřeno");
        const displayMeals = meals.filter(i => i.name !== "Zavřeno");
        const hasItems = displaySoups.length > 0 || displayMeals.length > 0;
        return (
          <div
            key={day}
            data-day={day}
            className={`day-col snap-start lg:snap-align-none${isToday ? " is-today" : ""}${isPast ? " is-past" : ""}`}
          >
            {/* Day header */}
            <div className="flex items-start justify-between gap-1 mb-1">
              <div>
                <div className="font-display font-extrabold text-[30px] leading-none text-stone-950" style={{ letterSpacing: "-0.02em" }}>{dayDates[day]}</div>
                <div className="text-[11px] font-semibold uppercase mt-1 text-stone-500" style={{ letterSpacing: "0.06em" }}>{DAY_LABELS[day]}</div>
              </div>
              {isToday ? (
                <span className="day-badge day-badge--today">Dnes</span>
              ) : isPast ? (
                <span className="day-badge day-badge--past">Hotovo</span>
              ) : null}
            </div>

            {isClosed ? (
              <div className="pt-1">
                {holidayName ? (
                  <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.14)" }}>
                    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/40">
                      <div
                        className="w-8 h-8 rounded-xl inline-flex items-center justify-center shrink-0"
                        style={{ background: "rgba(245,158,11,0.14)" }}
                      >
                        <span className="text-[16px] leading-none">{holidayEmoji}</span>
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
              <div className="py-4 text-xs text-stone-400 text-center">Jídla ještě nebyla zadána</div>
            ) : (
              <div>
                {/* Soups */}
                {(displaySoups.length > 0 || editMode) && (
                  <>
                    <div className="cat-divider">
                      <span className="cat-divider__label">Polévky</span>
                      <span className="cat-divider__line"></span>
                      <span className="cat-divider__price">{defaultSoupPrice} Kč</span>
                      {editMode && (
                        <button
                          aria-label="Přidat polévku"
                          className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-white hover:opacity-80 transition brand-grad"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Polévka" as const)}
                          type="button"
                        ><MIcon name="add" size={11} /></button>
                      )}
                    </div>
                    {displaySoups.map((item) => (
                      <WeekItem
                        defaultPrice={defaultSoupPrice}
                        disabled={disabled}
                        editMode={editMode}
                        filteredAllergens={filteredAllergens}
                        item={item}
                        key={item.id}
                        isToday={isToday}
                        onEdit={onEdit}
                        isSelectedInTray={traySoupId === item.id}
                        onTrayToggle={onTrayToggle}
                      />
                    ))}
                    {displaySoups.length === 0 && editMode && <p className="text-[11px] text-stone-300 py-0.5">Žádné</p>}
                  </>
                )}
                {/* Meals */}
                {(displayMeals.length > 0 || editMode) && (
                  <>
                    <div className="cat-divider">
                      <span className="cat-divider__label">Hlavní jídla</span>
                      <span className="cat-divider__line"></span>
                      <span className="cat-divider__price">{defaultMealPrice} Kč</span>
                      {editMode && (
                        <button
                          aria-label="Přidat jídlo"
                          className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-white hover:opacity-80 transition brand-grad"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Jídlo" as const)}
                          type="button"
                        ><MIcon name="add" size={11} /></button>
                      )}
                    </div>
                    {displayMeals.map((item) => (
                      <WeekItem
                        defaultPrice={defaultMealPrice}
                        disabled={disabled}
                        editMode={editMode}
                        filteredAllergens={filteredAllergens}
                        item={item}
                        key={item.id}
                        isToday={isToday}
                        onEdit={onEdit}
                        isSelectedInTray={trayMainId === item.id}
                        onTrayToggle={onTrayToggle}
                      />
                    ))}
                    {displayMeals.length === 0 && editMode && <p className="text-[11px] text-stone-300 py-0.5">Žádné</p>}
                  </>
                )}
                {editMode && (
                  <div className="pt-2 pb-0.5">
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

const ALLERGEN_NAMES: Record<number, string> = {
  1: "Lepek", 2: "Korýši", 3: "Vejce", 4: "Ryby", 5: "Arašídy",
  6: "Sója", 7: "Mléko", 8: "Ořechy", 9: "Celer", 10: "Hořčice",
  11: "Sezam", 12: "Siřičitany", 13: "Vlčí bob", 14: "Měkkýši",
};

function parseAllergens(s: string): number[] {
  if (!s) return [];
  return s.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 14);
}

function useAllergenFilter() {
  const [filtered, setFiltered] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("kantyna_allergen_filter");
      if (raw) {
        const arr = JSON.parse(raw) as number[];
        if (Array.isArray(arr)) setFiltered(new Set(arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 14)));
      }
    } catch {}
  }, []);
  const toggle = useCallback((n: number) => {
    setFiltered((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      try { localStorage.setItem("kantyna_allergen_filter", JSON.stringify([...next].sort((a, b) => a - b))); } catch {}
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setFiltered(new Set());
    try { localStorage.removeItem("kantyna_allergen_filter"); } catch {}
  }, []);
  return { filtered, toggle, clear };
}

function AllergenFilterDropdown({ filtered, onToggle, onClear, onClose }: {
  filtered: Set<number>;
  onToggle: (n: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", esc); };
  }, [onClose]);
  return (
    <div ref={ref} className="allergen-filter-menu" role="dialog" aria-label="Filtr alergenů">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-[11px] font-semibold text-stone-600">Skrýt jídla s alergeny</span>
        {filtered.size > 0 && (
          <button type="button" onClick={onClear} className="text-[10.5px] font-semibold text-amber-700 hover:text-amber-800">
            Vyčistit
          </button>
        )}
      </div>
      <div className="allergen-filter-menu__list">
        {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => {
          const active = filtered.has(n);
          return (
            <button
              key={n}
              type="button"
              className={`allergen-filter-menu__item${active ? " active" : ""}`}
              onClick={() => onToggle(n)}
              aria-pressed={active}
            >
              <span className="allergen-check" aria-hidden="true">{active ? "✓" : ""}</span>
              <span className="num">{n}</span>
              <span className="truncate">{ALLERGEN_NAMES[n]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AllergenBadges = memo(function AllergenBadges({ allergens }: { allergens: string }) {
  const nums = allergens.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 14);
  if (nums.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-0.5 mt-0.5">
      {nums.map((n) => (
        <span
          key={n}
          title={ALLERGEN_NAMES[n]}
          className="inline-block text-[11px] font-semibold leading-none px-1.5 py-0.5 rounded"
          style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}
        >
          {n}
        </span>
      ))}
    </span>
  );
});

function MenuItemEditModal({ item, disabled, onSave, onRequestDelete, onClose }: {
  item: MenuItem;
  disabled: boolean;
  onSave: (id: number, updates: Partial<{ code: string; name: string; allergens: string }>) => void;
  onRequestDelete: (id: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [code, setCode] = useState(item.code);
  const [name, setName] = useState(item.name);
  const [activeAllergens, setActiveAllergens] = useState<Set<number>>(() =>
    new Set(item.allergens.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 14))
  );

  const toggleAllergen = (n: number) => {
    setActiveAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const { sheetRef, sheetElRef } = useModalSwipe(onClose);
  useFocusTrap(sheetElRef, true);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => { document.removeEventListener("keydown", h); trigger?.focus(); };
  }, [onClose]);

  const handleSave = () => {
    const allergenStr = [...activeAllergens].sort((a, b) => a - b).join(",");
    onSave(item.id, { code, name, allergens: allergenStr });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet !w-full sm:!w-[420px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        ref={sheetRef}
      >
        <div className="modal-sheet__drag-handle" aria-hidden />
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id={titleId}>
            Upravit {item.type === "Polévka" ? "polévku" : "jídlo"}
          </h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500"
            onClick={onClose}
            type="button"
          >
            <MIcon name="close" size={16} />
          </button>
        </div>
        <div className="modal-sheet__body space-y-4">
          <div>
            <label className="modal-label">Kód</label>
            <input
              className="modal-input w-20 mt-1"
              disabled={disabled}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label className="modal-label">Název</label>
            <div className="mt-1">
              <AutoResizeTextarea
                disabled={disabled}
                onChange={setName}
                placeholder="Název jídla"
                value={name}
              />
            </div>
          </div>
          <div>
            <label className="modal-label">Alergeny</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => {
                const active = activeAllergens.has(n);
                return (
                  <button
                    key={n}
                    disabled={disabled}
                    onClick={() => toggleAllergen(n)}
                    title={ALLERGEN_NAMES[n]}
                    aria-label={`Alergen ${n}: ${ALLERGEN_NAMES[n]}`}
                    type="button"
                    className="w-11 h-11 rounded-lg text-[13px] font-bold transition active:scale-95"
                    style={active
                      ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", color: "white", boxShadow: "0 2px 6px -1px rgba(234,88,12,0.30)" }
                      : { background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.6)", color: "#78716c" }
                    }
                  >{n}</button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-sheet__footer">
          <button
            className="modal-btn modal-btn--danger"
            disabled={disabled}
            onClick={() => { onRequestDelete(item.id); onClose(); }}
            type="button"
          >
            Smazat
          </button>
          <button
            className="modal-btn modal-btn--primary"
            disabled={disabled}
            onClick={handleSave}
            type="button"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Floating order tray ───────────────────────────────────────────────────────

type TrayStatus = "idle" | "ordering" | "success" | "error";

function FloatingOrderTray({
  selectedSoup,
  selectedMain,
  defaultSoupPrice,
  defaultMealPrice,
  hasDefaultDept,
  onRemoveSoup,
  onRemoveMain,
  onOrder,
  status,
  errorMsg,
}: {
  selectedSoup: MenuItem | null;
  selectedMain: MenuItem | null;
  defaultSoupPrice: number;
  defaultMealPrice: number;
  hasDefaultDept: boolean;
  onRemoveSoup: () => void;
  onRemoveMain: () => void;
  onOrder: () => void;
  status: TrayStatus;
  errorMsg: string | null;
}) {
  const total = (selectedSoup ? (selectedSoup.price || defaultSoupPrice) : 0) +
    (selectedMain ? (selectedMain.price || defaultMealPrice) : 0);
  const isOrdering = status === "ordering";
  const isSuccess = status === "success";

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+56px)] md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-32px)] max-w-lg"
      style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))" }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", border: "1px solid rgba(245,158,11,0.25)" }}
      >
        {/* Items row */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-wrap">
          {selectedSoup ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold text-white brand-grad"
            >
              <span className="truncate max-w-[140px]">{selectedSoup.name}</span>
              <button type="button" onClick={onRemoveSoup} aria-label="Odebrat polévku" className="opacity-70 hover:opacity-100 transition">
                <MIcon name="close" size={11} />
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-stone-400 border border-dashed border-stone-300">
              <MIcon name="soup_kitchen" size={13} /> Polévka
            </span>
          )}
          {selectedMain ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold text-white brand-grad"
            >
              <span className="truncate max-w-[140px]">{selectedMain.name}</span>
              <button type="button" onClick={onRemoveMain} aria-label="Odebrat jídlo" className="opacity-70 hover:opacity-100 transition">
                <MIcon name="close" size={11} />
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-medium text-stone-400 border border-dashed border-stone-300">
              <MIcon name="restaurant" size={13} /> Hlavní jídlo
            </span>
          )}
          <span className="ml-auto text-[13px] font-bold text-stone-700 tabular-nums shrink-0">{total} Kč</span>
        </div>

        {/* Error */}
        {status === "error" && errorMsg && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{errorMsg}</div>
        )}

        {/* Footer */}
        <div className="px-3 pb-3">
          {!hasDefaultDept ? (
            <div className="text-xs text-stone-500 text-center py-1">
              Nastav si výchozí oddělení v <a href="/profil" className="underline font-semibold text-stone-700">profilu</a> pro rychlé objednávání.
            </div>
          ) : isSuccess ? (
            <div className="flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-green-700">
              <MIcon name="check_circle" size={16} fill style={{ color: "#16a34a" }} /> Objednáno!
            </div>
          ) : (
            <button
              type="button"
              onClick={onOrder}
              disabled={isOrdering || (!selectedSoup && !selectedMain)}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50 brand-grad brand-shadow--sm"
            >
              {isOrdering ? "Objednávám…" : "Objednat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const WeekItem = memo(function WeekItem({
  item, editMode, disabled, defaultPrice, filteredAllergens, isToday, onEdit, isSelectedInTray, onTrayToggle,
}: {
  item: MenuItem;
  editMode: boolean;
  disabled: boolean;
  defaultPrice: number;
  filteredAllergens: Set<number>;
  isToday: boolean;
  onEdit: (item: MenuItem) => void;
  isSelectedInTray?: boolean;
  onTrayToggle?: (item: MenuItem) => void;
}) {
  const allergenNums = parseAllergens(item.allergens);
  const hasFilteredAllergen = allergenNums.some((n) => filteredAllergens.has(n));
  const filterActive = filteredAllergens.size > 0;
  const priceDiffers = item.price > 0 && item.price !== defaultPrice;
  const tooltipText = filterActive && hasFilteredAllergen
    ? `Obsahuje alergen ${allergenNums.filter(n => filteredAllergens.has(n)).join(", ")}, který jsi vyfiltroval`
    : undefined;

  const canQuickOrder = !editMode && isToday && !hasFilteredAllergen;
  const handleRowClick = () => {
    if (!canQuickOrder) return;
    if (onTrayToggle) { onTrayToggle(item); return; }
  };

  return (
    <div
      className={`menu-row${filterActive && hasFilteredAllergen ? " menu-row--dimmed" : ""}${canQuickOrder ? " menu-row--tappable" : ""}${isSelectedInTray ? " menu-row--selected" : ""}`}
      title={tooltipText}
      role={canQuickOrder ? "button" : undefined}
      tabIndex={canQuickOrder ? 0 : undefined}
      onClick={canQuickOrder ? handleRowClick : undefined}
      onKeyDown={canQuickOrder ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(); } } : undefined}
      aria-label={canQuickOrder ? (isSelectedInTray ? `Odebrat ${item.name} z výběru` : `Přidat ${item.name} do výběru`) : undefined}
      aria-pressed={canQuickOrder ? isSelectedInTray : undefined}
    >
      <span className="menu-row__idx">{item.code}</span>
      <div className="min-w-0">
        <div className="menu-row__name">{item.name}</div>
        {allergenNums.length > 0 && (
          <div className="menu-row__allergens">
            {allergenNums.map((n, i) => (
              <span key={i}>
                {i > 0 && " · "}
                <span className={filterActive && filteredAllergens.has(n) ? "filtered" : ""}>{n}</span>
              </span>
            ))}
          </div>
        )}
        {priceDiffers && (
          <div className="text-[11px] font-semibold text-stone-500 mt-0.5 tabular-nums">{item.price} Kč</div>
        )}
      </div>
      {editMode ? (
        <button
          aria-label="Upravit"
          className="absolute right-1 top-1 w-7 h-7 rounded-lg inline-flex items-center justify-center text-stone-500 bg-stone-100/70 hover:text-amber-600 hover:bg-amber-50 transition"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onEdit(item); }}
          type="button"
        >
          <MIcon name="edit" size={13} />
        </button>
      ) : canQuickOrder ? (
        <span className={`quick-order${isSelectedInTray ? " quick-order--selected" : ""}`} aria-hidden>
          {isSelectedInTray
            ? <><MIcon name="check" size={10} /> Vybráno</>
            : <><MIcon name="add" size={10} /> Vybrat</>}
        </span>
      ) : null}
    </div>
  );
});

// ── Menu section (mobile) ──────────────────────────────────────────────────────

const MenuSection = memo(function MenuSection({
  title,
  defaultPrice,
  items,
  disabled,
  editMode,
  emptyLabel,
  filteredAllergens,
  isToday,
  onAdd,
  onEdit,
  traySelectedId,
  onTrayToggle,
}: {
  title: string;
  defaultPrice: number;
  items: MenuItem[];
  disabled: boolean;
  editMode: boolean;
  emptyLabel: string;
  filteredAllergens: Set<number>;
  isToday: boolean;
  onAdd?: () => void;
  onEdit?: (item: MenuItem) => void;
  traySelectedId?: number | null;
  onTrayToggle?: (item: MenuItem) => void;
}) {
  return (
    <div>
      <div className="cat-divider">
        <span className="cat-divider__label">{title}</span>
        <span className="cat-divider__line"></span>
        <span className="cat-divider__price">{defaultPrice} Kč</span>
        {editMode && onAdd && (
          <button
            aria-label="Přidat"
            className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full text-white hover:opacity-80 transition brand-grad"
            disabled={disabled}
            onClick={onAdd}
            type="button"
          >
            <MIcon name="add" size={12} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="px-1 py-3 text-[12px] text-stone-400">{emptyLabel}</div>
      ) : (
        items.map((item) => (
          <WeekItem
            key={item.id}
            item={item}
            editMode={editMode}
            disabled={disabled}
            defaultPrice={defaultPrice}
            filteredAllergens={filteredAllergens}
            isToday={isToday}
            onEdit={(it) => onEdit?.(it)}
            isSelectedInTray={traySelectedId === item.id}
            onTrayToggle={onTrayToggle}
          />
        ))
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export default function MenuPage({
  currentMenu: initialCurrentMenu,
  currentWeekLabel,
  currentWeekStart,
  defaultMealPrice,
  defaultSoupPrice,
  nextMenu: initialNextMenu,
  nextHolidayNames,
  nextWeekLabel,
  nextWeekStart,
  todayCode,
  currentHolidayNames,
  hasPdfCurrent,
  hasPdfNext,
  userDefaultDepartment = null,
}: Props) {
  const [currentMenu, setCurrentMenu] = useState(initialCurrentMenu);
  const [nextMenu, setNextMenu] = useState(initialNextMenu);
  // Sync state when server pushes new props (after router.refresh() following an import)
  const prevMenuPropsRef = useRef(initialCurrentMenu);
  if (prevMenuPropsRef.current !== initialCurrentMenu) {
    prevMenuPropsRef.current = initialCurrentMenu;
    setCurrentMenu(initialCurrentMenu);
  }
  const prevNextMenuPropsRef = useRef(initialNextMenu);
  if (prevNextMenuPropsRef.current !== initialNextMenu) {
    prevNextMenuPropsRef.current = initialNextMenu;
    setNextMenu(initialNextMenu);
  }
  const [activeWeek, setActiveWeek] = useState<"current" | "next">("current");
  const [editMode, setEditMode] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteNext, setConfirmDeleteNext] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const { filtered: filteredAllergens, toggle: toggleAllergen, clear: clearAllergens } = useAllergenFilter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { sheetRef: importSheetRef, sheetElRef: importElRef } = useModalSwipe(useCallback(() => setImportState({ phase: "idle" }), []));

  // Tráček rychlého objednávání
  const [tray, setTray] = useState<{ soup: MenuItem | null; main: MenuItem | null }>({ soup: null, main: null });
  const [trayStatus, setTrayStatus] = useState<TrayStatus>("idle");
  const [trayError, setTrayError] = useState<string | null>(null);

  const handleTrayToggle = useCallback((item: MenuItem) => {
    setTray((prev) => {
      if (item.type === "Polévka") {
        return { ...prev, soup: prev.soup?.id === item.id ? null : item };
      } else {
        return { ...prev, main: prev.main?.id === item.id ? null : item };
      }
    });
    setTrayStatus("idle");
    setTrayError(null);
  }, []);

  const handleTrayOrder = useCallback(async () => {
    if (!tray.soup && !tray.main) return;
    setTrayStatus("ordering");
    setTrayError(null);
    try {
      await actionQuickOrder(tray.soup?.id ?? null, tray.main?.id ?? null);
      setTrayStatus("success");
      setTray({ soup: null, main: null });
      setTimeout(() => setTrayStatus("idle"), 2000);
    } catch (e) {
      setTrayStatus("error");
      setTrayError(e instanceof Error ? e.message : "Nepodařilo se objednat.");
    }
  }, [tray]);

  const hasNextWeek = Object.keys(initialNextMenu).length > 0;
  const activeWeekStart = activeWeek === "current" ? currentWeekStart : nextWeekStart;
  const activeWeekLabel = activeWeek === "current" ? currentWeekLabel : nextWeekLabel;
  const hasPdfActive = activeWeek === "current" ? hasPdfCurrent : hasPdfNext;
  const activeMenu = activeWeek === "current" ? currentMenu : nextMenu;
  const activeHolidayNames = activeWeek === "current" ? currentHolidayNames : nextHolidayNames;
  const visibleTodayCode = activeWeek === "current" ? todayCode : null;
  const [activeDay, setActiveDay] = useState<string>(() => resolveActiveDay(activeMenu, visibleTodayCode));

  useEffect(() => {
    setActiveDay((prev) => resolveActiveDay(activeMenu, visibleTodayCode, prev));
  }, [activeMenu, visibleTodayCode]);

  const showTray = activeWeek === "current" && activeDay === todayCode && (tray.soup !== null || tray.main !== null || trayStatus !== "idle");

  const handleWeekSwitch = (week: "current" | "next") => {
    setActiveWeek(week);
    setEditMode(false);
    setConfirmDeleteNext(false);
  };

  const shiftDay = useCallback((delta: 1 | -1) => {
    setActiveDay((prev) => {
      const idx = DAY_ORDER.indexOf(prev);
      const next = idx + delta;
      if (next < 0 || next >= DAY_ORDER.length) return prev;
      return DAY_ORDER[next];
    });
  }, []);
  const { swipeRef: daySwipeRef } = useDaySwipe(
    useCallback(() => shiftDay(1), [shiftDay]),
    useCallback(() => shiftDay(-1), [shiftDay]),
  );

  // ── Import ────────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setImportState({ phase: "error", message: "Soubor musí být PDF." });
      return;
    }
    setImportState({ phase: "uploading" });
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/menu/import", { method: "POST", body: fd });
      const data = await res.json() as ParseResult;
      if (!res.ok) {
        const err = data as { error?: string; warnings?: string[]; daysFound?: number; mealCount?: number; soupCount?: number };
        const diagnostics = err.warnings !== undefined && err.daysFound !== undefined && err.mealCount !== undefined && err.soupCount !== undefined
          ? { warnings: err.warnings, daysFound: err.daysFound, mealCount: err.mealCount, soupCount: err.soupCount }
          : undefined;
        setImportState({ phase: "error", message: err.error ?? "Neznámá chyba.", diagnostics });
        return;
      }
      const detectedStart = data.weekStart;
      let targetWeekStart: string;
      let targetLabel: string;
      if (detectedStart === nextWeekStart) {
        targetWeekStart = nextWeekStart;
        targetLabel = `příští týden${nextWeekLabel ? ` (${nextWeekLabel})` : ""}`;
      } else if (detectedStart && detectedStart !== currentWeekStart) {
        targetWeekStart = detectedStart;
        targetLabel = data.weekLabel ?? detectedStart;
      } else {
        targetWeekStart = currentWeekStart;
        targetLabel = `aktuální týden${currentWeekLabel ? ` (${currentWeekLabel})` : ""}`;
      }
      setImportState({ phase: "preview", result: data, targetWeekStart, targetLabel, tmpPdfName: data.tmpPdfName });
    } catch {
      setImportState({ phase: "error", message: "Síťová chyba. Zkuste to znovu." });
    }
  }, [currentWeekStart, currentWeekLabel, nextWeekStart, nextWeekLabel]);

  const handleConfirm = () => {
    if (importState.phase !== "preview") return;
    const { result, targetWeekStart, tmpPdfName } = importState;
    setImportState({ phase: "saving" });
    startTransition(async () => {
      const label = result.weekLabel ?? targetWeekStart;
      await actionConfirmMenuImport(targetWeekStart, label, result.items, tmpPdfName);
      setImportState({ phase: "done" });
      router.refresh();
    });
  };

  // ── Edit mode ─────────────────────────────────────────────────────────────

  const handleUpdate = useCallback((id: number, updates: Partial<{ code: string; name: string; price: number; allergens: string }>) => {
    const setMenu = activeWeek === "current" ? setCurrentMenu : setNextMenu;
    setMenu((prev) => {
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
  }, [activeWeek]);

  const handleDelete = useCallback((id: number) => {
    const setMenu = activeWeek === "current" ? setCurrentMenu : setNextMenu;
    startTransition(async () => {
      await actionDeleteMenuItem(id);
      setMenu((prev) => {
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
  }, [activeWeek]);

  const handleAdd = useCallback((day: string, type: "Polévka" | "Jídlo") => {
    const setMenu = activeWeek === "current" ? setCurrentMenu : setNextMenu;
    startTransition(async () => {
      const newItem = await actionAddMenuItem({
        day, type,
        code: type === "Polévka" ? "A" : "1",
        name: "",
        price: type === "Polévka" ? defaultSoupPrice : defaultMealPrice,
        weekStart: activeWeekStart,
      });
      setMenu((prev) => {
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
  }, [activeWeek, activeWeekStart, defaultSoupPrice, defaultMealPrice]);

  const handleDeleteNextWeek = () => {
    setConfirmDeleteNext(false);
    startTransition(async () => {
      await actionDeleteMenuWeek(nextWeekStart);
      router.refresh();
    });
  };

  const isImportOpen = importState.phase !== "idle" && importState.phase !== "done";

  useFocusTrap(importElRef, isImportOpen);
  // Focus restore when import modal opens/closes
  useEffect(() => {
    if (!isImportOpen) return;
    const trigger = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setImportState({ phase: "idle" }); };
    document.addEventListener("keydown", h);
    return () => { document.removeEventListener("keydown", h); trigger?.focus(); };
  }, [isImportOpen]);

  const dayMenu = activeMenu[activeDay] ?? { soups: [], meals: [] };
  const activeHolidayName = activeHolidayNames[activeDay];
  const activeHolidayEmoji = getHolidayEmoji(activeHolidayName);
  const isDayClosed = [...dayMenu.soups, ...dayMenu.meals].every(i => i.name === "Zavřeno") && (dayMenu.soups.length + dayMenu.meals.length) > 0;
  const displayDaySoups = dayMenu.soups.filter(i => i.name !== "Zavřeno");
  const displayDayMeals = dayMenu.meals.filter(i => i.name !== "Zavřeno");
  const isReadOnly = false;

  const dayDates: Record<string, number> = {};
  const dayMonths: Record<string, number> = {};
  const weekBase = new Date(activeWeekStart + "T00:00:00");
  DAY_ORDER.forEach((d, i) => {
    const dt = new Date(weekBase);
    dt.setDate(weekBase.getDate() + i);
    dayDates[d] = dt.getDate();
    dayMonths[d] = dt.getMonth() + 1;
  });
  const activeDayIdx = DAY_ORDER.indexOf(activeDay);
  const goToDay = (delta: -1 | 1) => {
    const next = Math.min(DAY_ORDER.length - 1, Math.max(0, activeDayIdx + delta));
    if (next !== activeDayIdx) setActiveDay(DAY_ORDER[next]);
  };

  return (
    <div className="k-shell">

      <PageHeader
        title="Jídelníček LIMA"
        leading={
          <div className="w-8 h-8 rounded-xl inline-flex items-center justify-center brand-grad brand-shadow--sm">
            <MIcon name="menu_book" size={16} fill className="text-white" />
          </div>
        }
        meta={(() => {
          const totalMeals = Object.values(activeMenu).reduce((s, d) => s + d.meals.filter(m => m.name !== "Zavřeno").length + d.soups.filter(s => s.name !== "Zavřeno").length, 0);
          const dayCount = Object.keys(activeMenu).filter(d => activeMenu[d] && (activeMenu[d].soups.some(i => i.name !== "Zavřeno") || activeMenu[d].meals.some(i => i.name !== "Zavřeno"))).length;
          return (
            <span className="inline-flex items-center gap-2 flex-wrap">
              {activeWeekLabel && (
                <span className="text-stone-600 font-medium">
                  <span className="hidden md:inline">Týden </span>
                  {activeWeekLabel}
                </span>
              )}
              {(dayCount > 0 || totalMeals > 0) && (
                <span className="text-stone-500 hidden sm:inline">
                  · {dayCount} {dayCount === 1 ? "den" : dayCount < 5 ? "dny" : "dní"} · {totalMeals} {totalMeals === 1 ? "položka" : totalMeals < 5 ? "položky" : "položek"}
                </span>
              )}
            </span>
          );
        })()}
        actions={
          <>
            <div className="relative">
              <button
                className={`hidden md:inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-2xl glass-btn ${filteredAllergens.size > 0 ? "text-amber-700" : "text-stone-600"}`}
                onClick={() => setShowAllergenFilter((v) => !v)}
                aria-expanded={showAllergenFilter}
                type="button"
              >
                <MIcon name="filter_alt" size={13} fill={filteredAllergens.size > 0} />
                Filtr alergenů
                {filteredAllergens.size > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {filteredAllergens.size}
                  </span>
                )}
              </button>
              {showAllergenFilter && (
                <AllergenFilterDropdown
                  filtered={filteredAllergens}
                  onToggle={toggleAllergen}
                  onClear={clearAllergens}
                  onClose={() => setShowAllergenFilter(false)}
                />
              )}
            </div>
            {hasPdfActive && (
              <a className="hidden md:inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600"
                download href={`/api/menu/pdf/${activeWeekStart}`}>
                ↓ PDF
              </a>
            )}
            <button
              className={`hidden md:inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
              onClick={() => { setEditMode((v) => !v); setImportState({ phase: "idle" }); }}
              type="button"
            >
              {editMode ? "Zavřít úpravu" : "Upravit ručně"}
            </button>
            {activeWeek === "next" && hasNextWeek && (
              <button
                className="hidden md:inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger active:scale-[0.97] transition disabled:opacity-50"
                disabled={isPending}
                onClick={() => setConfirmDeleteNext(true)}
                type="button"
              >
                Smazat příští týden
              </button>
            )}
            <button
              className="inline-flex items-center gap-1 md:gap-1.5 text-[11px] md:text-[12px] font-semibold px-2.5 md:px-3.5 py-1.5 md:py-2 rounded-xl md:rounded-2xl glass-btn text-stone-600"
              onClick={() => { setEditMode(false); setImportState({ phase: "uploading" }); }}
              type="button"
            >
              <MIcon name="upload_file" size={13} /> <span className="md:hidden">PDF</span><span className="hidden md:inline">Import PDF</span>
            </button>
          </>
        }
      />

      {/* Week tabs */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-1 shrink-0 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.6)", border: "1px solid #ede9e2", boxShadow: "0 1px 6px -2px rgba(0,0,0,0.08)" }}>
          <button
            className="flex flex-col items-center px-3.5 py-1.5 rounded-xl transition active:scale-[0.97] disabled:opacity-40 hover:bg-black/[0.05] disabled:hover:bg-transparent"
            onClick={() => handleWeekSwitch("current")}
            type="button"
            style={activeWeek === "current"
              ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)" }
              : {}}
          >
            <span className={`text-[11px] font-semibold leading-none ${activeWeek === "current" ? "text-white/80" : "text-stone-600"}`}>Aktuální</span>
            <span className={`text-[13px] font-bold leading-tight mt-0.5 ${activeWeek === "current" ? "text-white" : "text-stone-800"}`}>{formatWeekRange(currentWeekStart)}</span>
          </button>
          <button
            className="flex flex-col items-center px-3.5 py-1.5 rounded-xl transition active:scale-[0.97] disabled:opacity-40 hover:bg-black/[0.05] disabled:hover:bg-transparent"
            disabled={!hasNextWeek}
            onClick={() => handleWeekSwitch("next")}
            type="button"
            style={activeWeek === "next"
              ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)" }
              : {}}
          >
            <span className={`text-[11px] font-semibold leading-none ${activeWeek === "next" ? "text-white/80" : "text-stone-600"}`}>Příští</span>
            <span className={`text-[13px] font-bold leading-tight mt-0.5 ${activeWeek === "next" ? "text-white" : "text-stone-800"}`}>{hasNextWeek ? formatWeekRange(nextWeekStart) : "—"}</span>
          </button>
        </div>
        {hasPdfActive && (
          <a className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600 md:hidden"
            download href={`/api/menu/pdf/${activeWeekStart}`}>
            ↓ PDF
          </a>
        )}
        {activeWeek === "current" && (
          <button
            className={`md:hidden inline-flex items-center text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
            onClick={() => { setEditMode((v) => !v); setImportState({ phase: "idle" }); }}
            type="button"
          >
            {editMode ? "Zavřít" : "Upravit"}
          </button>
        )}
      </div>

      {/* Compact day nav (V4 style) — mobile only */}
      <div className="md:hidden flex items-center gap-3 px-4 py-2 shrink-0">
        <button
          aria-label="Předchozí den"
          className="w-9 h-9 rounded-full glass-btn inline-flex items-center justify-center text-stone-600 shrink-0 disabled:opacity-30 active:scale-95 transition"
          disabled={activeDayIdx === 0}
          onClick={() => goToDay(-1)}
          type="button"
        >
          <MIcon name="chevron_left" size={17} />
        </button>
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <span className="font-display font-bold text-[15px] text-stone-900 leading-none inline-flex items-center gap-1.5">
            <span>{activeDay} {dayDates[activeDay]}.{dayMonths[activeDay]}.</span>
            {visibleTodayCode === activeDay && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white brand-grad">
                Dnes
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Dny v týdnu">
            {DAY_ORDER.map((d) => {
              const isActive = activeDay === d;
              const isToday = visibleTodayCode === d;
              return (
                <button
                  key={d}
                  aria-label={DAY_LABELS[d]}
                  aria-selected={isActive}
                  role="tab"
                  onClick={() => setActiveDay(d)}
                  type="button"
                  className="transition-all duration-200 rounded-full"
                  style={{
                    width: isActive ? "20px" : "7px",
                    height: "7px",
                    background: isActive
                      ? "linear-gradient(135deg,#F59E0B,#EA580C)"
                      : isToday
                        ? "rgba(245,158,11,0.45)"
                        : "rgba(26,18,8,0.18)",
                  }}
                />
              );
            })}
          </div>
        </div>
        <button
          aria-label="Další den"
          className="w-9 h-9 rounded-full glass-btn inline-flex items-center justify-center text-stone-600 shrink-0 disabled:opacity-30 active:scale-95 transition"
          disabled={activeDayIdx === DAY_ORDER.length - 1}
          onClick={() => goToDay(1)}
          type="button"
        >
          <MIcon name="chevron_right" size={17} />
        </button>
      </div>

      {/* Desktop + tablet: week grid (tablet scrolls horizontally with day picker) */}
      <div className="hidden md:flex flex-col flex-1 overflow-hidden pt-3">
        <div className="max-w-7xl mx-auto w-full px-4 lg:hidden flex gap-1.5 pb-2 overflow-x-auto no-scrollbar shrink-0">
          {DAY_ORDER.map((day) => {
            const isToday = day === visibleTodayCode;
            return (
              <button
                key={day}
                onClick={() => {
                  const el = document.querySelector(`[data-day="${day}"]`) as HTMLElement | null;
                  el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
                }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-btn text-[12px] font-semibold text-stone-700"
                type="button"
              >
                <span className={`text-[10px] uppercase tracking-wide ${isToday ? "text-amber-600" : "text-stone-400"}`}>{day}</span>
                <span className="font-display font-bold">{dayDates[day]}</span>
                {isToday && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#F59E0B" }} />}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto scroll-area px-4 pb-nav lg:pb-8" tabIndex={0}>
          <div className="max-w-screen-2xl mx-auto w-full overflow-x-auto lg:overflow-x-visible snap-x lg:snap-none no-scrollbar">
            <WeekGrid
              dayDates={dayDates}
              defaultMealPrice={defaultMealPrice}
              defaultSoupPrice={defaultSoupPrice}
              disabled={isPending}
              editMode={!isReadOnly && editMode}
              filteredAllergens={filteredAllergens}
              holidayNames={activeHolidayNames}
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
              traySoupId={tray.soup?.id ?? null}
              trayMainId={tray.main?.id ?? null}
              onTrayToggle={handleTrayToggle}
            />
          </div>
        </div>
      </div>

      {/* Mobile: single day view */}
      <div className="md:hidden flex-1 overflow-y-auto scroll-area px-4 pb-nav" ref={daySwipeRef as React.RefCallback<HTMLDivElement>}>
        <div className="space-y-3">
          <div className="font-display font-bold text-[17px] text-stone-900 mb-1 pt-2">{DAY_LABELS[activeDay]}</div>
          {isDayClosed ? (
            <div className="glass-card rounded-3xl overflow-hidden">
              <div
                className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40"
                style={{ background: "rgba(245,158,11,0.08)" }}
              >
                <div
                  className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,158,11,0.14)" }}
                >
                  {activeHolidayName ? (
                    <span className="text-[18px] leading-none">{activeHolidayEmoji}</span>
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
                    {activeHolidayName ?? "Zavřeno"}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {activeHolidayName ? "Svátek / zavřeno" : "V tento den není jídelníček k dispozici."}
                  </div>
                </div>
              </div>
              <div className="px-4 py-4 flex flex-col items-center gap-3">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium text-stone-600"
                  style={{ background: "rgba(255,255,255,0.58)", border: "1px solid rgba(245,158,11,0.14)" }}
                >
                  <MIcon name="info" size={14} style={{ color: "#D97706" }} />
                  <span>{activeHolidayName ? "V tento den se jídla nevydávají." : "Zkuste jiný den nebo doplnit menu v editaci."}</span>
                </div>
                {!isReadOnly && editMode && (
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
              <div className={`day-col${activeDay === visibleTodayCode ? " is-today" : ""}`}>
                <MenuSection
                  defaultPrice={defaultSoupPrice}
                  disabled={isPending}
                  editMode={!isReadOnly && editMode}
                  emptyLabel="Žádné polévky pro tento den."
                  filteredAllergens={filteredAllergens}
                  isToday={activeDay === visibleTodayCode}
                  items={displayDaySoups}
                  onAdd={() => handleAdd(activeDay, "Polévka")}
                  onEdit={(item) => setEditingItem(item)}
                  title="Polévky"
                  traySelectedId={tray.soup?.id ?? null}
                  onTrayToggle={handleTrayToggle}
                />
                <MenuSection
                  defaultPrice={defaultMealPrice}
                  disabled={isPending}
                  editMode={!isReadOnly && editMode}
                  emptyLabel="Žádná jídla pro tento den."
                  filteredAllergens={filteredAllergens}
                  isToday={activeDay === visibleTodayCode}
                  items={displayDayMeals}
                  onAdd={() => handleAdd(activeDay, "Jídlo")}
                  onEdit={(item) => setEditingItem(item)}
                  title="Hlavní jídla"
                  traySelectedId={tray.main?.id ?? null}
                  onTrayToggle={handleTrayToggle}
                />
              </div>
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

      {/* Menu item edit modal */}
      {editingItem !== null && (
        <MenuItemEditModal
          disabled={isPending}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onRequestDelete={(id) => { setEditingItem(null); setConfirmDeleteItemId(id); }}
          onSave={(id, updates) => handleUpdate(id, updates)}
        />
      )}

      {/* Confirm modals */}
      {confirmDeleteItemId !== null && (
        <ConfirmModal
          message="Tato položka jídelníčku bude trvale odstraněna."
          onClose={() => setConfirmDeleteItemId(null)}
          onConfirm={() => { handleDelete(confirmDeleteItemId); setConfirmDeleteItemId(null); }}
          title="Smazat položku"
        />
      )}
      {confirmDeleteNext && (
        <ConfirmModal
          confirmLabel="Smazat"
          isPending={isPending}
          message="Celý jídelníček příštího týdne bude trvale odstraněn."
          onClose={() => setConfirmDeleteNext(false)}
          onConfirm={handleDeleteNextWeek}
          title="Smazat příští týden"
        />
      )}

      {/* Import modal */}
      {isImportOpen && (
        <div
          className="modal-overlay"
          onClick={() => setImportState({ phase: "idle" })}
        >
          <div
            className={`modal-sheet${importState.phase === "preview" ? " !w-full sm:!w-[760px]" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            onClick={(e) => e.stopPropagation()}
            ref={importSheetRef}
          >
            <div className="modal-sheet__drag-handle" aria-hidden />
            <div className="modal-sheet__header">
              <h3 className="modal-sheet__title" id="import-modal-title">
                {importState.phase === "preview" ? "Náhled importu" : "Importovat PDF jídelníčku"}
              </h3>
              <button
                aria-label="Zavřít"
                className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 font-bold"
                onClick={() => setImportState({ phase: "idle" })}
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
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  >
                    <MIcon name="upload_file" size={32} style={{ color: "#D97706" }} />
                    <p className="text-[13px] text-stone-600 text-center">Přetáhněte PDF sem nebo klikněte pro výběr</p>
                    <input accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} ref={fileInputRef} style={{ display: "none" }} type="file" />
                  </div>
                  <p className="text-[12px] text-stone-400 text-center">Čekám na soubor...</p>
                </>
              )}
              {importState.phase === "error" && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700 space-y-3">
                  <div>
                    <strong>Chyba:</strong> {importState.message}
                    <button className="ml-3 text-[12px] font-semibold text-red-600 underline" onClick={() => setImportState({ phase: "uploading" })} type="button">Zkusit znovu</button>
                  </div>
                  {importState.diagnostics && (
                    <div className="pt-3 border-t border-red-200/70 space-y-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                        <span><strong>Dnů:</strong> {importState.diagnostics.daysFound}/5</span>
                        <span><strong>Jídel:</strong> {importState.diagnostics.mealCount}</span>
                        <span><strong>Polévek:</strong> {importState.diagnostics.soupCount}</span>
                      </div>
                      {importState.diagnostics.warnings.length > 0 && (
                        <div>
                          <div className="text-[12px] font-semibold mb-1">Detekované problémy:</div>
                          <ul className="list-disc pl-5 text-[12px] space-y-0.5 text-red-600">
                            {importState.diagnostics.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {importState.phase === "preview" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] text-stone-600">
                      Rozpoznáno <strong>{importState.result.items.length}</strong> položek
                      {importState.result.weekLabel && <>, týden <strong>{importState.result.weekLabel}</strong></>}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-[11px] text-stone-400">Uložit jako:</span>
                      <button
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${importState.targetWeekStart === currentWeekStart ? "text-white" : "glass-btn text-stone-600"}`}
                        onClick={() => setImportState((prev) => prev.phase === "preview" ? { ...prev, targetWeekStart: currentWeekStart, targetLabel: `aktuální týden${currentWeekLabel ? ` (${currentWeekLabel})` : ""}` } : prev)}
                        style={importState.targetWeekStart === currentWeekStart ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
                        type="button"
                      >
                        Aktuální
                      </button>
                      <button
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${importState.targetWeekStart === nextWeekStart ? "text-white" : "glass-btn text-stone-600"}`}
                        onClick={() => setImportState((prev) => prev.phase === "preview" ? { ...prev, targetWeekStart: nextWeekStart, targetLabel: `příští týden${nextWeekLabel ? ` (${nextWeekLabel})` : ""}` } : prev)}
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
                <button className="modal-btn modal-btn--secondary" onClick={() => setImportState({ phase: "idle" })} type="button">Zrušit</button>
                <button className="modal-btn modal-btn--primary" disabled={isPending} onClick={handleConfirm} type="button">
                  {isPending ? "Ukládám..." : "Uložit jídelníček"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plovoucí tráček rychlého objednávání */}
      {showTray && (
        <FloatingOrderTray
          selectedSoup={tray.soup}
          selectedMain={tray.main}
          defaultSoupPrice={defaultSoupPrice}
          defaultMealPrice={defaultMealPrice}
          hasDefaultDept={!!userDefaultDepartment}
          onRemoveSoup={() => handleTrayToggle(tray.soup!)}
          onRemoveMain={() => handleTrayToggle(tray.main!)}
          onOrder={handleTrayOrder}
          status={trayStatus}
          errorMsg={trayError}
        />
      )}
    </div>
  );
}
