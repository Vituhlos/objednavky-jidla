"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { DepartmentData, OrderRowEnriched, Department, MealEntry } from "@/lib/types";
import { EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";

const ALLERGEN_NAMES: Record<number, string> = {
  1: "Lepek", 2: "Korýši", 3: "Vejce", 4: "Ryby", 5: "Arašídy",
  6: "Sója", 7: "Mléko", 8: "Ořechy", 9: "Celer", 10: "Hořčice",
  11: "Sezam", 12: "Siřičitany", 13: "Vlčí bob", 14: "Měkkýši",
};

function AllergenBadges({ allergens }: { allergens: string }) {
  const nums = allergens.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 14);
  if (nums.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-0.5 ml-1">
      {nums.map((n) => (
        <span
          key={n}
          title={ALLERGEN_NAMES[n]}
          className="inline-block text-[9px] font-semibold leading-none px-1 py-0.5 rounded"
          style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

type RowUpdates = Partial<{
  personName: string;
  soupItemId: number | null;
  soupItemId2: number | null;
  mainItemId: number | null;
  mealCount: number;
  extraMeals: MealEntry[];
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
  ketchupCount: number;
  tatarkaCount: number;
  bbqCount: number;
  note: string;
}>;

interface Props {
  data: DepartmentData;
  soups: import("@/lib/types").MenuItem[];
  meals: import("@/lib/types").MenuItem[];
  isSent: boolean;
  existingNames?: string[];
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
  currentUserId?: number;
  isAdmin?: boolean;
  isDefault?: boolean;
  currentUserName?: string;
  onAddRow: (department: Department) => Promise<number>;
  onUpdateRow: (rowId: number, updates: RowUpdates) => void;
  onDeleteRow: (rowId: number) => void;
}

// ── Department colors (matches template) ─────────────────

const DEPT_COLORS: Record<string, { bg: string; soft: string; icon: string; grad: string }> = {
  blue:   { bg: "rgba(59,130,246,0.06)",  soft: "rgba(59,130,246,0.12)",  icon: "#3B82F6", grad: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
  rust:   { bg: "rgba(194,101,77,0.06)",  soft: "rgba(194,101,77,0.12)",  icon: "#C2654D", grad: "linear-gradient(135deg,#fb923c,#C2654D)" },
  green:  { bg: "rgba(79,138,83,0.06)",   soft: "rgba(79,138,83,0.12)",   icon: "#4F8A53", grad: "linear-gradient(135deg,#86efac,#4F8A53)" },
  amber:  { bg: "rgba(245,158,11,0.06)",  soft: "rgba(245,158,11,0.12)",  icon: "#F59E0B", grad: "linear-gradient(135deg,#fcd34d,#F59E0B)" },
  navy:   { bg: "rgba(30,64,175,0.06)",   soft: "rgba(30,64,175,0.12)",   icon: "#1e40af", grad: "linear-gradient(135deg,#60a5fa,#1e40af)" },
  orange: { bg: "rgba(234,88,12,0.06)",   soft: "rgba(234,88,12,0.12)",   icon: "#EA580C", grad: "linear-gradient(135deg,#fb923c,#EA580C)" },
  red:    { bg: "rgba(220,38,38,0.06)",   soft: "rgba(220,38,38,0.12)",   icon: "#dc2626", grad: "linear-gradient(135deg,#f87171,#dc2626)" },
};
const DC_DEFAULT = DEPT_COLORS.blue;

// ── Department icons ──────────────────────────────────────

const DEPT_ICONS: Partial<Record<Department, string>> = {
  "Konstrukce": "home_work",
  "Dílna":      "build",
};

function DeptIcon({ name, color }: { name: Department; color: string }) {
  const icon = DEPT_ICONS[name] ?? "groups";
  return <MIcon name={icon} size={22} fill style={{ color }} />;
}

// ── Modal stepper ─────────────────────────────────────────

function ModalStepper({
  label, price, value, onChange,
}: {
  label: string; price: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="modal-stepper">
      <span className="modal-stepper__label">{label}</span>
      <span className="modal-stepper__price">{price} Kč/ks</span>
      <div className="modal-stepper__controls">
        <button aria-label={`Ubrat ${label}`} className="stepper-btn" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} type="button">−</button>
        <span aria-label={`Počet: ${value}`} className="stepper-count">{value}</span>
        <button aria-label={`Přidat ${label}`} className="stepper-btn" onClick={() => onChange(value + 1)} type="button">+</button>
      </div>
    </div>
  );
}

// ── Custom menu select (replaces native <select>) ─────────

function MenuSelect({
  id, value, onChange, options, placeholder, style,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  options: import("@/lib/types").MenuItem[];
  placeholder: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hlIdx, setHlIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const allCount = options.length + 1;

  // ── všechny hooky musí být před jakýmkoliv conditional return ──

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const openList = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const listH = Math.min(allCount * 38 + 8, 264);
    const above = window.innerHeight - rect.bottom < listH && rect.top > listH;
    setDropPos({ top: above ? rect.top - listH - 4 : rect.bottom + 4, left: rect.left, width: rect.width });
    const idx = value === null ? 0 : (options.findIndex((o) => o.id === value) + 1);
    setHlIdx(idx < 0 ? 0 : idx);
    setOpen(true);
  }, [allCount, options, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelectorAll<HTMLElement>("[data-idx]")[hlIdx]?.scrollIntoView({ block: "nearest" });
  }, [hlIdx, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") { setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHlIdx((i) => Math.min(i + 1, allCount - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHlIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (hlIdx === 0) onChange(null); else onChange(options[hlIdx - 1].id);
      setOpen(false); triggerRef.current?.focus();
    }
  };

  const select = (v: number | null) => { onChange(v); setOpen(false); triggerRef.current?.focus(); };

  const selectedOpt = value !== null ? options.find((o) => o.id === value) : null;

  if (isMobile) {
    return (
      <select
        id={id}
        className="modal-select"
        style={style}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.code ? `${o.code} – ${o.name}` : o.name}</option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        id={id} type="button" role="combobox" aria-expanded={open} aria-haspopup="listbox"
        className="modal-select"
        style={{ display: "flex", alignItems: "center", backgroundImage: "none", textAlign: "left", cursor: "default", ...style }}
        onClick={openList} onKeyDown={handleKeyDown} ref={triggerRef}
      >
        <span className="flex-1 truncate min-w-0 flex items-baseline gap-1.5">
          {selectedOpt ? (
            <>
              {selectedOpt.code && <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#d97706", flexShrink: 0 }}>{selectedOpt.code}</span>}
              <span className="truncate">{selectedOpt.name}</span>
            </>
          ) : (
            <span style={{ color: "#a8a29e" }}>{placeholder}</span>
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9b8474" strokeWidth="2" aria-hidden
          style={{ flexShrink: 0, marginLeft: 4, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "" }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={listRef} role="listbox"
          style={{
            position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999,
            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(32px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.68)", borderRadius: 16,
            boxShadow: "0 1px 0 rgba(255,255,255,0.85) inset, 0 12px 40px -6px rgba(26,18,8,0.16), 0 2px 8px -2px rgba(26,18,8,0.08)",
            overflow: "hidden",
          }}
        >
          <div style={{ maxHeight: 264, overflowY: "auto", padding: "4px 0" }}>
            <button data-idx="0" type="button" role="option" aria-selected={value === null}
              className="dropdown-item dropdown-item--placeholder"
              data-hl={String(hlIdx === 0)}
              onClick={() => select(null)}
            >{placeholder}</button>
            {options.map((opt, i) => {
              const idx = i + 1;
              return (
                <button key={opt.id} data-idx={String(idx)} type="button" role="option" aria-selected={value === opt.id}
                  className="dropdown-item"
                  data-hl={String(hlIdx === idx)}
                  onClick={() => select(opt.id)}
                >
                  {opt.code && <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#d97706", minWidth: "1.5rem", textAlign: "right", flexShrink: 0 }}>{opt.code}</span>}
                  <span style={{ flex: 1 }}>{opt.name}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Edit modal ────────────────────────────────────────────

function OrderEditModal({
  row, soups, meals, isNew, defaultSoupPrice, defaultMealPrice, ep, existingNames, initialPersonName, onSave, onClose, onDelete,
}: {
  row: OrderRowEnriched; soups: import("@/lib/types").MenuItem[]; meals: import("@/lib/types").MenuItem[];
  isNew: boolean; defaultSoupPrice?: number; defaultMealPrice?: number; ep: ExtrasPrices;
  existingNames: string[];
  initialPersonName?: string;
  onSave: (u: RowUpdates) => void; onClose: () => void; onDelete: () => void;
}) {
  const [firstName, setFirstName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/)[0] ?? "";
    if (isNew && initialPersonName) return initialPersonName.trim().split(/\s+/)[0] ?? "";
    try { return localStorage.getItem("lastFirstName") ?? ""; } catch { return ""; }
  });
  const [lastName, setLastName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/).slice(1).join(" ");
    if (isNew && initialPersonName) return initialPersonName.trim().split(/\s+/).slice(1).join(" ");
    try { return localStorage.getItem("lastLastName") ?? ""; } catch { return ""; }
  });
  const personName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const [soupIds, setSoupIds] = useState<(number | null)[]>(
    row.soupItemId2 != null ? [row.soupItemId, row.soupItemId2] : [row.soupItemId]
  );
  const [mealEntries, setMealEntries] = useState<{ itemId: number | null; count: number }[]>([
    { itemId: row.mainItemId, count: row.mealCount || 1 },
    ...row.extraMealItems.map((e) => ({ itemId: e.item.id, count: e.count })),
  ]);
  const [rollCount, setRollCount] = useState(row.rollCount);
  const [breadDumplingCount, setBreadDumplingCount] = useState(row.breadDumplingCount);
  const [potatoDumplingCount, setPotatoDumplingCount] = useState(row.potatoDumplingCount);
  const [ketchupCount, setKetchupCount] = useState(row.ketchupCount);
  const [tatarkaCount, setTatarkaCount] = useState(row.tatarkaCount);
  const [bbqCount, setBbqCount] = useState(row.bbqCount);
  const [note, setNote] = useState(row.note);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; currentY: number } | null>(null);

  const handleCancel = () => { if (isNew) onDelete(); else onClose(); };
  const handleCancelRef = useRef(handleCancel);
  useEffect(() => { handleCancelRef.current = handleCancel; });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const body = sheetRef.current?.querySelector(".modal-sheet__body") as HTMLElement | null;
    if (body && body.scrollTop > 0) return;
    dragState.current = { startY: e.touches[0].clientY, currentY: 0 };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current || !sheetRef.current) return;
    const delta = e.touches[0].clientY - dragState.current.startY;
    if (delta <= 0) { dragState.current = null; sheetRef.current.style.transform = ""; return; }
    dragState.current.currentY = delta;
    sheetRef.current.style.transition = "none";
    sheetRef.current.style.transform = `translateY(${delta}px)`;
  };

  const handleTouchEnd = () => {
    if (!dragState.current || !sheetRef.current) return;
    const { currentY } = dragState.current;
    dragState.current = null;
    if (currentY > 80) {
      sheetRef.current.style.transition = "transform 0.25s ease-in";
      sheetRef.current.style.transform = "translateY(110%)";
      setTimeout(() => handleCancelRef.current(), 220);
    } else {
      sheetRef.current.style.transition = "transform 0.3s cubic-bezier(.2,.8,.2,1)";
      sheetRef.current.style.transform = "";
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleCancelRef.current(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // body má overflow:hidden globálně — žádný scroll lock nutný

  const hasFood =
    soupIds.some((id) => id != null) ||
    mealEntries.some((e) => e.itemId != null) ||
    rollCount > 0 || breadDumplingCount > 0 || potatoDumplingCount > 0;

  const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const isDuplicateName =
    personName.trim() !== "" &&
    normalizeName(personName) !== normalizeName(row.personName) &&
    existingNames.some((n) => normalizeName(n) === normalizeName(personName));
  const showMealTip = /\d/.test(lastName) || /\d/.test(firstName);

  const handleSave = () => {
    if (!firstName.trim()) {
      setValidationError("Zadejte křestní jméno.");
      return;
    }
    if (!lastName.trim()) {
      setValidationError("Zadejte příjmení.");
      return;
    }
    if (!hasFood) {
      setValidationError("Vyberte alespoň jedno jídlo nebo přílohu.");
      return;
    }
    if (isDuplicateName) {
      setValidationError(`„${personName.trim()}" už v objednávce je.`);
      return;
    }
    setValidationError(null);
    doSave();
  };

  const doSave = () => {
    try { localStorage.setItem("lastFirstName", firstName.trim()); localStorage.setItem("lastLastName", lastName.trim()); } catch { /* */ }
    const firstMeal = mealEntries[0] ?? { itemId: null, count: 1 };
    const extraMeals: MealEntry[] = mealEntries
      .slice(1)
      .filter((e) => e.itemId != null)
      .map((e) => ({ itemId: e.itemId!, count: e.count }));
    onSave({
      personName,
      soupItemId: soupIds[0] ?? null,
      soupItemId2: soupIds.length > 1 ? (soupIds[1] ?? null) : null,
      mainItemId: firstMeal.itemId,
      mealCount: firstMeal.count,
      extraMeals,
      rollCount, breadDumplingCount, potatoDumplingCount,
      ketchupCount, tatarkaCount, bbqCount, note,
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        ref={sheetRef}
      >
        <div className="modal-sheet__drag-handle" aria-hidden />
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="edit-modal-title">{isNew ? "Přidat objednávku" : "Upravit objednávku"}</h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold leading-none"
            onClick={handleCancel}
            type="button"
          >×</button>
        </div>
        <div className="modal-sheet__body">
          <div className="modal-field">
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label className="modal-label" htmlFor="modal-firstname">Jméno</label>
                <input
                  autoFocus
                  autoComplete="given-name"
                  className={`modal-input${/\d/.test(firstName) ? " modal-input--error" : ""}`}
                  id="modal-firstname"
                  onChange={(e) => { setFirstName(e.target.value); setValidationError(null); }}
                  placeholder="Jan"
                  type="text"
                  value={firstName}
                />
                {/\d/.test(firstName) && (
                  <p className="mt-1 text-[11.5px] text-red-600 font-medium">Odstraň číslo ze jména.</p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label className="modal-label" htmlFor="modal-lastname">Příjmení</label>
                <input
                  autoComplete="family-name"
                  className={`modal-input${/\d/.test(lastName) ? " modal-input--error" : ""}`}
                  id="modal-lastname"
                  onChange={(e) => { setLastName(e.target.value); setValidationError(null); }}
                  placeholder="Novák"
                  type="text"
                  value={lastName}
                />
                {/\d/.test(lastName) && (
                  <p className="mt-1 text-[11.5px] text-red-600 font-medium">Odstraň číslo z příjmení.</p>
                )}
              </div>
            </div>
            {isDuplicateName && (
              <div className="mt-1 px-3 py-2 rounded-xl text-[12px] text-amber-700 font-medium flex items-center gap-1.5"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <MIcon name="warning" size={13} style={{ color: "#d97706", flexShrink: 0 }} />
                Toto jméno už v objednávce je.
              </div>
            )}
          </div>

          {soupIds.map((soupId, idx) => (
            <div className="modal-field" key={`soup-${idx}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="modal-label" htmlFor={`modal-soup-${idx}`}>
                  {idx === 0 ? "Polévka" : "Druhá polévka"}
                  {defaultSoupPrice != null && <span className="modal-label-price">{defaultSoupPrice} Kč</span>}
                </label>
                {idx > 0 && (
                  <button className="modal-remove-second" onClick={() => setSoupIds((prev) => prev.slice(0, -1))} type="button">
                    × odebrat
                  </button>
                )}
              </div>
              <MenuSelect
                id={`modal-soup-${idx}`}
                value={soupId}
                onChange={(val) => setSoupIds((prev) => prev.map((id, i) => i === idx ? val : id))}
                options={soups}
                placeholder="— žádná polévka —"
              />
            </div>
          ))}
          {soupIds.length < 2 && (
            <button className="modal-add-second" onClick={() => setSoupIds((prev) => [...prev, null])} type="button">
              <MIcon name="add" size={14} style={{ color: "#D97706" }} />
              Přidat druhou polévku
            </button>
          )}

          {mealEntries.map((entry, idx) => (
            <div className="modal-field" key={`meal-${idx}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="modal-label" htmlFor={`modal-meal-${idx}`}>
                  {idx === 0 ? "Jídlo" : `Jídlo ${idx + 1}`}
                  {defaultMealPrice != null && <span className="modal-label-price">{defaultMealPrice} Kč</span>}
                </label>
                {idx > 0 && (
                  <button className="modal-remove-second" onClick={() => setMealEntries((prev) => prev.filter((_, i) => i !== idx))} type="button">
                    × odebrat
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <MenuSelect
                  id={`modal-meal-${idx}`}
                  value={entry.itemId}
                  onChange={(val) => setMealEntries((prev) => prev.map((ent, i) => i === idx ? { ...ent, itemId: val } : ent))}
                  options={meals}
                  placeholder="— žádné jídlo —"
                  style={{ flex: 1, width: "auto", minWidth: 0 }}
                />
                {entry.itemId && (
                  <div className="modal-count-stepper">
                    <button
                      className="modal-count-btn"
                      disabled={entry.count <= 1}
                      onClick={() => setMealEntries((prev) => prev.map((ent, i) => i === idx ? { ...ent, count: Math.max(1, ent.count - 1) } : ent))}
                      type="button"
                    >−</button>
                    <span className="modal-count-val">{entry.count}×</span>
                    <button
                      className="modal-count-btn"
                      disabled={entry.count >= 10}
                      onClick={() => setMealEntries((prev) => prev.map((ent, i) => i === idx ? { ...ent, count: Math.min(10, ent.count + 1) } : ent))}
                      type="button"
                    >+</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div style={{ position: "relative" }}>
            {showMealTip && (
              <div className="meal-tip-callout">
                Víc jídel pro sebe? Přidej je sem — není třeba nová objednávka.
              </div>
            )}
            <button
              className={`modal-add-second${showMealTip ? " modal-add-second--pulse" : ""}`}
              onClick={() => setMealEntries((prev) => [...prev, { itemId: null, count: 1 }])}
              type="button"
            >
              <MIcon name="add" size={14} style={{ color: showMealTip ? "#b91c1c" : "#c2410c" }} />
              Přidat další jídlo do objednávky
            </button>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="modal-note">Poznámka k jídlu</label>
            <textarea
              className="modal-note"
              id="modal-note"
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder="např. bez špenátu, bez zelí..."
              rows={2}
              value={note}
            />
          </div>

          <div className="modal-extras">
            <span className="modal-label" style={{ padding: "0.55rem 0.85rem 0.45rem", background: "rgba(255,255,255,0.6)", borderBottom: "1px solid rgba(255,255,255,0.5)", display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Přílohy a doplňky</span>
            <ModalStepper label="Houska" onChange={setRollCount} price={ep.roll} value={rollCount} />
            <ModalStepper label="Houskový knedlík" onChange={setBreadDumplingCount} price={ep.breadDumpling} value={breadDumplingCount} />
            <ModalStepper label="Bramborový knedlík" onChange={setPotatoDumplingCount} price={ep.potatoDumpling} value={potatoDumplingCount} />
            <ModalStepper label="Kečup" onChange={setKetchupCount} price={ep.ketchup} value={ketchupCount} />
            <ModalStepper label="Tatarka" onChange={setTatarkaCount} price={ep.tatarka} value={tatarkaCount} />
            <ModalStepper label="BBQ omáčka" onChange={setBbqCount} price={ep.bbq} value={bbqCount} />
          </div>
        </div>
        {validationError && (
          <div role="alert" className="mx-4 mb-2 px-3 py-2 rounded-xl text-[12px] text-red-700 font-medium flex items-center gap-1.5"
            style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}>
            <MIcon name="warning" size={13} style={{ color: "#dc2626", flexShrink: 0 }} />
            {validationError}
          </div>
        )}
        <div className="modal-sheet__footer">
          {!isNew && <button className="modal-btn modal-btn--danger" onClick={() => setShowDeleteConfirm(true)} type="button">Smazat</button>}
          <button className="modal-btn modal-btn--secondary" onClick={handleCancel} type="button">Zrušit</button>
          <button className="modal-btn modal-btn--primary" disabled={isDuplicateName || showMealTip} onClick={handleSave} type="button">Uložit</button>
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmModal
          message="Objednávka této osoby bude odstraněna."
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={onDelete}
          title="Smazat objednávku"
        />
      )}
    </div>,
    document.body
  );
}

// ── Order row ─────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name.trim()) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getChips(row: OrderRowEnriched): string[] {
  const chips: string[] = [];
  if (row.rollCount > 0) chips.push(`Houska ×${row.rollCount}`);
  if (row.breadDumplingCount > 0) chips.push(`H. kned. ×${row.breadDumplingCount}`);
  if (row.potatoDumplingCount > 0) chips.push(`B. kned. ×${row.potatoDumplingCount}`);
  if (row.ketchupCount > 0) chips.push(`Kečup ×${row.ketchupCount}`);
  if (row.tatarkaCount > 0) chips.push(`Tatarka ×${row.tatarkaCount}`);
  if (row.bbqCount > 0) chips.push(`BBQ ×${row.bbqCount}`);
  return chips;
}

function OrderRow({ row, accent, isSent, isEditable, onEdit }: {
  row: OrderRowEnriched; accent: string; isSent: boolean; isEditable: boolean; onEdit: () => void;
}) {
  const dc = DEPT_COLORS[accent] ?? DC_DEFAULT;
  const chips = getChips(row);
  const canInteract = !isSent && isEditable;

  // Collect soup + extras sub-line parts
  const subParts: string[] = [];
  if (row.soupItem) subParts.push(`+ ${row.soupItem.name}${row.soupItem2 ? ` + ${row.soupItem2.name}` : ""}`);
  if (chips.length > 0) subParts.push(...chips);

  return (
    <div
      className={`flex items-start gap-3 px-2.5 py-2 rounded-xl transition ${canInteract ? "hover:bg-white/55 cursor-pointer" : ""} ${!isEditable && !isSent ? "opacity-60" : ""}`}
      onClick={canInteract ? onEdit : undefined}
      role={canInteract ? "button" : undefined}
      tabIndex={canInteract ? 0 : undefined}
      onKeyDown={canInteract ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } } : undefined}
    >
      <span
        className="inline-flex items-center justify-center rounded-full text-white font-display font-bold text-[11px] shrink-0"
        style={{ width: 34, height: 34, background: dc.grad, boxShadow: "0 0 0 2px rgba(255,255,255,0.85), 0 2px 6px -2px rgba(26,18,8,0.20)" }}
      >
        {getInitials(row.personName)}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <div className="text-[12.5px] font-semibold text-slate-900 leading-tight flex-1 truncate">{row.personName || "—"}</div>
          {row.rowPrice > 0 && (
            <div className="font-display font-bold text-[12.5px] text-slate-900 tabular-nums shrink-0">{row.rowPrice} Kč</div>
          )}
          {!isSent && !isEditable && (
            <MIcon name="lock" size={11} style={{ color: "#d4c5b5", flexShrink: 0 }} />
          )}
        </div>

        <div className="text-[11.5px] text-slate-600 mt-0.5 leading-snug">
          {(row.mealCount || 1) > 1 && <span className="font-display font-bold text-slate-800">{row.mealCount}× </span>}
          {row.mainItem
            ? <>{row.mainItem.code && <span className="font-mono text-[10px] text-slate-400 mr-0.5">{row.mainItem.code}</span>}{row.mainItem.name}</>
            : <em className="text-slate-400">— bez jídla —</em>
          }
          {row.extraMealItems.map((e, i) => (
            <span key={i}> <span className="text-slate-300">+</span> {e.count > 1 ? `${e.count}× ` : ""}{e.item.name}</span>
          ))}
        </div>

        {(subParts.length > 0 || row.note) && (
          <div className="text-[10.5px] text-slate-400 leading-snug mt-0.5">
            {subParts.join(" · ")}
            {row.note && <span className="ml-1 italic">{row.note}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function pluralOrders(n: number): string {
  if (n === 1) return "objednávka";
  if (n >= 2 && n <= 4) return "objednávky";
  return "objednávek";
}

// ── Main component ────────────────────────────────────────

function DepartmentPanelInner({ data, soups, meals, isSent, existingNames = [], defaultSoupPrice, defaultMealPrice, extrasPrices = EXTRAS_PRICES_DEFAULT, currentUserId, isAdmin = false, isDefault = false, currentUserName, onAddRow, onUpdateRow, onDeleteRow }: Props) {
  const [modalState, setModalState] = useState<{ rowId: number; isNew: boolean } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const dc = DEPT_COLORS[data.accent] ?? DC_DEFAULT;
  const activeRows = data.rows.filter(hasOrderRowContent);
  const modalRow = modalState ? (data.rows.find((r) => r.id === modalState.rowId) ?? null) : null;

  const handleAddAndOpen = async () => {
    if (isAdding) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const rowId = await onAddRow(data.name);
      setModalState({ rowId, isNew: true });
    } catch {
      setAddError("Nepodařilo se přidat řádek.");
    } finally {
      setIsAdding(false);
    }
  };

  const itemCount = activeRows.length;
  const countWord = itemCount === 1 ? "objednávka" : (itemCount >= 2 && itemCount <= 4) ? "objednávky" : "objednávek";

  return (
    <>
      <section
        className="rounded-2xl overflow-hidden flex flex-col transition"
        style={{
          background: "rgba(255,255,255,0.74)",
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 10px 26px -14px rgba(26,18,8,0.12), 0 1px 0 rgba(255,255,255,0.9) inset",
          opacity: isSent ? 0.78 : 1,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{
            background: `linear-gradient(180deg, ${dc.bg}, rgba(255,255,255,0.0))`,
            borderBottom: `1px solid ${dc.icon}1F`,
          }}
        >
          <div
            className="w-11 h-11 rounded-xl inline-flex items-center justify-center shrink-0"
            style={{ background: dc.soft, boxShadow: `inset 0 -1px 0 ${dc.icon}26, 0 1px 0 rgba(255,255,255,0.7) inset` }}
          >
            <DeptIcon name={data.name} color={dc.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="font-display font-bold text-[15px] text-slate-900 leading-tight">{data.label}</div>
              {isDefault && <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#D97706" }}>moje</span>}
            </div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">
              {itemCount > 0 ? `${itemCount} ${countWord}` : <span className="italic text-slate-400">žádné objednávky</span>}
            </div>
          </div>
          {data.subtotal > 0 && (
            <div className="font-display font-extrabold text-[16px] tabular-nums leading-none shrink-0" style={{ color: dc.icon }}>
              {data.subtotal.toLocaleString("cs-CZ")} Kč
            </div>
          )}
        </div>

        {addError && (
          <div role="alert" className="px-4 py-2 flex items-center gap-1.5 text-[12px] text-red-600">
            <MIcon name="warning" size={13} style={{ flexShrink: 0, color: "#dc2626" }} />
            {addError}
          </div>
        )}

        {/* Rows */}
        <div className="flex-1 p-2 flex flex-col gap-0.5 min-h-[120px]">
          {activeRows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[12px] text-slate-400 italic py-6">
              {isSent ? "Nikdo z tohoto oddělení neobjednal." : "Zatím nikdo neobjednal"}
            </div>
          ) : (
            activeRows.map((row) => {
              const editable = (currentUserId !== undefined || isAdmin) && (isAdmin || row.userId === null || row.userId === currentUserId);
              return (
                <OrderRow
                  key={row.id}
                  row={row}
                  accent={data.accent}
                  isSent={isSent}
                  isEditable={editable}
                  onEdit={() => editable && setModalState({ rowId: row.id, isNew: false })}
                />
              );
            })
          )}

          {!isSent && (currentUserId !== undefined || isAdmin) && (
            <button
              type="button"
              disabled={isAdding}
              onClick={handleAddAndOpen}
              className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-semibold text-slate-500 hover:text-slate-900 transition disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.45)", border: "1px dashed rgba(26,18,8,0.18)" }}
            >
              <MIcon name={isAdding ? "refresh" : "add"} size={14} style={isAdding ? { animation: "k-spin 0.8s linear infinite" } : undefined} />
              {isAdding ? "Přidávám…" : "Přidat osobu"}
            </button>
          )}
        </div>

        {/* Sent footer */}
        {isSent && (
          <div
            className="px-4 py-2.5 flex items-center gap-2 text-[11.5px] font-semibold"
            style={{ background: "rgba(16,185,129,0.10)", color: "#047857", borderTop: "1px solid rgba(16,185,129,0.22)" }}
          >
            <MIcon name="lock" size={13} fill /> Odesláno — pouze pro čtení
          </div>
        )}
      </section>

      {/* Edit modal */}
      {modalRow && (
        <OrderEditModal
          defaultMealPrice={defaultMealPrice}
          defaultSoupPrice={defaultSoupPrice}
          ep={extrasPrices}
          existingNames={existingNames}
          initialPersonName={modalState!.isNew ? currentUserName : undefined}
          isNew={modalState!.isNew}
          meals={meals}
          onClose={() => setModalState(null)}
          onDelete={() => { onDeleteRow(modalState!.rowId); setModalState(null); }}
          onSave={(updates) => { onUpdateRow(modalState!.rowId, updates); setModalState(null); }}
          row={modalRow}
          soups={soups}
        />
      )}

    </>
  );
}

export const DepartmentPanel = memo(DepartmentPanelInner);
