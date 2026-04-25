"use client";

import { useState, useRef, useEffect } from "react";
import type { DepartmentData, OrderRowEnriched, MenuItem, Department, MealEntry } from "@/lib/types";
import { EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";

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

function DeptIcon({ name }: { name: Department }) {
  if (name === "Konstrukce") {
    return (
      <svg aria-hidden fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
        <path d="M12 3L4 9v12h16V9L12 3zm0 2.5L18 10v9H6v-9l6-4.5zM10 13h4v6h-4z"/>
      </svg>
    );
  }
  if (name === "Dílna") {
    return (
      <svg aria-hidden fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
      </svg>
    );
  }
  return (
    <svg aria-hidden fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
      <path d="M20 6h-2.18c.07-.44.18-.86.18-1.3C18 2.12 15.88 0 13.3 0c-1.47 0-2.76.81-3.54 2.05L12 4.06l2.24-2.01C14.69 1.39 15.5 1 16.5 1c1.93 0 3.5 1.57 3.5 3.5 0 .47-.09.92-.24 1.35-.04.09-.14.15-.23.15H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 14H4V8h16v12zm-5-9h-4v2h4v-2zm0 4h-4v2h4v-2zM7 9h2v8H7z"/>
    </svg>
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
        ⋮
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
  const [personName, setPersonName] = useState(row.personName);
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
          {!isNew && <button className="modal-btn modal-btn--danger" onClick={onDelete} type="button">Smazat</button>}
          <button className="modal-btn modal-btn--secondary" onClick={handleCancel} type="button">Zrušit</button>
          <button className="modal-btn modal-btn--primary" onClick={handleSave} type="button">Uložit</button>
        </div>
      </div>
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
  row, accent, isSent, onEdit, onDelete,
}: {
  row: OrderRowEnriched; accent: string; isSent: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const chips = getChips(row);

  return (
    <div
      className={`v2-order-row${!isSent ? " v2-order-row--interactive" : ""}`}
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
          <div className="v2-empty-state">Zatím nikdo neobjednal.</div>
        ) : (
          <div className="v2-dept__rows">
            {activeRows.map((row) => (
              <V2OrderRow
                accent={accent}
                isSent={isSent}
                key={row.id}
                onDelete={() => onDeleteRow(row.id)}
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
          onSave={(updates) => { onUpdateRow(modalState!.rowId, updates); setModalState(null); }}
          row={modalRow}
          soups={soups}
        />
      )}
    </>
  );
}
