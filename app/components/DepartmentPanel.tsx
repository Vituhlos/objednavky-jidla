"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { DepartmentData, OrderRowEnriched, Department, MealEntry } from "@/lib/types";
import { EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import { DeptIcon } from "./dept-icon";
import { useModalSwipe } from "@/app/hooks/useModalSwipe";

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
  isLoggedIn?: boolean;
  currentUserId?: number | null;
  isAdmin?: boolean;
  existingNames?: string[];
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
  suggestions?: { personName: string; lastOrderedAt: string }[];
  onAddRow: (department: Department) => Promise<number>;
  onAddRowWithName?: (department: Department, personName: string) => Promise<number>;
  onUpdateRow: (rowId: number, updates: RowUpdates) => void;
  onDeleteRow: (rowId: number) => void;
}

// ── Department colors (matches template) ─────────────────

const DEPT_COLORS: Record<string, { bg: string; border: string; icon: string; grad: string }> = {
  blue:   { bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.22)",  icon: "#3B82F6", grad: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
  rust:   { bg: "rgba(194,101,77,0.1)",  border: "rgba(194,101,77,0.22)",  icon: "#C2654D", grad: "linear-gradient(135deg,#fb923c,#C2654D)" },
  green:  { bg: "rgba(79,138,83,0.1)",   border: "rgba(79,138,83,0.22)",   icon: "#4F8A53", grad: "linear-gradient(135deg,#86efac,#4F8A53)" },
  amber:  { bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.22)",  icon: "#F59E0B", grad: "linear-gradient(135deg,#fcd34d,#F59E0B)" },
  navy:   { bg: "rgba(30,64,175,0.1)",   border: "rgba(30,64,175,0.22)",   icon: "#1e40af", grad: "linear-gradient(135deg,#60a5fa,#1e40af)" },
  orange: { bg: "rgba(234,88,12,0.1)",   border: "rgba(234,88,12,0.22)",   icon: "#EA580C", grad: "linear-gradient(135deg,#fb923c,#EA580C)" },
  red:    { bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.22)",   icon: "#dc2626", grad: "linear-gradient(135deg,#f87171,#dc2626)" },
};
const DC_DEFAULT = DEPT_COLORS.blue;

// DeptIcon moved to ./dept-icon for reuse across pages

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
  row, soups, meals, isNew, defaultSoupPrice, defaultMealPrice, ep, existingNames, onSave, onClose, onDelete,
}: {
  row: OrderRowEnriched; soups: import("@/lib/types").MenuItem[]; meals: import("@/lib/types").MenuItem[];
  isNew: boolean; defaultSoupPrice?: number; defaultMealPrice?: number; ep: ExtrasPrices;
  existingNames: string[];
  onSave: (u: RowUpdates) => void; onClose: () => void; onDelete: () => void;
}) {
  const [firstName, setFirstName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/)[0] ?? "";
    try { return localStorage.getItem("lastFirstName") ?? ""; } catch { return ""; }
  });
  const [lastName, setLastName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/).slice(1).join(" ");
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

  const handleCancel = () => { if (isNew) onDelete(); else onClose(); };
  const handleCancelRef = useRef(handleCancel);
  handleCancelRef.current = handleCancel;
  const { sheetRef } = useModalSwipe(handleCancel);

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
    try {
      localStorage.setItem("lastFirstName", firstName.trim());
      localStorage.setItem("lastLastName", lastName.trim());
      // Sekce 5.2: zaznamenat jméno přihlášeného uživatele pro „ty" badge
      localStorage.setItem("kantyna_my_name", personName);
    } catch { /* */ }
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

function shortMealName(full: string, max = 16): string {
  const firstClause = full.split(",")[0].trim();
  return firstClause.length <= max ? firstClause : firstClause.slice(0, max - 1) + "…";
}

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

interface ExtraChip { label: string }
function getExtraChips(row: OrderRowEnriched): ExtraChip[] {
  const out: ExtraChip[] = [];
  const pushIfAny = (n: number, label: string) => {
    if (n > 0) out.push({ label: n === 1 ? `+ ${label}` : `+ ${n}× ${label}` });
  };
  pushIfAny(row.rollCount, "houska");
  pushIfAny(row.breadDumplingCount, "h. knedlík");
  pushIfAny(row.potatoDumplingCount, "b. knedlík");
  pushIfAny(row.ketchupCount, "kečup");
  pushIfAny(row.tatarkaCount, "tatarka");
  pushIfAny(row.bbqCount, "BBQ");
  return out;
}

function OrderRow({ row, accent, isSent, isCurrentUser, canEdit, onEdit, onDelete }: {
  row: OrderRowEnriched; accent: string; isSent: boolean; isCurrentUser: boolean; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const dc = DEPT_COLORS[accent] ?? DC_DEFAULT;
  const extras = getExtraChips(row);
  const hasFood = !!row.mainItem || !!row.soupItem || !!row.soupItem2 || row.extraMealItems.length > 0 || extras.length > 0;
  const clickable = !isSent && canEdit;

  return (
    <div
      className={`group flex items-center gap-2.5 px-3 py-2.5 border-b border-white/30 last:border-0 transition-all duration-150 ease-out ${clickable ? "hover:bg-white/60 cursor-pointer active:scale-[0.995]" : ""}`}
      style={isCurrentUser ? { background: "rgba(254,243,199,0.4)", borderColor: "rgba(245,158,11,0.35)" } : undefined}
      onClick={clickable ? onEdit : undefined}
    >
      {/* Avatar */}
      <span
        className="inline-flex items-center justify-center text-white font-display font-bold shrink-0"
        style={{ width: 28, height: 28, fontSize: 11, borderRadius: 999, background: dc.grad, boxShadow: "0 0 0 2px rgba(255,255,255,0.85)" }}
        aria-hidden
      >
        {getInitials(row.personName)}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-[13px] text-stone-900 leading-tight">{row.personName || "—"}</span>
          {isCurrentUser && <span className="ty-badge">ty</span>}
          {row.note && (
            <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-full bg-slate-100/80 text-stone-600 border border-slate-200/70 max-w-[140px]" title={row.note}>
              <MIcon name="edit" size={10} style={{ flexShrink: 0 }} />
              <span className="truncate min-w-0">{row.note}</span>
            </span>
          )}
        </div>
        {hasFood ? (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {row.soupItem && (
              <span className="meal-chip">
                {row.soupItem.code && <>{row.soupItem.code} · </>}
                {shortMealName(row.soupItem.name)}
              </span>
            )}
            {row.soupItem2 && (
              <span className="meal-chip">
                {row.soupItem2.code && <>{row.soupItem2.code} · </>}
                {shortMealName(row.soupItem2.name)}
              </span>
            )}
            {row.mainItem && (
              <span className="meal-chip">
                {(row.mealCount || 1) > 1 ? `${row.mealCount}× ` : ""}
                {row.mainItem.code && <>{row.mainItem.code} · </>}
                {shortMealName(row.mainItem.name)}
              </span>
            )}
            {row.extraMealItems.map((e, i) => (
              <span key={i} className="meal-chip">
                {e.count > 1 ? `${e.count}× ` : ""}
                {e.item.code && <>{e.item.code} · </>}
                {shortMealName(e.item.name)}
              </span>
            ))}
            {extras.map((c) => (
              <span key={c.label} className="meal-chip meal-chip--faded">{c.label}</span>
            ))}
          </div>
        ) : (
          <div className="text-[11.5px] text-stone-400 mt-1">Vyber jídlo…</div>
        )}
      </div>

      {/* Price */}
      <div className="shrink-0 font-display font-bold text-[13px] text-stone-900 tabular-nums">
        {row.rowPrice > 0 ? `${row.rowPrice} Kč` : <span className="text-stone-400 font-normal">—</span>}
      </div>

      {/* Keyboard-accessible edit button (sr-only, becomes visible on focus) */}
      {clickable && (
        <button
          type="button"
          onClick={onEdit}
          className="sr-only focus:not-sr-only focus:shrink-0 focus:px-2 focus:py-1 focus:rounded-xl focus:bg-white focus:text-stone-700 focus:text-[11px] focus:font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          Upravit
        </button>
      )}

      {/* Delete button — always visible on mobile, hover-only on desktop */}
      {clickable && (
        <button
          type="button"
          aria-label="Smazat"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 w-11 h-11 md:w-7 md:h-7 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 active:text-red-400 active:bg-red-50/80 transition md:opacity-0 md:group-hover:opacity-100"
        >
          <MIcon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

// ── Empty state with suggestions ──────────────────────────

function DeptEmptyState({ suggestions, accent, isSent, onPickSuggestion }: {
  suggestions: { personName: string; lastOrderedAt: string }[];
  accent: string;
  isSent: boolean;
  onPickSuggestion: (personName: string) => void;
}) {
  const dc = DEPT_COLORS[accent] ?? DC_DEFAULT;
  if (isSent || suggestions.length === 0) {
    return (
      <div className="px-4 py-4">
        <div className="text-[11.5px] text-stone-500 leading-relaxed">
          Klikni na <strong>+ Přidat</strong> nahoře — zadáš jméno a vybereš jídlo.
        </div>
      </div>
    );
  }
  return (
    <div className="px-3.5 py-3 flex flex-col gap-2.5">
      <div className="text-[11.5px] text-stone-500 leading-snug">
        Klikni na někoho, kdo tu obvykle objednává — rovnou vyplním jméno a otevřu výběr jídla.
      </div>
      <div>
        <div className="section-eyebrow mb-1.5">Také minule</div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.personName}
              type="button"
              className="suggest-chip"
              onClick={() => onPickSuggestion(s.personName)}
            >
              <span className="suggest-chip__avatar" style={{ background: dc.grad }} aria-hidden>
                {getInitials(s.personName)}
              </span>
              <span>{s.personName}</span>
            </button>
          ))}
        </div>
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

function DepartmentPanelInner({ data, soups, meals, isSent, isLoggedIn = true, currentUserId = null, isAdmin = false, existingNames = [], defaultSoupPrice, defaultMealPrice, extrasPrices = EXTRAS_PRICES_DEFAULT, suggestions = [], onAddRow, onAddRowWithName, onUpdateRow, onDeleteRow }: Props) {
  const [modalState, setModalState] = useState<{ rowId: number; isNew: boolean } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteConfirmRowId, setDeleteConfirmRowId] = useState<number | null>(null);
  const [myName, setMyName] = useState<string>("");

  useEffect(() => {
    try {
      setMyName(localStorage.getItem("kantyna_my_name") ?? "");
    } catch {}
  }, [data.rows]); // re-read after modal save

  const dc = DEPT_COLORS[data.accent] ?? DC_DEFAULT;
  const activeRows = data.rows.filter(hasOrderRowContent);
  const modalRow = modalState ? (data.rows.find((r) => r.id === modalState.rowId) ?? null) : null;

  const currentDeptNameRef = useRef(data.name);
  useEffect(() => { currentDeptNameRef.current = data.name; }, [data.name]);

  const handleAddAndOpen = async () => {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }
    if (isAdding) return;
    setIsAdding(true);
    setAddError(null);
    const deptAtStart = data.name;
    try {
      const rowId = await onAddRow(data.name);
      if (currentDeptNameRef.current !== deptAtStart) return;
      setModalState({ rowId, isNew: true });
    } catch {
      if (currentDeptNameRef.current !== deptAtStart) return;
      setAddError("Nepodařilo se přidat řádek.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <section className="glass-card rounded-3xl overflow-hidden" style={{ borderColor: dc.border }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/40" style={{ background: dc.bg }}>
          <div
            className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
            style={{ background: `${dc.icon}22` }}
          >
            <DeptIcon name={data.name} color={dc.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[14px] text-stone-900 leading-none">{data.label}</div>
            <div className="text-[11.5px] text-stone-500 mt-0.5">
              {activeRows.length > 0 ? (
                <>
                  {activeRows.length} {pluralOrders(activeRows.length)}
                  {data.subtotal > 0 && <> · <strong className="text-stone-700">{data.subtotal} Kč</strong></>}
                </>
              ) : (
                <span className="text-stone-400">Zatím prázdné</span>
              )}
            </div>
          </div>
          {!isSent && (
            <button
              type="button"
              disabled={isAdding}
              onClick={handleAddAndOpen}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white shrink-0 disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
            >
              {isAdding
                ? <MIcon name="refresh" size={14} style={{ animation: "k-spin 0.8s linear infinite" }} />
                : <MIcon name={isLoggedIn ? "add" : "lock"} size={14} />}
              {isAdding ? "Přidávám" : isLoggedIn ? "Přidat" : "Přihlásit se"}
            </button>
          )}
        </div>

        {addError && (
          <div role="alert" className="px-4 py-2 flex items-center gap-1.5 text-[12px] text-red-600">
            <MIcon name="warning" size={13} style={{ flexShrink: 0, color: "#dc2626" }} />
            {addError}
          </div>
        )}

        {/* Rows */}
        <div className={isSent ? "dept-rows-sent" : ""}>
          {activeRows.length === 0 ? (
            <DeptEmptyState
              suggestions={suggestions}
              accent={data.accent}
              isSent={isSent}
              onPickSuggestion={async (name) => {
                if (!onAddRowWithName) return;
                try {
                  const rowId = await onAddRowWithName(data.name, name);
                  setModalState({ rowId, isNew: true });
                } catch {
                  setAddError("Nepodařilo se přidat řádek.");
                }
              }}
            />
          ) : (
            activeRows.map((row) => {
              const isCurrentUser = isLoggedIn && currentUserId !== null && row.userId === currentUserId;
              const canEdit = !isSent && (isAdmin || isCurrentUser);
              return (
                <OrderRow
                  key={row.id}
                  row={row}
                  accent={data.accent}
                  isSent={isSent}
                  isCurrentUser={isCurrentUser}
                  canEdit={canEdit}
                  onEdit={() => setModalState({ rowId: row.id, isNew: false })}
                  onDelete={() => setDeleteConfirmRowId(row.id)}
                />
              );
            })
          )}
        </div>

        {/* Sent lock badge */}
        {isSent && activeRows.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-t border-white/30">
            <MIcon name="lock" size={12} style={{ color: "#94a3b8" }} />
            <span className="text-[11px] text-stone-400">Odesláno — pouze pro čtení</span>
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
          isNew={modalState!.isNew}
          meals={meals}
          onClose={() => setModalState(null)}
          onDelete={() => { onDeleteRow(modalState!.rowId); setModalState(null); }}
          onSave={(updates) => { onUpdateRow(modalState!.rowId, updates); setModalState(null); }}
          row={modalRow}
          soups={soups}
        />
      )}

      {/* Confirm delete */}
      {deleteConfirmRowId !== null && (
        <ConfirmModal
          message="Objednávka této osoby bude odstraněna."
          onClose={() => setDeleteConfirmRowId(null)}
          onConfirm={() => { onDeleteRow(deleteConfirmRowId); setDeleteConfirmRowId(null); }}
          title="Smazat objednávku"
        />
      )}
    </>
  );
}

export const DepartmentPanel = memo(DepartmentPanelInner);
