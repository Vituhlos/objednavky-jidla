"use client";

import { memo } from "react";
import { PIZZA_BOX_FEE } from "@/lib/pizza-utils";
import type { PizzaTotals } from "@/lib/pizza-utils";

export const PizzaPriceBreakdown = memo(function PizzaPriceBreakdown({ totals }: { totals: PizzaTotals }) {
  if (totals.finalTotal === 0) return null;
  const breakdownRows = [
    { label: "Pizzy (ceny)", value: `${totals.baseTotal} Kč`, accent: false },
    { label: `Krabice (${PIZZA_BOX_FEE} Kč/ks)`, value: `${totals.boxTotal} Kč`, accent: false },
    ...(totals.freeCount > 0 ? [{ label: `2+1 zdarma (${totals.freeCount}× nejlevnější)`, value: `−${totals.discountAmount} Kč`, accent: true }] : []),
    ...(totals.deliveryFee > 0 ? [{ label: "Doprava", value: `${totals.deliveryFee} Kč`, accent: false }] : []),
    ...(totals.deliveryFee === 0 && totals.finalTotal > 0 ? [{ label: "Doprava zdarma (≥4 ks)", value: "0 Kč", accent: true }] : []),
  ];
  return (
    <div className="mt-3 glass-soft rounded-2xl overflow-hidden">
      {breakdownRows.map(({ label, value, accent }) => (
        <div key={label} className="flex items-center justify-between px-3 py-1.5 border-b border-white/40 last:border-0 text-[12px]">
          <span className="text-stone-600">{label}</span>
          <span className={`font-semibold ${accent ? "text-emerald-600" : "text-stone-800"}`}>{value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-2 text-[13px] border-t border-white/40" style={{ background: "rgba(245,158,11,0.06)" }}>
        <span className="font-semibold text-stone-700">Celkem pro pizzaře</span>
        <span className="font-display font-bold text-stone-900">{totals.finalTotal} Kč</span>
      </div>
      {totals.pricePerPerson > 0 && (
        <div className="flex items-center justify-between px-3 py-2 text-[13px]" style={{ background: "rgba(234,88,12,0.05)" }}>
          <span className="font-semibold text-stone-700">Na osobu ({totals.personCount} objednávajících)</span>
          <span className="font-display font-bold text-amber-700">{totals.pricePerPerson} Kč</span>
        </div>
      )}
    </div>
  );
});
