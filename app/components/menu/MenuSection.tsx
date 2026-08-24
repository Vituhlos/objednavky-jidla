"use client";

import { memo } from "react";
import type { MenuItem } from "@/lib/types";
import MIcon from "../MIcon";
import { AllergenBadges } from "./AllergenBadges";

/** Sekce jednoho typu (polévky / jídla) v mobilním zobrazení dne. */
// ── Menu section (mobile) ──────────────────────────────────────────────────────

export const MenuSection = memo(function MenuSection({
  title,
  icon,
  accent,
  iconColor,
  items,
  disabled,
  editMode,
  emptyLabel,
  onAdd,
  onEdit,
}: {
  title: string;
  icon: string;
  accent: string;
  iconColor: string;
  items: MenuItem[];
  disabled: boolean;
  editMode: boolean;
  emptyLabel: string;
  onAdd?: () => void;
  onEdit?: (item: MenuItem) => void;
}) {
  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: accent }}>
        <MIcon name={icon} size={17} fill style={{ color: iconColor }} />
        <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">{title}</span>
        {editMode && onAdd && (
          <button
            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
            disabled={disabled}
            onClick={onAdd}
            style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
            type="button"
          >
            <MIcon name="add" size={13} /> Přidat
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-4 text-[12.5px] text-stone-400 text-center">{emptyLabel}</div>
      ) : editMode ? (
        <div className="px-4 divide-y divide-white/30">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 py-2.5">
              <span className="font-mono text-[11px] text-stone-400 w-6 shrink-0 text-right mt-[3px]">{item.code}</span>
              <span className="flex-1 min-w-0 text-[13px] text-stone-800 leading-snug">
                {item.name}
                {item.allergens && <AllergenBadges allergens={item.allergens} />}
              </span>
              <button
                className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50/80 transition shrink-0"
                disabled={disabled}
                onClick={() => onEdit?.(item)}
                title="Upravit"
                type="button"
              >
                <MIcon name="edit" size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        items.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-start gap-2 px-4 py-2.5 ${i < items.length - 1 ? "border-b border-white/30" : ""}`}
          >
            <span className="font-mono text-[11px] text-stone-600 w-6 shrink-0 text-right mt-[3px]">{item.code}</span>
            <span className="flex-1 min-w-0 text-[13px] text-stone-800 leading-snug">
              {item.name}
              {item.allergens && <AllergenBadges allergens={item.allergens} />}
            </span>
            <span className="shrink-0 font-semibold text-[12.5px] text-stone-600 tabular-nums mt-[2px]">{item.price} Kč</span>
          </div>
        ))
      )}
    </div>
  );
});
