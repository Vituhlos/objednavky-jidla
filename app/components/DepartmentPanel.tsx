"use client";

import { useState, useRef, useEffect, memo } from "react";
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
  /** Proč je zamčeno. Nevyplněno = objednávka už odešla. */
  lockNote?: React.ReactNode;
  /** `null` = volný text, pole = výběr z vlastních strávníků. */
  orderableNames?: string[] | null;
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

function DepartmentPanelInner({ data, soups, meals, isSent, lockNote, orderableNames = null, existingNames = [], defaultSoupPrice, defaultMealPrice, extrasPrices = EXTRAS_PRICES_DEFAULT, onAddRow, onUpdateRow, onDeleteRow }: Props) {
  const [modalState, setModalState] = useState<{ rowId: number; isNew: boolean } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteConfirmRowId, setDeleteConfirmRowId] = useState<number | null>(null);

  const dc = DEPT_COLORS[data.accent] ?? DC_DEFAULT;
  const activeRows = data.rows.filter(hasOrderRowContent);
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
        <div className={isSent ? "dept-rows-sent" : ""}>
          {activeRows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <MIcon name="groups" size={22} style={{ color: "#94a3b8" }} />
              </div>
              <p className="empty-state__title">Nikdo zatím neobjednal</p>
              <p className="empty-state__sub">
                {isSent ? (lockNote ?? "Objednávka už odešla") : "Přidejte první osobu tlačítkem výše"}
              </p>
            </div>
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
            <span className="text-[11px] text-stone-400">
              {lockNote ?? "Odesláno — pouze pro čtení"}
            </span>
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
          orderableNames={orderableNames}
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
