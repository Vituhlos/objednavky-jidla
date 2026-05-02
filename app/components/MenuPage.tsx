"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from "react";
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
import AppTopBar from "./AppTopBar";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";

// Textarea that auto-grows to fit its content
function AutoTextarea({ defaultValue, disabled, onCommit, placeholder, title }: {
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
  nextMenu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  nextHolidayNames: Record<string, string | null>;
  nextWeekLabel: string | null;
  nextWeekStart: string;
  todayCode: string | null;
  hasPdfCurrent: boolean;
  hasPdfNext: boolean;
}

type ImportState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "preview"; result: ParseResult; targetWeekStart: string; targetLabel: string; tmpPdfName?: string }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── Preview table ──────────────────────────────────────────────────────────────

function PreviewTable({ items }: { items: ParsedMenuItem[] }) {
  const byDay: Record<string, { soups: ParsedMenuItem[]; meals: ParsedMenuItem[] }> = {};
  for (const item of items) {
    if (!byDay[item.day]) byDay[item.day] = { soups: [], meals: [] };
    if (item.type === "Polévka") byDay[item.day].soups.push(item);
    else byDay[item.day].meals.push(item);
  }
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
}

// ── Week grid (desktop read/edit view) ────────────────────────────────────────

function WeekGrid({
  menu, dayDates, todayCode, holidayNames, editMode, disabled, weekStart, onAdd, onDelete, onUpdate, onCloseDay, onOpenDay,
}: {
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  dayDates: Record<string, number>;
  todayCode: string | null;
  holidayNames: Record<string, string | null>;
  editMode: boolean;
  disabled: boolean;
  weekStart: string;
  onAdd: (day: string, type: "Polévka" | "Jídlo") => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: Partial<{ code: string; name: string; price: number }>) => void;
  onCloseDay: (day: string) => void;
  onOpenDay: (day: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-3 items-start">
      {DAY_ORDER.map((day) => {
        const isToday = day === todayCode;
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
            className="glass rounded-3xl overflow-hidden"
            style={isToday ? {
              borderColor: "rgba(245,158,11,0.38)",
              boxShadow: "0 8px 32px -8px rgba(245,158,11,0.22), inset 0 0 0 0px transparent",
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
                        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-xl glass-btn text-stone-600"
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
                          className="ml-auto w-4 h-4 rounded-full inline-flex items-center justify-center text-white hover:opacity-80 transition"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Polévka" as const)}
                          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", fontSize: 10 }}
                          title="Přidat polévku"
                          type="button"
                        >+</button>
                      )}
                    </div>
                    {displaySoups.map((item) => (
                      <WeekItem disabled={disabled} editMode={editMode} item={item} key={item.id} onDelete={onDelete} onUpdate={onUpdate} />
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
                          className="ml-auto w-4 h-4 rounded-full inline-flex items-center justify-center text-white hover:opacity-80 transition"
                          disabled={disabled}
                          onClick={() => onAdd(day, "Jídlo" as const)}
                          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", fontSize: 10 }}
                          title="Přidat jídlo"
                          type="button"
                        >+</button>
                      )}
                    </div>
                    {displayMeals.map((item) => (
                      <WeekItem disabled={disabled} editMode={editMode} item={item} key={item.id} onDelete={onDelete} onUpdate={onUpdate} />
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
}

function WeekItem({
  item, editMode, disabled, onDelete, onUpdate,
}: {
  item: MenuItem;
  editMode: boolean;
  disabled: boolean;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: Partial<{ code: string; name: string; price: number }>) => void;
}) {
  if (editMode) {
    return (
      <div className="group flex items-center gap-1 py-0.5">
        <input
          className="bg-white/50 border border-white/60 rounded-lg py-0.5 px-1 text-[10px] font-mono w-7 shrink-0 text-center outline-none focus:border-amber-400/60"
          defaultValue={item.code}
          disabled={disabled}
          onBlur={(e) => { if (e.target.value !== item.code) onUpdate(item.id, { code: e.target.value }); }}
          title="Kód"
        />
        <input
          className="bg-white/50 border border-white/60 rounded-lg py-0.5 px-1.5 text-[11px] text-stone-800 flex-1 min-w-0 outline-none focus:border-amber-400/60"
          defaultValue={item.name}
          disabled={disabled}
          onBlur={(e) => { if (e.target.value !== item.name) onUpdate(item.id, { name: e.target.value }); }}
          title="Název"
        />
        <input
          className="bg-white/50 border border-white/60 rounded-lg py-0.5 px-1 text-[10px] w-10 text-right shrink-0 outline-none focus:border-amber-400/60"
          defaultValue={item.price}
          disabled={disabled}
          min={0}
          onBlur={(e) => { const p = Number(e.target.value); if (!isNaN(p) && p !== item.price) onUpdate(item.id, { price: p }); }}
          title="Cena Kč"
          type="number"
        />
        <button
          className="w-5 h-5 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 transition opacity-0 group-hover:opacity-100 shrink-0"
          disabled={disabled}
          onClick={() => onDelete(item.id)}
          type="button"
        >
          <MIcon name="close" size={10} />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-1.5 py-1">
      <span className="font-mono text-[10.5px] text-stone-400 w-5 shrink-0 text-right mt-[3px]">{item.code}</span>
      <span className="flex-1 min-w-0 text-[12.5px] font-medium text-stone-800 leading-snug">{item.name}</span>
      <span className="shrink-0 text-[11.5px] font-semibold text-stone-500 tabular-nums mt-[2px]">{item.price} Kč</span>
    </div>
  );
}

// ── Menu section (mobile) ──────────────────────────────────────────────────────

function MenuSection({
  title,
  icon,
  accent,
  iconColor,
  items,
  disabled,
  editMode,
  emptyLabel,
  onAdd,
  onDelete,
  onUpdate,
}: {
  title: string;
  icon: string;
  accent: string;
  iconColor: string;
  items: MenuItem[];
  disabled: boolean;
  editMode: boolean;
  emptyLabel: string;
  onAdd?: () => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: Partial<{ code: string; name: string; price: number }>) => void;
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
                <input
                  className="bg-white/50 border border-white/60 rounded-lg py-1 px-2 text-[12px] w-16 text-right shrink-0 outline-none focus:border-amber-400/60"
                  defaultValue={item.price}
                  disabled={disabled}
                  min={0}
                  onBlur={(e) => { const p = Number(e.target.value); if (!isNaN(p) && p !== item.price) onUpdate(item.id, { price: p }); }}
                  title="Cena Kč"
                  type="number"
                />
                <button
                  className="ml-auto w-7 h-7 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 transition shrink-0"
                  disabled={disabled}
                  onClick={() => onDelete(item.id)}
                  type="button"
                >
                  <MIcon name="close" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        items.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-baseline gap-2 px-4 py-2.5 ${i < items.length - 1 ? "border-b border-white/30" : ""}`}
          >
            <span className="font-mono text-[11px] text-stone-400 w-6 shrink-0 text-right">{item.code}</span>
            <span className="flex-1 text-[13px] text-stone-800 leading-snug">{item.name}</span>
            <span className="shrink-0 font-semibold text-[12.5px] text-stone-500 tabular-nums">{item.price} Kč</span>
          </div>
        ))
      )}
    </div>
  );
}

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
}: Props) {
  const [currentMenu, setCurrentMenu] = useState(initialCurrentMenu);
  // Sync state when server pushes new props (after router.refresh() following an import)
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
    if (week === "next" && editMode) setEditMode(false);
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

  // ── Edit mode ─────────────────────────────────────────────────────────────

  const handleUpdate = useCallback((id: number, updates: Partial<{ code: string; name: string; price: number }>) => {
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
        price: type === "Polévka" ? 35 : 120,
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
  }, [currentWeekStart]);

  const handleDeleteNextWeek = () => {
    setConfirmDeleteNext(false);
    startTransition(async () => {
      await actionDeleteMenuWeek(nextWeekStart);
      router.refresh();
    });
  };

  const isImportOpen = importState.phase !== "idle" && importState.phase !== "done";
  const dayMenu = activeMenu[activeDay] ?? { soups: [], meals: [] };
  const activeHolidayName = activeHolidayNames[activeDay];
  const activeHolidayEmoji = getHolidayEmoji(activeHolidayName);
  const isDayClosed = [...dayMenu.soups, ...dayMenu.meals].every(i => i.name === "Zavřeno") && (dayMenu.soups.length + dayMenu.meals.length) > 0;
  const displayDaySoups = dayMenu.soups.filter(i => i.name !== "Zavřeno");
  const displayDayMeals = dayMenu.meals.filter(i => i.name !== "Zavřeno");
  const isReadOnly = activeWeek === "next";

  const dayDates: Record<string, number> = {};
  const weekBase = new Date(activeWeekStart + "T00:00:00");
  DAY_ORDER.forEach((d, i) => {
    const dt = new Date(weekBase);
    dt.setDate(weekBase.getDate() + i);
    dayDates[d] = dt.getDate();
  });

  return (
    <div className="k-shell">
      <AppTopBar />

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
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Jídelníček LIMA</span>
          {activeWeekLabel && <span className="text-[11px] text-stone-500">{activeWeekLabel}</span>}
          <button
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600"
            onClick={() => { setEditMode(false); setImportState({ phase: "uploading" }); }}
            type="button"
          >
            <MIcon name="upload_file" size={13} /> PDF
          </button>
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

      {/* Desktop: full week grid */}
      <div className="hidden md:block flex-1 overflow-y-auto scroll-area px-4 pb-8 pt-3">
        <WeekGrid
          dayDates={dayDates}
          disabled={isPending}
          editMode={!isReadOnly && editMode}
          holidayNames={activeHolidayNames}
          menu={activeMenu}
          onAdd={(day, type) => handleAdd(day, type)}
          onCloseDay={(day) => {
            startTransition(async () => { await actionCloseDay(day, activeWeekStart); router.refresh(); });
          }}
          onDelete={(id) => setConfirmDeleteItemId(id)}
          onOpenDay={(day) => {
            startTransition(async () => { await actionOpenDay(day, activeWeekStart); router.refresh(); });
          }}
          onUpdate={handleUpdate}
          todayCode={visibleTodayCode}
          weekStart={activeWeekStart}
        />
      </div>

      {/* Mobile: single day view */}
      <div className="md:hidden flex-1 overflow-y-auto scroll-area px-4 pb-28">
        <div className="space-y-3">
          <div className="font-display font-bold text-[17px] text-stone-900 mb-1 pt-2">{DAY_LABELS[activeDay]}</div>
          {isDayClosed ? (
            <div className="glass rounded-3xl overflow-hidden">
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
                  <div className="text-[11.5px] text-stone-500 mt-0.5">
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
              <MenuSection
                accent="rgba(245,158,11,0.12)"
                disabled={isPending}
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
        <div
          className="modal-overlay"
          onClick={() => setImportState({ phase: "idle" })}
        >
          <div
            className={`modal-sheet${importState.phase === "preview" ? " !w-full sm:!w-[760px]" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-sheet__header">
              <h3 className="modal-sheet__title">
                {importState.phase === "preview" ? "Náhled importu" : "Importovat PDF jídelníčku"}
              </h3>
              <button
                aria-label="Zavřít"
                className="w-8 h-8 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 font-bold"
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
