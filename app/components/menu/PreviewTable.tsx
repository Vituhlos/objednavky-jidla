"use client";

import { memo, useMemo } from "react";
import type { ParsedMenuItem } from "@/lib/parse-menu";
import { DAY_LABELS, DAY_ORDER } from "./menu-utils";

/** Náhled rozparsovaného PDF před uložením — co parser vyčetl, po dnech. */
export const PreviewTable = memo(function PreviewTable({ items }: { items: ParsedMenuItem[] }) {
  const byDay = useMemo(() => {
    const acc: Record<string, { soups: ParsedMenuItem[]; meals: ParsedMenuItem[] }> = {};
    for (const item of items) {
      if (!acc[item.day]) acc[item.day] = { soups: [], meals: [] };
      if (item.type === "Polévka") acc[item.day].soups.push(item);
      else acc[item.day].meals.push(item);
    }
    return acc;
  }, [items]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
      {DAY_ORDER.filter((d) => byDay[d]).map((day) => (
        <div className="glass-soft rounded-2xl p-3" key={day}>
          <h4 className="font-display font-bold text-[12px] text-stone-700 mb-2">{DAY_LABELS[day]}</h4>
          {byDay[day].soups.length > 0 && (
            <div className="mb-2">
              <p className="font-display text-[10px] uppercase tracking-wide text-stone-500 font-semibold mb-1">Polévky</p>
              {byDay[day].soups.map((s, i) => (
                <p className="text-[12px] text-stone-700 py-0.5" key={i}>
                  <span className="font-mono text-[10px] text-stone-400 mr-1">{s.code}</span>{s.name}
                </p>
              ))}
            </div>
          )}
          {byDay[day].meals.length > 0 && (
            <div>
              <p className="font-display text-[10px] uppercase tracking-wide text-stone-500 font-semibold mb-1">Jídla</p>
              {byDay[day].meals.map((m, i) => (
                <p className="text-[12px] text-stone-700 py-0.5" key={i}>
                  <span className="font-mono text-[10px] text-stone-400 mr-1">{m.code}</span>{m.name}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
