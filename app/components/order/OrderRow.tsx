"use client";

import { memo } from "react";
import type { OrderRowEnriched } from "@/lib/types";
import { getInitials } from "@/lib/format";
import MIcon from "../MIcon";
import { DEPT_COLORS, DC_DEFAULT } from "./department-theme";

export function getChips(row: OrderRowEnriched): string[] {
  const chips: string[] = [];
  if (row.rollCount > 0) chips.push(`Houska ×${row.rollCount}`);
  if (row.breadDumplingCount > 0) chips.push(`H. kned. ×${row.breadDumplingCount}`);
  if (row.potatoDumplingCount > 0) chips.push(`B. kned. ×${row.potatoDumplingCount}`);
  if (row.ketchupCount > 0) chips.push(`Kečup ×${row.ketchupCount}`);
  if (row.tatarkaCount > 0) chips.push(`Tatarka ×${row.tatarkaCount}`);
  if (row.bbqCount > 0) chips.push(`BBQ ×${row.bbqCount}`);
  return chips;
}

export function OrderRow({ row, accent, isSent, onEdit, onDelete }: {
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
