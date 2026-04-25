"use client";

import { useState, useRef, useEffect } from "react";
import type { DepartmentData, OrderRowEnriched, MenuItem, Department, MealEntry } from "@/lib/types";
import { EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { ConfirmModal } from "./ConfirmModal";

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
  soups: MenuItem[];
  meals: MenuItem[];
  isSent: boolean;
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
  onAddRow: () => Promise<number>;
  onUpdateRow: (rowId: number, updates: RowUpdates) => void;
  onDeleteRow: (rowId: number) => void;
}

// ── Department icons ──────────────────────────────────────

const DEPT_ICONS: Partial<Record<Department, string>> = {
  "Konstrukce": "home_work",
  "Dílna":      "build",
};

function DeptIcon({ name }: { name: Department }) {
  const icon = DEPT_ICONS[name] ?? "groups";
  return (
    <span aria-hidden className="material-symbols-outlined msym-fill" style={{ fontSize: 18 }}>
      {icon}
    </span>
  );
}

// ── Row context menu ──────────────────────────────────────

function RowMenuButton({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  return (
    <div className="row-menu-wrap">
      <button
        aria-label="Možnosti"
        className="row-menu-btn"
        onClick={handleOpen}
        ref={btnRef}
        type="button"
      >
        <span aria-hidden className="material-symbols-outlined" style={{ fontSize: 18 }}>more_vert</span>
      </button>
      {open && pos && (
        <div
          className="row-menu-dropdown"
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
        >
          <button onClick={() => { setOpen(false); onEdit(); }} type="button">Upravit</button>
          <button className="row-menu-danger" onClick={() => { setOpen(false); onDelete(); }} type="button">Smazat</button>
        </div>
      )}
    </div>
  );
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
  row: OrderRowEnriched; soups: MenuItem[]; meals: MenuItem[];
  isNew: boolean; defaultSoupPrice?: number; defaultMealPrice?: number; ep: ExtrasPrices;
  onSave: (u: RowUpdates) => void; onClose: () => void; onDelete: () => void;
}) {
  const [personName, setPersonName] = useState(() => {
    if (row.personName) return row.personName;
    try { return localStorage.getItem("lastPersonName") ?? ""; } catch { return ""; }
  });
  const [soupIds, setSoupIds] = useState<(number | null)[]>(
    row.soupItemId2 != null
      ? [row.soupItemId, row.soupItemId2]
      : [row.soupItemId]
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
          <button aria-label="Zavřít" className="modal-close-btn" onClick={handleCancel} type="button">×</button>
        </div>
        <div className="modal-sheet__body">
          <div className="modal-field">
            <label className="modal-label" htmlFor="modal-name">Jméno</label>
            <input autoFocus className="modal-input" id="modal-name" onChange={(e) => setPersonName(e.target.value)} placeholder="Jméno osoby..." type="text" value={personName} />
          </div>

          {/* ── Polévky ── */}
          {soupIds.map((soupId, idx) => (
            <div className="modal-field" key={`soup-${idx}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="modal-label" htmlFor={`modal-soup-${idx}`}>
                  {idx === 0 ? "Polévka" : "Druhá polévka"}
                  {defaultSoupPrice != null && <span className="modal-label-price">{defaultSoupPrice} Kč</span>}
                </label>
                {idx > 0 && (
                  <button
                    className="modal-remove-second"
                    onClick={() => setSoupIds((prev) => prev.slice(0, -1))}
                    type="button"
                  >
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

          {/* ── Jídla ── */}
          {mealEntries.map((entry, idx) => (
            <div className="modal-field" key={`meal-${idx}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="modal-label" htmlFor={`modal-meal-${idx}`}>
                  {idx === 0 ? "Jídlo" : `Jídlo ${idx + 1}`}
                  {defaultMealPrice != null && <span className="modal-label-price">{defaultMealPrice} Kč</span>}
                </label>
                {idx > 0 && (
                  <button
                    className="modal-remove-second"
                    onClick={() => setMealEntries((prev) => prev.filter((_, i) => i !== idx))}
                    type="button"
                  >
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
          <button
            className="modal-add-second"
            onClick={() => setMealEntries((prev) => [...prev, { itemId: null, count: 1 }])}
            type="button"
          >
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
            <span className="modal-label" style={{ padding: "0.55rem 0.85rem 0.45rem", background: "#f9fafb", borderBottom: "1px solid var(--v2-border, #e5e7eb)", display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--v2-text-muted, #6b7280)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Přílohy a doplňky</span>
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

// ── Order row (display only) ──────────────────────────────

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

function V2OrderRow({
  row, accent, isSent, isSaved, onEdit, onDelete,
}: {
  row: OrderRowEnriched; accent: string; isSent: boolean; isSaved: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const chips = getChips(row);

  return (
    <div
      className={`v2-order-row${!isSent ? " v2-order-row--interactive" : ""}${isSaved ? " v2-order-row--saved" : ""}`}
      onClick={!isSent ? onEdit : undefined}
    >
      {/* Col 1: Name + avatar */}
      <div className="v2-order-row__name">
        <div className={`v2-avatar v2-avatar--${accent}`}>{getInitials(row.personName)}</div>
        <span className="v2-order-row__name-text">{row.personName || "—"}</span>
      </div>

      {/* Col 2: Main dish */}
      <div className="v2-order-row__main">
        {row.mainItem ? (
          <span>
            {(row.mealCount || 1) > 1 && <strong>{row.mealCount}× </strong>}
            {row.mainItem.name}
            {row.extraMealItems.map((em, i) => (
              <span key={i}>
                <br />
                <span style={{ color: "var(--v2-text-muted)", fontSize: "0.82em" }}>
                  {em.count > 1 && <strong>{em.count}× </strong>}
                  {em.item.name}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="v2-muted">—</span>
        )}
      </div>

      {/* Col 3: Soup */}
      <div className="v2-order-row__soup">
        {row.soupItem ? (
          <span>
            {row.soupItem.name}
            {row.soupItem2 && (
              <>
                <br />
                <span style={{ color: "var(--v2-text-muted)", fontSize: "0.82em" }}>{row.soupItem2.name}</span>
              </>
            )}
          </span>
        ) : (
          <span className="v2-muted">—</span>
        )}
      </div>

      {/* Col 4: Extras chips + note */}
      <div className="v2-order-row__extras">
        {chips.map((c) => <span className="v2-chip" key={c}>{c}</span>)}
        {row.note && <span className="v2-note-chip" title={row.note}>✎ {row.note}</span>}
      </div>

      {/* Col 5: Price */}
      <div className="v2-order-row__price">
        {row.rowPrice > 0 ? `${row.rowPrice} Kč` : <span className="v2-muted">—</span>}
      </div>

      {/* Actions */}
      {!isSent && (
        <div className="v2-order-row__actions" onClick={(e) => e.stopPropagation()}>
          <RowMenuButton onDelete={onDelete} onEdit={onEdit} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────

function pluralOrders(n: number): string {
  if (n === 1) return "objednávka";
  if (n >= 2 && n <= 4) return "objednávky";
  return "objednávek";
}

export function DepartmentPanel({ data, soups, meals, isSent, defaultSoupPrice, defaultMealPrice, extrasPrices = EXTRAS_PRICES_DEFAULT, onAddRow, onUpdateRow, onDeleteRow }: Props) {
  const [modalState, setModalState] = useState<{ rowId: number; isNew: boolean } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteConfirmRowId, setDeleteConfirmRowId] = useState<number | null>(null);
  const [savedRowId, setSavedRowId] = useState<number | null>(null);
  const savedRowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = data.accent;
  const label = data.label;
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
      <section className={`v2-dept v2-dept--${accent}`}>
        {/* Header */}
        <div className="v2-dept__head">
          <div className="v2-dept__info">
            <div className={`v2-dept-icon v2-dept-icon--${accent}`}>
              <DeptIcon name={data.name} />
            </div>
            <div>
              <h2 className="v2-dept__title">{label}</h2>
              <span className="v2-dept__count">
                {activeRows.length} {pluralOrders(activeRows.length)}
                {data.subtotal > 0 && <> · <strong>{data.subtotal} Kč</strong></>}
              </span>
            </div>
          </div>
          {!isSent && (
            <button className="v2-add-btn" disabled={isAdding} onClick={handleAddAndOpen} type="button">
              {isAdding ? "…" : "+ Přidat sebe"}
            </button>
          )}
        </div>

        {addError && (
          <div className="v2-alert v2-alert--warn" style={{ margin: "0 0 0.5rem" }}>{addError}</div>
        )}

        {/* Table header (desktop) */}
        {activeRows.length > 0 && (
          <div className="v2-cols-head" aria-hidden>
            <span>Jméno</span>
            <span>Hlavní jídlo</span>
            <span>Polévka</span>
            <span>Doplňky</span>
            <span style={{ textAlign: "right" }}>Cena</span>
            <span />
          </div>
        )}

        {/* Rows */}
        {activeRows.length === 0 ? (
          <div className="v2-empty-state">
            <span aria-hidden className="material-symbols-outlined v2-empty-state__icon" style={{ fontSize: 32 }}>
              shopping_basket
            </span>
            <p className="v2-empty-state__text">Zatím nikdo neobjednal</p>
            {!isSent && <p className="v2-empty-state__hint">Přidej svoji objednávku tlačítkem výše</p>}
          </div>
        ) : (
          <div className="v2-dept__rows">
            {activeRows.map((row) => (
              <V2OrderRow
                accent={accent}
                isSaved={row.id === savedRowId}
                isSent={isSent}
                key={row.id}
                onDelete={() => setDeleteConfirmRowId(row.id)}
                onEdit={() => setModalState({ rowId: row.id, isNew: false })}
                row={row}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      {modalRow && (
        <OrderEditModal
          defaultMealPrice={defaultMealPrice}
          defaultSoupPrice={defaultSoupPrice}
          ep={extrasPrices}
          isNew={modalState!.isNew}
          meals={meals}
          onClose={() => setModalState(null)}
          onDelete={() => { onDeleteRow(modalState!.rowId); setModalState(null); }}
          onSave={(updates) => {
            const rowId = modalState!.rowId;
            onUpdateRow(rowId, updates);
            setModalState(null);
            if (savedRowTimer.current) clearTimeout(savedRowTimer.current);
            setSavedRowId(rowId);
            savedRowTimer.current = setTimeout(() => setSavedRowId(null), 1800);
          }}
          row={modalRow}
          soups={soups}
        />
      )}

      {/* Confirm delete row */}
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
