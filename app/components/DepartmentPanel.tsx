"use client";

import { useState, useRef, useEffect, memo } from "react";
import type { DepartmentData, OrderRowEnriched, Department } from "@/lib/types";
import { EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { ConfirmModal } from "./ConfirmModal";
import { OrderEditModal, type RowUpdates } from "./OrderEditModal";
import MIcon from "./MIcon";

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

// ── Department icons ──────────────────────────────────────

const DEPT_ICONS: Partial<Record<Department, string>> = {
  "Konstrukce": "home_work",
  "Dílna":      "build",
};

function DeptIcon({ name, color }: { name: Department; color: string }) {
  const icon = DEPT_ICONS[name] ?? "groups";
  return <MIcon name={icon} size={18} fill style={{ color }} />;
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
      className={`group flex items-center gap-3 px-4 py-3 border-b border-white/30 last:border-0 transition-all duration-150 ease-out ${!isSent ? "hover:bg-white/60 active:bg-white/60 cursor-pointer active:scale-[0.995]" : ""}`}
      onClick={!isSent ? onEdit : undefined}
      role={!isSent ? "button" : undefined}
      tabIndex={!isSent ? 0 : undefined}
      onKeyDown={!isSent ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } } : undefined}
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
          <span className="font-display font-semibold text-[14px] text-stone-900 leading-none">{row.personName || "—"}</span>
          {row.note && (
            <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-full bg-slate-100/80 text-stone-600 border border-slate-200/70 max-w-[160px]" title={row.note}>
              <MIcon name="edit" size={11} style={{ flexShrink: 0 }} />
              <span className="truncate min-w-0">{row.note}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mt-0.5">
          {row.mainItem && (
            <span className="text-[12.5px] text-stone-600 leading-snug">
              {(row.mealCount || 1) > 1 ? `${row.mealCount}× ` : ""}
              {row.mainItem.code && <span className="font-mono text-[10.5px] text-stone-400 mr-0.5">{row.mainItem.code}</span>}
              {row.mainItem.name}
            </span>
          )}
          {row.extraMealItems.map((e, i) => (
            <span key={i} className="text-[12.5px] text-stone-600 leading-snug">
              <span className="text-stone-300 mx-0.5">+</span>
              {e.count > 1 ? `${e.count}× ` : ""}
              {e.item.code && <span className="font-mono text-[10.5px] text-stone-400 mr-0.5">{e.item.code}</span>}
              {e.item.name}
            </span>
          ))}
          {(row.mainItem || row.extraMealItems.length > 0) && row.soupItem && (
            <span className="text-stone-300 text-[11px]">·</span>
          )}
          {row.soupItem && (
            <span className="text-[12.5px] text-stone-500 leading-snug">
              {row.soupItem.code && <span className="font-mono text-[10.5px] text-stone-400 mr-0.5">{row.soupItem.code}</span>}
              {row.soupItem.name}
            </span>
          )}
          {row.soupItem && row.soupItem2 && <span className="text-stone-300 text-[11px]">+</span>}
          {row.soupItem2 && (
            <span className="text-[12.5px] text-stone-500 leading-snug">
              {row.soupItem2.code && <span className="font-mono text-[10.5px] text-stone-400 mr-0.5">{row.soupItem2.code}</span>}
              {row.soupItem2.name}
            </span>
          )}
          {!row.mainItem && !row.soupItem && <span className="text-[12.5px] text-stone-400">—</span>}
          {chips.map((c) => (
            <span key={c} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-white/70 border border-white/90 text-stone-500">{c}</span>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 font-display font-bold text-[13px] text-stone-800">
        {row.rowPrice > 0 ? `${row.rowPrice} Kč` : <span className="text-stone-400 font-normal">—</span>}
      </div>

      {/* Delete button — always visible on mobile, hover-only on desktop */}
      {!isSent && (
        <button
          type="button"
          aria-label="Smazat"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 w-11 h-11 md:w-8 md:h-8 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 active:text-red-400 active:bg-red-50/80 transition md:opacity-0 md:group-hover:opacity-100"
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

function DepartmentPanelInner({ data, soups, meals, isSent, existingNames = [], defaultSoupPrice, defaultMealPrice, extrasPrices = EXTRAS_PRICES_DEFAULT, onAddRow, onUpdateRow, onDeleteRow }: Props) {
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
              <p className="empty-state__sub">Přidejte první osobu tlačítkem výše</p>
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
