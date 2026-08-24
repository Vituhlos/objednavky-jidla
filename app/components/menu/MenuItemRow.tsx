"use client";

import { memo } from "react";
import type { MenuItem } from "@/lib/types";
import MIcon from "../MIcon";
import { AllergenBadges } from "./AllergenBadges";

/**
 * Jedna položka jídelníčku v týdenním roštu: kód, název, alergeny.
 *
 * V režimu úprav tlačítko nahradí cenu — v roštu není na obojí místo.
 *
 * Proti větvi feat/heroui-migration tu chybí `sectionPrice` a `showsCode`
 * (tam se cena tiskne, jen když se liší od převažující ceny sekce). Zdejší
 * rošt cenu vypisuje u každé položky.
 */
export const MenuItemRow = memo(function MenuItemRow({
  item, editMode, disabled, onEdit,
}: {
  item: MenuItem;
  editMode: boolean;
  disabled: boolean;
  onEdit: (item: MenuItem) => void;
}) {
  return (
    <div className="flex items-start gap-1.5 py-1">
      <span className="font-mono text-[11px] text-stone-600 w-5 shrink-0 text-right mt-[3px]">{item.code}</span>
      <span className="flex-1 min-w-0 text-[13px] font-medium text-stone-800 leading-snug">
        {item.name}
        {item.allergens && <AllergenBadges allergens={item.allergens} />}
      </span>
      {editMode ? (
        <button
          aria-label="Upravit"
          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-stone-500 bg-stone-100/70 hover:text-amber-600 hover:bg-amber-50 transition shrink-0 mt-[1px]"
          disabled={disabled}
          onClick={() => onEdit(item)}
          type="button"
        >
          <MIcon name="edit" size={14} />
        </button>
      ) : (
        <span className="shrink-0 text-[12px] font-semibold text-stone-600 tabular-nums mt-[2px]">{item.price} Kč</span>
      )}
    </div>
  );
});
