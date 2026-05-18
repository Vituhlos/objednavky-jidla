"use client";

import { useState, useRef, useTransition, useCallback, useEffect, memo, useMemo } from "react";
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
} from "@/app/actions";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";

const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"];
const DAY_LABELS: Record<string, string> = {
  Po: "Pondělí", Út: "Úterý", St: "Středa", Čt: "Čtvrtek", Pá: "Pátek",
};

const AutoTextarea = memo(function AutoTextarea({ defaultValue, disabled, onCommit, placeholder, title }: {
  defaultValue: string; disabled: boolean; placeholder?: string; title?: string;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [defaultValue]);
  return (
    <textarea
      ref={ref}
      className="bg-white/50 border border-white/60 rounded-lg py-1.5 px-2.5 text-[13px] text-stone-800 w-full outline-none focus:border-amber-400/60 resize-none overflow-hidden leading-snug"
      defaultValue={defaultValue}
      disabled={disabled}
      onBlur={(e) => { if (e.target.value !== defaultValue) onCommit(e.target.value); }}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }}
      placeholder={placeholder}
      rows={1}
      title={title}
    />
  );
});

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
  nextMenu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  nextHolidayNames: Record<string, string | null>;
  nextWeekLabel: string | null;
  nextWeekStart: string;
  todayCode: string | null;
  hasPdfCurrent: boolean;
  hasPdfNext: boolean;
  isAdmin: boolean;
  soupPrice: number;
  mealPrice: number;
}

type ImportState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "preview"; result: ParseResult; targetWeekStart: string; targetLabel: string; tmpPdfName?: string }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

type UpdateFields = Partial<{ code: string; name: string; price: number; allergens: string }>;

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

// ── Allergen badges ────────────────────────────────────────────────────────────

const ALLERGEN_NAMES: Record<number, string> = {
  1: "Lepek", 2: "Korýši", 3: "Vejce", 4: "Ryby", 5: "Arašídy",
  6: "Sója", 7: "Mléko", 8: "Ořechy", 9: "Celer", 10: "Hořčice",
  11: "Sezam", 12: "Siřičitany", 13: "Vlčí bob", 14: "Měkkýši",
};

const AllergenBadges = memo(function AllergenBadges({ allergens }: { allergens: string }) {
  const nums = allergens.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 14);
  if (nums.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-0.5 mt-0.5">
      {nums.map((n) => (
        <span key={n} title={ALLERGEN_NAMES[n]}
          className="inline-block text-[9.5px] font-semibold leading-none px-1 py-0.5 rounded"
          style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>
          {n}
        </span>
      ))}
    </span>
  );
});

// ── Matrix cell ────────────────────────────────────────────────────────────────

const MatrixCell = memo(function MatrixCell({
  item, displayPrice, editMode, disabled, onDelete, onUpdate,
}: {
  item: MenuItem;
  displayPrice: number;
  editMode: boolean;
  disabled: boolean;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: UpdateFields) => void;
}) {
  if (editMode) {
    return (
      <div className="space-y-1 py-0.5">
        <div className="flex items-start gap-1">
          <input
            className="flex-1 min-w-0 bg-white/50 border border-white/60 rounded-lg py-1 px-2 text-[12px] text-stone-800 outline-none focus:border-amber-400/60"
            defaultValue={item.name}
            disabled={disabled}
            onBlur={(e) => { if (e.target.value !== item.name) onUpdate(item.id, { name: e.target.value }); }}
            placeholder="Název"
          />
          <button
            className="shrink-0 w-6 h-6 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 transition"
            disabled={disabled}
            onClick={() => onDelete(item.id)}
            type="button"
          >
            <MIcon name="close" size={11} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            className="w-9 bg-white/50 border border-white/60 rounded-lg py-0.5 px-1 text-[10px] font-mono text-stone-600 text-center outline-none focus:border-amber-400/60"
            defaultValue={item.code}
            disabled={disabled}
            onBlur={(e) => { if (e.target.value !== item.code) onUpdate(item.id, { code: e.target.value }); }}
            title="Kód"
          />
          <input
            className="flex-1 min-w-0 bg-white/50 border border-white/60 rounded-lg py-0.5 px-1.5 text-[10px] text-stone-500 outline-none focus:border-amber-400/60"
            defaultValue={item.allergens}
            disabled={disabled}
            onBlur={(e) => { if (e.target.value !== item.allergens) onUpdate(item.id, { allergens: e.target.value }); }}
            placeholder="Alergeny…"
          />
          <span className="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full text-amber-700 whitespace-nowrap"
            style={{ background: "rgba(245,158,11,0.12)" }}>
            {displayPrice} Kč
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="py-0.5">
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-stone-800 leading-snug font-medium">{item.name}</div>
          {item.allergens && <AllergenBadges allergens={item.allergens} />}
          <div className="font-mono text-[9.5px] text-stone-400 mt-0.5">{item.code}</div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full text-amber-700 mt-0.5 whitespace-nowrap"
          style={{ background: "rgba(245,158,11,0.12)" }}>
          {displayPrice} Kč
        </span>
      </div>
    </div>
  );
});

// ── Matrix table (desktop) ─────────────────────────────────────────────────────

type FilteredDay = { soups: MenuItem[]; meals: MenuItem[]; isClosed: boolean };

const MatrixTable = memo(function MatrixTable({
  menu, dayDates, todayCode, holidayNames, editMode, disabled,
  soupPrice, mealPrice, onAdd, onDelete, onUpdate, onCloseDay, onOpenDay,
}: {
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  dayDates: Record<string, number>;
  todayCode: string | null;
  holidayNames: Record<string, string | null>;
  editMode: boolean;
  disabled: boolean;
  soupPrice: number;
  mealPrice: number;
  onAdd: (day: string, type: "Polévka" | "Jídlo") => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: UpdateFields) => void;
  onCloseDay: (day: string) => void;
  onOpenDay: (day: string) => void;
}) {
  const filteredMenu = useMemo<Record<string, FilteredDay>>(() => {
    const result: Record<string, FilteredDay> = {};
    for (const day of DAY_ORDER) {
      const d = menu[day] ?? { soups: [], meals: [] };
      const allItems = [...d.soups, ...d.meals];
      const isClosed = allItems.length > 0 && allItems.every(i => i.name === "Zavřeno");
      result[day] = {
        soups: d.soups.filter(i => i.name !== "Zavřeno"),
        meals: d.meals.filter(i => i.name !== "Zavřeno"),
        isClosed,
      };
    }
    return result;
  }, [menu]);

  const maxSoups = Math.max(0, ...DAY_ORDER.map(d => filteredMenu[d].soups.length));
  const maxMeals = Math.max(0, ...DAY_ORDER.map(d => filteredMenu[d].meals.length));
  const soupCount = editMode ? Math.max(1, maxSoups) : maxSoups;
  const mealCount = editMode ? Math.max(1, maxMeals) : maxMeals;

  if (soupCount === 0 && mealCount === 0) {
    return (
      <div className="glass rounded-3xl px-6 py-14 text-center">
        <MIcon name="no_meals" size={36} style={{ color: "#d6d3d1" }} />
        <p className="text-[13px] text-stone-400 mt-3">Pro tento týden ještě nebyl zadán jídelníček.</p>
        <p className="text-[11.5px] text-stone-300 mt-1">Importujte PDF nebo zapněte editaci a přidejte položky ručně.</p>
      </div>
    );
  }

  const FIRST_COL_W = 156;
  const DAY_COL_W = 188;
  const cellBorder = "1px solid rgba(255,255,255,0.45)";
  const sepBorder = "2px solid rgba(245,158,11,0.16)";

  const stickyFirstBase: React.CSSProperties = {
    position: "sticky",
    left: 0,
    background: "rgba(248,246,242,0.88)",
    backdropFilter: "blur(12px)",
    borderRight: cellBorder,
    zIndex: 10,
  };

  return (
    <div style={{
      borderRadius: 24,
      background: "rgba(255,255,255,0.45)",
      backdropFilter: "blur(20px) saturate(180%)",
      border: "1px solid rgba(255,255,255,0.6)",
      boxShadow: "0 4px 24px -8px rgba(0,0,0,0.07)",
      overflow: "clip",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{
          borderCollapse: "separate",
          borderSpacing: 0,
          minWidth: FIRST_COL_W + DAY_ORDER.length * DAY_COL_W,
          width: "100%",
          tableLayout: "fixed",
        }}>
          <colgroup>
            <col style={{ width: FIRST_COL_W }} />
            {DAY_ORDER.map(d => <col key={d} style={{ width: DAY_COL_W }} />)}
          </colgroup>

          {/* Day header row */}
          <thead>
            <tr>
              <th style={{
                ...stickyFirstBase,
                zIndex: 30,
                top: 0,
                padding: "10px 14px",
                borderBottom: cellBorder,
                textAlign: "left",
              }}>
                <span className="font-display text-[10px] uppercase tracking-widest font-semibold text-stone-400">Položka</span>
              </th>
              {DAY_ORDER.map((day) => {
                const isToday = day === todayCode;
                const { isClosed } = filteredMenu[day];
                const holidayName = holidayNames[day];
                return (
                  <th key={day} style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                    padding: "10px 14px",
                    background: isToday ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.60)",
                    backdropFilter: "blur(12px)",
                    borderBottom: cellBorder,
                    borderLeft: cellBorder,
                    textAlign: "left",
                  }}>
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className={`font-display font-bold text-[20px] leading-none ${isToday ? "text-amber-600" : "text-stone-900"}`}>
                          {dayDates[day]}
                        </div>
                        <div className={`text-[11px] font-semibold mt-0.5 ${isToday ? "text-amber-500" : "text-stone-500"}`}>
                          {DAY_LABELS[day]}
                        </div>
                      </div>
                      {isToday && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 mt-0.5"
                          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
                          Dnes
                        </span>
                      )}
                    </div>
                    {isClosed && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9.5px] font-semibold text-stone-400 px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(26,18,8,0.06)" }}>
                          {holidayName ?? "Zavřeno"}
                        </span>
                        {editMode && !holidayName && (
                          <button className="text-[9px] font-semibold text-stone-400 hover:text-stone-600 transition"
                            disabled={disabled} onClick={() => onOpenDay(day)} type="button">
                            Otevřít
                          </button>
                        )}
                      </div>
                    )}
                    {editMode && !isClosed && (
                      <button
                        className="mt-1.5 text-[9px] font-semibold text-red-400 hover:text-red-600 transition block"
                        disabled={disabled}
                        onClick={() => onCloseDay(day)}
                        type="button"
                      >
                        Uzavřít den
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {/* Soup rows */}
            {Array.from({ length: soupCount }, (_, i) => (
              <tr key={`soup-${i}`} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.16)" }}>
                <td style={{
                  ...stickyFirstBase,
                  padding: "10px 14px",
                  borderBottom: i === soupCount - 1 ? sepBorder : cellBorder,
                }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg inline-flex items-center justify-center shrink-0"
                      style={{ background: "rgba(59,130,246,0.12)" }}>
                      <MIcon name="soup_kitchen" size={13} fill style={{ color: "#2563eb" }} />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-[12px] text-stone-700 leading-tight">Polévka {i + 1}</div>
                      <div className="font-mono text-[9px] text-stone-400">P{i + 1}</div>
                    </div>
                  </div>
                </td>
                {DAY_ORDER.map((day) => {
                  const { soups, isClosed } = filteredMenu[day];
                  const item = soups[i];
                  const isToday = day === todayCode;
                  return (
                    <td key={day} style={{
                      padding: "8px 12px",
                      borderBottom: i === soupCount - 1 ? sepBorder : cellBorder,
                      borderLeft: cellBorder,
                      background: isToday ? "rgba(245,158,11,0.04)" : undefined,
                      verticalAlign: "top",
                    }}>
                      {isClosed ? (
                        <span className="text-[11px] text-stone-300">—</span>
                      ) : item ? (
                        <MatrixCell item={item} displayPrice={soupPrice} editMode={editMode}
                          disabled={disabled} onDelete={onDelete} onUpdate={onUpdate} />
                      ) : editMode ? (
                        <button
                          className="w-full text-[11px] font-semibold text-stone-300 rounded-xl py-2 px-2 hover:border-amber-300 hover:text-amber-600 transition border-2 border-dashed border-stone-200/70"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Polévka")}
                          type="button"
                        >
                          + Přidat
                        </button>
                      ) : (
                        <span className="text-[11px] text-stone-200">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Meal rows */}
            {Array.from({ length: mealCount }, (_, i) => (
              <tr key={`meal-${i}`} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.16)" }}>
                <td style={{
                  ...stickyFirstBase,
                  padding: "10px 14px",
                  borderBottom: i < mealCount - 1 ? cellBorder : undefined,
                }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg inline-flex items-center justify-center shrink-0"
                      style={{ background: "rgba(234,88,12,0.10)" }}>
                      <MIcon name="restaurant" size={13} fill style={{ color: "#EA580C" }} />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-[12px] text-stone-700 leading-tight">Jídlo {i + 1}</div>
                      <div className="font-mono text-[9px] text-stone-400">J{i + 1}</div>
                    </div>
                  </div>
                </td>
                {DAY_ORDER.map((day) => {
                  const { meals, isClosed } = filteredMenu[day];
                  const item = meals[i];
                  const isToday = day === todayCode;
                  return (
                    <td key={day} style={{
                      padding: "8px 12px",
                      borderBottom: i < mealCount - 1 ? cellBorder : undefined,
                      borderLeft: cellBorder,
                      background: isToday ? "rgba(245,158,11,0.04)" : undefined,
                      verticalAlign: "top",
                    }}>
                      {isClosed ? (
                        <span className="text-[11px] text-stone-300">—</span>
                      ) : item ? (
                        <MatrixCell item={item} displayPrice={mealPrice} editMode={editMode}
                          disabled={disabled} onDelete={onDelete} onUpdate={onUpdate} />
                      ) : editMode ? (
                        <button
                          className="w-full text-[11px] font-semibold text-stone-300 rounded-xl py-2 px-2 hover:border-amber-300 hover:text-amber-600 transition border-2 border-dashed border-stone-200/70"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Jídlo")}
                          type="button"
                        >
                          + Přidat
                        </button>
                      ) : (
                        <span className="text-[11px] text-stone-200">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ── Mobile menu section ────────────────────────────────────────────────────────

const MenuSection = memo(function MenuSection({
  title, icon, accent, iconColor, items, displayPrice,
  disabled, editMode, emptyLabel, onAdd, onDelete, onUpdate,
}: {
  title: string;
  icon: string;
  accent: string;
  iconColor: string;
  items: MenuItem[];
  displayPrice: number;
  disabled: boolean;
  editMode: boolean;
  emptyLabel: string;
  onAdd?: () => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: UpdateFields) => void;
}) {
  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: accent }}>
        <MIcon name={icon} size={17} fill style={{ color: iconColor }} />
        <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">{title}</span>
        {editMode && onAdd && (
          <button
            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
            disabled={disabled}
            onClick={onAdd}
            style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
            type="button"
          >
            <MIcon name="add" size={13} /> Přidat
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-4 text-[12.5px] text-stone-400 text-center">{emptyLabel}</div>
      ) : editMode ? (
        <div className="px-4 divide-y divide-white/30">
          {items.map((item) => (
            <div key={item.id} className="group py-2 space-y-1.5">
              <AutoTextarea
                defaultValue={item.name}
                disabled={disabled}
                onCommit={(v) => onUpdate(item.id, { name: v })}
                placeholder="Název jídla"
                title="Název"
              />
              <div className="flex items-center gap-2">
                <input
                  className="bg-white/50 border border-white/60 rounded-lg py-1 px-2 text-[11px] font-mono w-10 shrink-0 text-center outline-none focus:border-amber-400/60"
                  defaultValue={item.code}
                  disabled={disabled}
                  onBlur={(e) => { if (e.target.value !== item.code) onUpdate(item.id, { code: e.target.value }); }}
                  title="Kód"
                />
                <span className="text-[12px] font-semibold px-2 py-1 rounded-lg text-amber-700"
                  style={{ background: "rgba(245,158,11,0.12)" }}>
                  {displayPrice} Kč
                </span>
                <button
                  aria-label="Smazat položku"
                  className="ml-auto w-11 h-11 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 transition shrink-0"
                  disabled={disabled}
                  onClick={() => onDelete(item.id)}
                  type="button"
                >
                  <MIcon name="close" size={15} />
                </button>
              </div>
              <input
                className="bg-white/50 border border-white/60 rounded-lg py-1 px-2 text-[11px] text-stone-600 w-full outline-none focus:border-amber-400/60"
                defaultValue={item.allergens}
                disabled={disabled}
                onBlur={(e) => { if (e.target.value !== item.allergens) onUpdate(item.id, { allergens: e.target.value }); }}
                placeholder="Alergeny: 1, 3, 7…"
                title="Čísla alergenů oddělená čárkou (1–14)"
              />
            </div>
          ))}
        </div>
      ) : (
        items.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-start gap-2 px-4 py-2.5 ${i < items.length - 1 ? "border-b border-white/30" : ""}`}
          >
            <span className="font-mono text-[11px] text-stone-400 w-6 shrink-0 text-right mt-[3px]">{item.code}</span>
            <span className="flex-1 min-w-0 text-[13px] text-stone-800 leading-snug">
              {item.name}
              {item.allergens && <AllergenBadges allergens={item.allergens} />}
            </span>
            <span className="shrink-0 font-semibold text-[12.5px] text-amber-700 tabular-nums mt-[2px]">
              {displayPrice} Kč
            </span>
          </div>
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
  nextMenu: initialNextMenu,
  nextHolidayNames,
  nextWeekLabel,
  nextWeekStart,
  todayCode,
  currentHolidayNames,
  hasPdfCurrent,
  hasPdfNext,
  isAdmin,
  soupPrice,
  mealPrice,
}: Props) {
  const [currentMenu, setCurrentMenu] = useState(initialCurrentMenu);
  const prevMenuPropsRef = useRef(initialCurrentMenu);
  if (prevMenuPropsRef.current !== initialCurrentMenu) {
    prevMenuPropsRef.current = initialCurrentMenu;
    setCurrentMenu(initialCurrentMenu);
  }
  const [activeWeek, setActiveWeek] = useState<"current" | "next">("current");
  const [editMode, setEditMode] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteNext, setConfirmDeleteNext] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const hasNextWeek = Object.keys(initialNextMenu).length > 0;
  const activeWeekStart = activeWeek === "current" ? currentWeekStart : nextWeekStart;
  const activeWeekLabel = activeWeek === "current" ? currentWeekLabel : nextWeekLabel;
  const hasPdfActive = activeWeek === "current" ? hasPdfCurrent : hasPdfNext;
  const activeMenu = activeWeek === "current" ? currentMenu : initialNextMenu;
  const activeHolidayNames = activeWeek === "current" ? currentHolidayNames : nextHolidayNames;
  const visibleTodayCode = activeWeek === "current" ? todayCode : null;
  const [activeDay, setActiveDay] = useState<string>(() => resolveActiveDay(activeMenu, visibleTodayCode));

  useEffect(() => {
    setActiveDay((prev) => resolveActiveDay(activeMenu, visibleTodayCode, prev));
  }, [activeMenu, visibleTodayCode]);

  const handleWeekSwitch = (week: "current" | "next") => {
    setActiveWeek(week);
    setEditMode(false);
    setConfirmDeleteNext(false);
  };

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
        setImportState({ phase: "error", message: (data as { error?: string }).error ?? "Neznámá chyba." });
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

  // ── Edit handlers ─────────────────────────────────────────────────────────

  const handleUpdate = useCallback((id: number, updates: UpdateFields) => {
    setCurrentMenu((prev) => {
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
  }, []);

  const handleDelete = useCallback((id: number) => {
    startTransition(async () => {
      await actionDeleteMenuItem(id);
      setCurrentMenu((prev) => {
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
  }, []);

  const handleAdd = useCallback((day: string, type: "Polévka" | "Jídlo") => {
    startTransition(async () => {
      const newItem = await actionAddMenuItem({
        day, type,
        code: type === "Polévka" ? "A" : "1",
        name: type === "Polévka" ? "Nová polévka" : "Nové jídlo",
        price: type === "Polévka" ? soupPrice : mealPrice,
        weekStart: currentWeekStart,
      });
      setCurrentMenu((prev) => {
        const dayData = prev[day] ?? { soups: [], meals: [] };
        return {
          ...prev,
          [day]: {
            soups: type === "Polévka" ? [...dayData.soups, newItem] : dayData.soups,
            meals: type === "Jídlo" ? [...dayData.meals, newItem] : dayData.meals,
          },
        };
      });
    });
  }, [currentWeekStart, soupPrice, mealPrice]);

  const handleDeleteNextWeek = () => {
    setConfirmDeleteNext(false);
    startTransition(async () => {
      await actionDeleteMenuWeek(nextWeekStart);
      router.refresh();
    });
  };

  const isImportOpen = importState.phase !== "idle" && importState.phase !== "done";
  const isReadOnly = activeWeek === "next";

  const dayMenu = activeMenu[activeDay] ?? { soups: [], meals: [] };
  const activeHolidayName = activeHolidayNames[activeDay];
  const activeHolidayEmoji = getHolidayEmoji(activeHolidayName);
  const isDayClosed = [...dayMenu.soups, ...dayMenu.meals].every(i => i.name === "Zavřeno") && (dayMenu.soups.length + dayMenu.meals.length) > 0;
  const displayDaySoups = dayMenu.soups.filter(i => i.name !== "Zavřeno");
  const displayDayMeals = dayMenu.meals.filter(i => i.name !== "Zavřeno");

  const dayDates: Record<string, number> = {};
  const weekBase = new Date(activeWeekStart + "T00:00:00");
  DAY_ORDER.forEach((d, i) => {
    const dt = new Date(weekBase);
    dt.setDate(weekBase.getDate() + i);
    dayDates[d] = dt.getDate();
  });

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
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            {activeWeek === "current" && (
              <button
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
                onClick={() => { setEditMode((v) => !v); setImportState({ phase: "idle" }); }}
                type="button"
              >
                {editMode ? "Zavřít úpravu" : "Upravit ručně"}
              </button>
            )}
            {activeWeek === "next" && hasNextWeek && (
              <button
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger active:scale-[0.97] transition disabled:opacity-50"
                disabled={isPending}
                onClick={() => setConfirmDeleteNext(true)}
                type="button"
              >
                Smazat příští týden
              </button>
            )}
            <button
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
              onClick={() => { setEditMode(false); setImportState({ phase: "uploading" }); }}
              type="button"
            >
              <MIcon name="upload_file" size={14} /> Import PDF
            </button>
          </div>
        )}
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Jídelníček LIMA</span>
          {activeWeekLabel && <span className="text-[11px] text-stone-500">{activeWeekLabel}</span>}
          {isAdmin && (
            <button
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600"
              onClick={() => { setEditMode(false); setImportState({ phase: "uploading" }); }}
              type="button"
            >
              <MIcon name="upload_file" size={13} /> PDF
            </button>
          )}
        </div>
      </div>

      {/* Week tabs */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0">
        <div className="flex p-1 rounded-2xl gap-0.5" style={{ background: "rgba(26,18,8,0.07)", border: "1px solid rgba(255,255,255,0.55)" }}>
          {(["current", "next"] as const).map((week) => {
            const active = activeWeek === week;
            const label = week === "current" ? "Aktuální týden" : "Příští týden";
            return (
              <button
                key={week}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-[0.97] ${active ? "" : "text-stone-500 hover:text-stone-700 hover:bg-white/60"}`}
                onClick={() => handleWeekSwitch(week)}
                style={active ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", color: "white", boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)" } : {}}
                type="button"
              >
                {label}
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
        {isAdmin && activeWeek === "current" && (
          <button
            className={`md:hidden inline-flex items-center text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
            onClick={() => { setEditMode((v) => !v); setImportState({ phase: "idle" }); }}
            type="button"
          >
            {editMode ? "Zavřít" : "Upravit"}
          </button>
        )}
      </div>

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
              onClick={() => setActiveDay(day)}
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

      {/* Desktop: matrix table */}
      <div className="hidden md:block flex-1 overflow-y-auto scroll-area px-4 pb-8 pt-3">
        <MatrixTable
          dayDates={dayDates}
          disabled={isPending}
          editMode={!isReadOnly && editMode}
          holidayNames={activeHolidayNames}
          mealPrice={mealPrice}
          menu={activeMenu}
          onAdd={handleAdd}
          onCloseDay={(day) => {
            startTransition(async () => { await actionCloseDay(day, activeWeekStart); router.refresh(); });
          }}
          onDelete={(id) => setConfirmDeleteItemId(id)}
          onOpenDay={(day) => {
            startTransition(async () => { await actionOpenDay(day, activeWeekStart); router.refresh(); });
          }}
          onUpdate={handleUpdate}
          soupPrice={soupPrice}
          todayCode={visibleTodayCode}
        />
      </div>

      {/* Mobile: single day view */}
      <div className="md:hidden flex-1 overflow-y-auto scroll-area px-4 pb-28">
        <div className="space-y-3">
          <div className="font-display font-bold text-[17px] text-stone-900 mb-1 pt-2">{DAY_LABELS[activeDay]}</div>
          {isDayClosed ? (
            <div className="glass rounded-3xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.08)" }}>
                <div className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.14)" }}>
                  {activeHolidayName
                    ? <span className="text-[18px] leading-none">{activeHolidayEmoji}</span>
                    : <MIcon name="event_busy" size={18} fill style={{ color: "#D97706" }} />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-[13.5px] text-stone-900 leading-none">{activeHolidayName ?? "Zavřeno"}</div>
                  <div className="text-[11.5px] text-stone-500 mt-0.5">{activeHolidayName ? "Svátek / zavřeno" : "V tento den není jídelníček k dispozici."}</div>
                </div>
              </div>
              <div className="px-4 py-4 flex flex-col items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium text-stone-600"
                  style={{ background: "rgba(255,255,255,0.58)", border: "1px solid rgba(245,158,11,0.14)" }}>
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
              <MenuSection
                accent="rgba(245,158,11,0.12)"
                disabled={isPending}
                displayPrice={soupPrice}
                editMode={!isReadOnly && editMode}
                emptyLabel="Žádné polévky pro tento den."
                icon="restaurant"
                iconColor="#D97706"
                items={displayDaySoups}
                onAdd={() => handleAdd(activeDay, "Polévka")}
                onDelete={(id) => setConfirmDeleteItemId(id)}
                onUpdate={handleUpdate}
                title="Polévky"
              />
              <MenuSection
                accent="rgba(234,88,12,0.1)"
                disabled={isPending}
                displayPrice={mealPrice}
                editMode={!isReadOnly && editMode}
                emptyLabel="Žádná jídla pro tento den."
                icon="restaurant_menu"
                iconColor="#EA580C"
                items={displayDayMeals}
                onAdd={() => handleAdd(activeDay, "Jídlo")}
                onDelete={(id) => setConfirmDeleteItemId(id)}
                onUpdate={handleUpdate}
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
        <div className="modal-overlay" onClick={() => setImportState({ phase: "idle" })}>
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
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700">
                  <strong>Chyba:</strong> {importState.message}
                  <button className="ml-3 text-[12px] font-semibold text-red-600 underline" onClick={() => setImportState({ phase: "uploading" })} type="button">Zkusit znovu</button>
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
    </div>
  );
}
