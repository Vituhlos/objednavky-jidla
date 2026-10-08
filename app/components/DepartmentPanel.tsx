"use client";

import { useState, useRef, useEffect, memo } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { useFlipList } from "./feedback/useFlipList";
import type { DepartmentData, OrderRowEnriched, Department } from "@/lib/types";
import { EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { pluralizeOrders } from "@/lib/format";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import { DEPT_COLORS, DC_DEFAULT, DeptIcon } from "./order/department-theme";
import { OrderEditModal } from "./order/OrderEditModal";
import { OrderRow } from "./order/OrderRow";
import type { RowUpdates } from "./order/types";

interface Props {
  data: DepartmentData;
  soups: import("@/lib/types").MenuItem[];
  meals: import("@/lib/types").MenuItem[];
  isSent: boolean;
  existingNames?: string[];
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
  onAddRow: (department: Department) => Promise<number>;
  onUpdateRow: (rowId: number, updates: RowUpdates) => void;
  onDeleteRow: (rowId: number) => void;
}

// ── Main component ────────────────────────────────────────

// ── Main component ────────────────────────────────────────

function DepartmentPanelInner({ data, soups, meals, isSent, existingNames = [], defaultSoupPrice, defaultMealPrice, extrasPrices = EXTRAS_PRICES_DEFAULT, onAddRow, onUpdateRow, onDeleteRow }: Props) {
  const [modalState, setModalState] = useState<{ rowId: number; isNew: boolean } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteConfirmRowId, setDeleteConfirmRowId] = useState<number | null>(null);

  const dc = DEPT_COLORS[data.accent] ?? DC_DEFAULT;
  const activeRows = data.rows.filter(hasOrderRowContent);
  // Po smazání řádku ostatní plynule dojedou na místo (FLIP).
  const rowsRef = useFlipList<HTMLDivElement>(activeRows.map((r) => r.id));
  // Řádky, které tu byly při vložení panelu, se neanimují — vjede jen nově přidaný.
  const [initialRowIds] = useState(() => new Set(activeRows.map((r) => r.id)));
  const modalRow = modalState ? (data.rows.find((r) => r.id === modalState.rowId) ?? null) : null;

  const currentDeptNameRef = useRef(data.name);
  useEffect(() => { currentDeptNameRef.current = data.name; }, [data.name]);

  const handleAddAndOpen = async () => {
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
            <div className="font-display font-bold text-[14px] text-stone-900 leading-none">{data.label}</div>
            <div className="text-[11.5px] text-stone-500 mt-0.5">
              {activeRows.length > 0 ? (
                <>
                  {activeRows.length} {pluralizeOrders(activeRows.length)}
                  {data.subtotal > 0 && <> · <strong className="text-stone-700"><AnimatedNumber suffix=" Kč" value={data.subtotal} /></strong></>}
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
              className="btn-primary btn-sm shrink-0"
            >
              {isAdding
                ? <MIcon name="refresh" size={14} style={{ animation: "k-spin 0.8s linear infinite" }} />
                : <MIcon name="add" size={14} />}
              {isAdding ? "Přidávám" : "Přidat"}
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
        <div className={isSent ? "dept-rows-sent" : ""} ref={rowsRef}>
          {activeRows.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <div className="empty-state__icon">
                <MIcon name="groups" size={22} style={{ color: "#94a3b8" }} />
              </div>
              <p className="empty-state__title">Nikdo zatím neobjednal</p>
              {!isSent && <p className="empty-state__sub">Přidejte první osobu tlačítkem výše</p>}
            </div>
          ) : (
            activeRows.map((row) => (
              <OrderRow
                entering={!initialRowIds.has(row.id)}
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
            <span className="text-[11px] text-stone-400">Odesláno – pouze pro čtení</span>
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
