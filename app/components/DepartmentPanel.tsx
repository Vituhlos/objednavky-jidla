"use client";

import { useState, useRef, useEffect } from "react";
import type { DepartmentData, OrderRowEnriched, MenuItem, Department } from "@/lib/types";
import { DEPARTMENT_LABELS, DEPARTMENT_ACCENT } from "@/lib/types";

type RowUpdates = Partial<{
  personName: string;
  soupItemId: number | null;
  mainItemId: number | null;
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
  ketchupCount: number;
  tatarkaCount: number;
  bbqCount: number;
}>;

interface Props {
  data: DepartmentData;
  soups: MenuItem[];
  meals: MenuItem[];
  isSent: boolean;
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="row-menu-wrap" ref={ref}>
      <button
        aria-label="Možnosti"
        className="row-menu-btn"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        type="button"
      >
        ⋮
      </button>
      {open && (
        <div className="row-menu-dropdown">
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
  row, soups, meals, isNew, onSave, onClose, onDelete,
}: {
  row: OrderRowEnriched; soups: MenuItem[]; meals: MenuItem[];
  isNew: boolean; onSave: (u: RowUpdates) => void; onClose: () => void; onDelete: () => void;
}) {
  const [personName, setPersonName] = useState(row.personName);
  const [soupItemId, setSoupItemId] = useState<number | null>(row.soupItemId);
  const [mainItemId, setMainItemId] = useState<number | null>(row.mainItemId);
  const [rollCount, setRollCount] = useState(row.rollCount);
  const [breadDumplingCount, setBreadDumplingCount] = useState(row.breadDumplingCount);
  const [potatoDumplingCount, setPotatoDumplingCount] = useState(row.potatoDumplingCount);
  const [ketchupCount, setKetchupCount] = useState(row.ketchupCount);
  const [tatarkaCount, setTatarkaCount] = useState(row.tatarkaCount);
  const [bbqCount, setBbqCount] = useState(row.bbqCount);

  const handleCancel = () => { if (isNew) onDelete(); else onClose(); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

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
          <div className="modal-field">
            <label className="modal-label" htmlFor="modal-soup">Polévka</label>
            <select className="modal-select" id="modal-soup" onChange={(e) => setSoupItemId(e.target.value ? Number(e.target.value) : null)} value={soupItemId ?? ""}>
              <option value="">— žádná polévka —</option>
              {soups.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label" htmlFor="modal-meal">Jídlo</label>
            <select className="modal-select" id="modal-meal" onChange={(e) => setMainItemId(e.target.value ? Number(e.target.value) : null)} value={mainItemId ?? ""}>
              <option value="">— žádné jídlo —</option>
              {meals.map((m) => <option key={m.id} value={m.id}>{m.code} – {m.name}</option>)}
            </select>
          </div>
          <div className="modal-extras">
            <p className="modal-label">Přílohy a doplňky</p>
            <ModalStepper label="Houska" onChange={setRollCount} price={5} value={rollCount} />
            <ModalStepper label="Houskový knedlík" onChange={setBreadDumplingCount} price={40} value={breadDumplingCount} />
            <ModalStepper label="Bramborový knedlík" onChange={setPotatoDumplingCount} price={45} value={potatoDumplingCount} />
            <ModalStepper label="Kečup" onChange={setKetchupCount} price={20} value={ketchupCount} />
            <ModalStepper label="Tatarka" onChange={setTatarkaCount} price={20} value={tatarkaCount} />
            <ModalStepper label="BBQ omáčka" onChange={setBbqCount} price={20} value={bbqCount} />
          </div>
        </div>
        <div className="modal-sheet__footer">
          {!isNew && <button className="modal-btn modal-btn--danger" onClick={onDelete} type="button">Smazat</button>}
          <button className="modal-btn modal-btn--secondary" onClick={handleCancel} type="button">Zrušit</button>
          <button className="modal-btn modal-btn--primary" onClick={() => onSave({ personName, soupItemId, mainItemId, rollCount, breadDumplingCount, potatoDumplingCount, ketchupCount, tatarkaCount, bbqCount })} type="button">Uložit</button>
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
        {row.mainItem
          ? <span>{row.mainItem.name}</span>
          : <span className="v2-muted">—</span>}
      </div>

      {/* Col 3: Soup */}
      <div className="v2-order-row__soup">
        {row.soupItem
          ? <span>{row.soupItem.name}</span>
          : <span className="v2-muted">—</span>}
      </div>

      {/* Col 4: Extras chips */}
      <div className="v2-order-row__extras">
        {chips.map((c) => <span className="v2-chip" key={c}>{c}</span>)}
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

export function DepartmentPanel({ data, soups, meals, isSent, onAddRow, onUpdateRow, onDeleteRow }: Props) {
  const [modalState, setModalState] = useState<{ rowId: number; isNew: boolean } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const accent = DEPARTMENT_ACCENT[data.name];
  const label = DEPARTMENT_LABELS[data.name];
  const activeRows = data.rows.filter((r) => r.personName || r.soupItemId || r.mainItemId);
  const modalRow = modalState ? (data.rows.find((r) => r.id === modalState.rowId) ?? null) : null;

  const handleAddAndOpen = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const rowId = await onAddRow();
      setModalState({ rowId, isNew: true });
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
              </span>
            </div>
          </div>
          {!isSent && (
            <button className="v2-add-btn" disabled={isAdding} onClick={handleAddAndOpen} type="button">
              + Přidat sebe
            </button>
          )}
        </div>

        {/* Table header (desktop) */}
        {activeRows.length > 0 && (
          <div className="v2-cols-head" aria-hidden>
            <span>Jméno</span>
            <span>Hlavní jídlo</span>
            <span>Polévka</span>
            <span>Doplňky</span>
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
