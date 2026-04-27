"use client";

import { useState, useRef, useEffect } from "react";
import type { DepartmentData, OrderRowEnriched, Department, MealEntry } from "@/lib/types";
import { EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";

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
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
  onAddRow: () => Promise<number>;
  onUpdateRow: (rowId: number, updates: RowUpdates) => void;
  onDeleteRow: (rowId: number) => void;
}

// ── Department colors (matches template) ─────────────────

const DEPT_COLORS: Record<string, { bg: string; border: string; icon: string; grad: string }> = {
  blue:  { bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.22)",  icon: "#3B82F6", grad: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
  rust:  { bg: "rgba(194,101,77,0.1)",  border: "rgba(194,101,77,0.22)",  icon: "#C2654D", grad: "linear-gradient(135deg,#fb923c,#C2654D)" },
  green: { bg: "rgba(79,138,83,0.1)",   border: "rgba(79,138,83,0.22)",   icon: "#4F8A53", grad: "linear-gradient(135deg,#86efac,#4F8A53)" },
};
const DC_DEFAULT = DEPT_COLORS.blue;

// ── Department icons ──────────────────────────────────────

const DEPT_ICONS: Partial<Record<Department, string>> = {
  "Konstrukce": "home_work",
  "Dílna":      "build",
};

function DeptIcon({ name, color }: { name: Department; color: string }) {
  const icon = DEPT_ICONS[name] ?? "groups";
  return <MIcon name={icon} size={18} fill style={{ color }} />;
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
        <button className="stepper-btn" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} type="button">−</button>
        <span className="stepper-count">{value}</span>
        <button className="stepper-btn" onClick={() => onChange(value + 1)} type="button">+</button>
      </div>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────

function OrderEditModal({
  row, soups, meals, isNew, defaultSoupPrice, defaultMealPrice, ep, onSave, onClose, onDelete,
}: {
  row: OrderRowEnriched; soups: import("@/lib/types").MenuItem[]; meals: import("@/lib/types").MenuItem[];
  isNew: boolean; defaultSoupPrice?: number; defaultMealPrice?: number; ep: ExtrasPrices;
  onSave: (u: RowUpdates) => void; onClose: () => void; onDelete: () => void;
}) {
  const [personName, setPersonName] = useState(() => {
    if (row.personName) return row.personName;
    try { return localStorage.getItem("lastPersonName") ?? ""; } catch { return ""; }
  });
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

  const handleCancel = () => { if (isNew) onDelete(); else onClose(); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleSave = () => {
    if (personName.trim()) {
      try { localStorage.setItem("lastPersonName", personName.trim()); } catch { /* */ }
    }
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

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title">{isNew ? "Přidat objednávku" : "Upravit objednávku"}</h3>
          <button
            aria-label="Zavřít"
            className="w-8 h-8 rounded-full glass-soft inline-flex items-center justify-center text-slate-500 text-lg font-bold leading-none"
            onClick={handleCancel}
            type="button"
          >×</button>
        </div>
        <div className="modal-sheet__body">
          <div className="modal-field">
            <label className="modal-label" htmlFor="modal-name">Jméno</label>
            <input autoFocus className="modal-input" id="modal-name" onChange={(e) => setPersonName(e.target.value)} placeholder="Jméno osoby..." type="text" value={personName} />
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
              <select
                className="modal-select"
                id={`modal-soup-${idx}`}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSoupIds((prev) => prev.map((id, i) => i === idx ? val : id));
                }}
                value={soupId ?? ""}
              >
                <option value="">— žádná polévka —</option>
                {soups.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
              </select>
            </div>
          ))}
          {soupIds.length < 2 && (
            <button className="modal-add-second" onClick={() => setSoupIds((prev) => [...prev, null])} type="button">
              + Přidat druhou polévku
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
                <select
                  className="modal-select"
                  id={`modal-meal-${idx}`}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setMealEntries((prev) => prev.map((ent, i) => i === idx ? { ...ent, itemId: val } : ent));
                  }}
                  style={{ flex: 1 }}
                  value={entry.itemId ?? ""}
                >
                  <option value="">— žádné jídlo —</option>
                  {meals.map((m) => <option key={m.id} value={m.id}>{m.code} – {m.name}</option>)}
                </select>
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
          <button className="modal-add-second" onClick={() => setMealEntries((prev) => [...prev, { itemId: null, count: 1 }])} type="button">
            + Přidat další jídlo
          </button>

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
        <div className="modal-sheet__footer">
          {!isNew && <button className="modal-btn modal-btn--danger" onClick={() => setShowDeleteConfirm(true)} type="button">Smazat</button>}
          <button className="modal-btn modal-btn--secondary" onClick={handleCancel} type="button">Zrušit</button>
          <button className="modal-btn modal-btn--primary" onClick={handleSave} type="button">Uložit</button>
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
    </div>
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

function OrderRow({ row, accent, isSent, onEdit, onDelete }: {
  row: OrderRowEnriched; accent: string; isSent: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const dc = DEPT_COLORS[accent] ?? DC_DEFAULT;
  const chips = getChips(row);

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 border-b border-white/30 last:border-0 transition ${!isSent ? "hover:bg-white/50 cursor-pointer active:scale-[0.995]" : ""}`}
      onClick={!isSent ? onEdit : undefined}
    >
      {/* Avatar */}
      <span
        className="inline-flex items-center justify-center text-white font-semibold font-display shrink-0"
        style={{ width: 34, height: 34, fontSize: 13, borderRadius: 999, background: dc.grad, boxShadow: "0 0 0 2px rgba(255,255,255,0.85)" }}
      >
        {getInitials(row.personName)}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-semibold text-[13px] text-slate-900 leading-none">{row.personName || "—"}</span>
          {row.note && (
            <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 max-w-[120px] truncate" title={row.note}>
              ✎ {row.note}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mt-0.5">
          {row.mainItem && (
            <span className="text-[11.5px] text-slate-600 leading-snug">
              {(row.mealCount || 1) > 1 ? `${row.mealCount}× ` : ""}{row.mainItem.name}
            </span>
          )}
          {row.extraMealItems.map((e, i) => (
            <span key={i} className="text-[11.5px] text-slate-600 leading-snug">
              <span className="text-slate-300 mx-0.5">+</span>
              {e.count > 1 ? `${e.count}× ` : ""}{e.item.name}
            </span>
          ))}
          {(row.mainItem || row.extraMealItems.length > 0) && row.soupItem && (
            <span className="text-slate-300 text-[11px]">·</span>
          )}
          {row.soupItem && <span className="text-[11.5px] text-slate-500 leading-snug">{row.soupItem.name}</span>}
          {row.soupItem && row.soupItem2 && <span className="text-slate-300 text-[11px]">+</span>}
          {row.soupItem2 && <span className="text-[11.5px] text-slate-500 leading-snug">{row.soupItem2.name}</span>}
          {!row.mainItem && !row.soupItem && <span className="text-[11.5px] text-slate-400">—</span>}
          {chips.map((c) => (
            <span key={c} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-white/70 border border-white/90 text-slate-500">{c}</span>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 font-display font-bold text-[13px] text-slate-800">
        {row.rowPrice > 0 ? `${row.rowPrice} Kč` : <span className="text-slate-400 font-normal">—</span>}
      </div>

      {/* Delete button (hover on desktop, always visible on touch) */}
      {!isSent && (
        <button
          type="button"
          aria-label="Smazat"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50/80 transition opacity-0 group-hover:opacity-100"
        >
          <MIcon name="close" size={15} />
        </button>
      )}
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

export function DepartmentPanel({ data, soups, meals, isSent, defaultSoupPrice, defaultMealPrice, extrasPrices = EXTRAS_PRICES_DEFAULT, onAddRow, onUpdateRow, onDeleteRow }: Props) {
  const [modalState, setModalState] = useState<{ rowId: number; isNew: boolean } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteConfirmRowId, setDeleteConfirmRowId] = useState<number | null>(null);

  const dc = DEPT_COLORS[data.accent] ?? DC_DEFAULT;
  const activeRows = data.rows.filter(hasOrderRowContent);
  const modalRow = modalState ? (data.rows.find((r) => r.id === modalState.rowId) ?? null) : null;

  const handleAddAndOpen = async () => {
    if (isAdding) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const rowId = await onAddRow();
      setModalState({ rowId, isNew: true });
    } catch {
      setAddError("Nepodařilo se přidat řádek.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <section className="glass rounded-3xl overflow-hidden" style={{ borderColor: dc.border }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/40" style={{ background: dc.bg }}>
          <div
            className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
            style={{ background: `${dc.icon}22` }}
          >
            <DeptIcon name={data.name} color={dc.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[14px] text-slate-900 leading-none">{data.label}</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">
              {activeRows.length} {pluralOrders(activeRows.length)}
              {data.subtotal > 0 && <> · <strong className="text-slate-700">{data.subtotal} Kč</strong></>}
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
              <MIcon name="add" size={14} />
              {isAdding ? "…" : "Přidat"}
            </button>
          )}
        </div>

        {addError && (
          <div className="px-4 py-2 text-[12px] text-red-600">{addError}</div>
        )}

        {/* Rows */}
        <div className={isSent ? "dept-rows-sent" : ""}>
          {activeRows.length === 0 ? (
            <div className="px-4 py-5 text-center text-[12.5px] text-slate-400">Zatím nikdo neobjednal.</div>
          ) : (
            activeRows.map((row) => (
              <OrderRow
                key={row.id}
                row={row}
                accent={data.accent}
                isSent={isSent}
                onEdit={() => setModalState({ rowId: row.id, isNew: false })}
                onDelete={() => setDeleteConfirmRowId(row.id)}
              />
            ))
          )}
        </div>

        {/* Sent lock badge */}
        {isSent && activeRows.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-t border-white/30">
            <MIcon name="lock" size={12} style={{ color: "#94a3b8" }} />
            <span className="text-[11px] text-slate-400">Odesláno — pouze pro čtení</span>
          </div>
        )}
      </section>

      {/* Edit modal */}
      {modalRow && (
        <OrderEditModal
          defaultMealPrice={defaultMealPrice}
          defaultSoupPrice={defaultSoupPrice}
          ep={extrasPrices}
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
