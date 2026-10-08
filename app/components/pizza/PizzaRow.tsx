"use client";

import { memo } from "react";
import type { PizzaOrderRow, PizzaItem } from "@/lib/pizza";
import type { DepartmentInfo } from "@/lib/departments";
import MIcon from "../MIcon";
import { PizzaSelect } from "./PizzaSelect";

export const PizzaRow = memo(function PizzaRow({
  row,
  idx,
  pizzaItems,
  departments,
  isPending,
  isClosed,
  pricePerPizza,
  onUpdate,
  onDelete,
}: {
  row: PizzaOrderRow;
  idx: number;
  pizzaItems: PizzaItem[];
  departments: DepartmentInfo[];
  isPending: boolean;
  isClosed: boolean;
  pricePerPizza: number;
  onUpdate: (rowId: number, updates: Partial<{ personName: string; department: string; pizzaItemId: number | null; count: number }>) => void;
  onDelete: (rowId: number) => void;
}) {
  const disabled = isPending || isClosed;
  const adjustedPrice = row.pizzaItem && pricePerPizza > 0 ? pricePerPizza * row.count : 0;

  return (
    <div className="group border-b border-white/30 last:border-0">
      {/* Mobile */}
      <div className="md:hidden flex items-start gap-2 px-4 py-3">
        <span className="font-mono text-[11px] text-stone-400 w-5 pt-2 shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <input
              className="glass-soft rounded-xl px-3 py-1.5 text-[13px] outline-none flex-1 min-w-0"
              defaultValue={row.personName}
              disabled={disabled}
              onBlur={(e) => onUpdate(row.id, { personName: e.target.value })}
              placeholder="Jméno…"
              type="text"
            />
            {departments.length > 0 && (
              <select
                className="k-select"
                disabled={disabled}
                onChange={(e) => onUpdate(row.id, { department: e.target.value })}
                style={{ width: 100, flexShrink: 0 }}
                value={row.department}
              >
                <option value="">Odděl.</option>
                {departments.map((d) => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </select>
            )}
          </div>
          <select
            className="k-select"
            disabled={disabled || pizzaItems.length === 0}
            onChange={(e) => onUpdate(row.id, { pizzaItemId: e.target.value ? Number(e.target.value) : null })}
            value={row.pizzaItemId ?? ""}
          >
            <option value="">— vyberte —</option>
            {pizzaItems.map((item) => (
              <option key={item.id} value={item.id}>{item.code}. {item.name} ({item.price} Kč)</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <button aria-label="Snížit počet" className="stepper-btn" disabled={disabled || row.count <= 1} onClick={() => onUpdate(row.id, { count: row.count - 1 })} type="button">−</button>
            <span className="stepper-count">{row.count}</span>
            <button aria-label="Zvýšit počet" className="stepper-btn" disabled={disabled || row.count >= 10} onClick={() => onUpdate(row.id, { count: row.count + 1 })} type="button">+</button>
          </div>
          <span className="text-[11px] text-stone-500">{adjustedPrice > 0 ? `${adjustedPrice} Kč` : row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}</span>
          {!isClosed && (
            <button
              aria-label="Smazat řádek"
              className="w-11 h-11 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 transition"
              disabled={disabled}
              onClick={() => onDelete(row.id)}
              type="button"
            >
              <MIcon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:grid items-center gap-3 px-4 py-2.5" style={{ gridTemplateColumns: `28px 100px 110px 2fr 90px 80px 80px ${isClosed ? "0px" : "32px"}` }}>
        <span className="font-mono text-[11px] text-stone-400">{idx + 1}</span>
        <input
          className="glass-soft rounded-xl px-3 py-1.5 text-[13px] outline-none"
          defaultValue={row.personName}
          disabled={disabled}
          onBlur={(e) => onUpdate(row.id, { personName: e.target.value })}
          placeholder="Jméno…"
          type="text"
        />
        <select
          className="k-select"
          disabled={disabled}
          onChange={(e) => onUpdate(row.id, { department: e.target.value })}
          value={row.department}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.name} value={d.name}>{d.label}</option>
          ))}
        </select>
        <PizzaSelect
          value={row.pizzaItemId}
          onChange={(v) => onUpdate(row.id, { pizzaItemId: v })}
          items={pizzaItems}
          disabled={disabled || pizzaItems.length === 0}
        />
        <div className="flex items-center gap-1 justify-center">
          <button aria-label="Snížit počet" className="stepper-btn" disabled={disabled || row.count <= 1} onClick={() => onUpdate(row.id, { count: row.count - 1 })} type="button">−</button>
          <span className="stepper-count">{row.count}</span>
          <button aria-label="Zvýšit počet" className="stepper-btn" disabled={disabled || row.count >= 10} onClick={() => onUpdate(row.id, { count: row.count + 1 })} type="button">+</button>
        </div>
        <span className="text-[12.5px] text-stone-500 text-right">{row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}</span>
        <span className="text-[12.5px] font-semibold text-stone-800 text-right">{adjustedPrice > 0 ? `${adjustedPrice} Kč` : "–"}</span>
        {!isClosed && (
          <button
            aria-label="Smazat řádek"
            className="w-10 h-10 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 active:text-red-400 hover:bg-red-50/80 transition"
            disabled={disabled}
            onClick={() => onDelete(row.id)}
            type="button"
          >
            <MIcon name="close" size={15} />
          </button>
        )}
      </div>
    </div>
  );
});
