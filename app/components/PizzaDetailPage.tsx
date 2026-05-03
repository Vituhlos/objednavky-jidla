"use client";

import Link from "next/link";
import type { PizzaOrderData } from "@/lib/pizza";
import { PIZZA_BOX_FEE } from "@/lib/pizza-utils";
import MIcon from "./MIcon";
import type { PizzaTotals } from "@/lib/pizza-utils";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatSentAt(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function PizzaPriceBreakdown({ totals }: { totals: PizzaTotals }) {
  if (totals.finalTotal === 0) return null;
  const rows = [
    { label: "Pizzy (ceny)", value: `${totals.baseTotal} Kč`, accent: false },
    { label: `Krabice (${PIZZA_BOX_FEE} Kč/ks)`, value: `${totals.boxTotal} Kč`, accent: false },
    ...(totals.freeCount > 0 ? [{ label: `3+1 zdarma (${totals.freeCount}× nejlevnější)`, value: `−${totals.discountAmount} Kč`, accent: true }] : []),
    ...(totals.deliveryFee > 0 ? [{ label: "Doprava", value: `${totals.deliveryFee} Kč`, accent: false }] : []),
    ...(totals.deliveryFee === 0 && totals.finalTotal > 0 ? [{ label: "Doprava zdarma (≥4 ks)", value: "0 Kč", accent: true }] : []),
  ];
  return (
    <div className="mt-3 glass-soft rounded-2xl overflow-hidden">
      {rows.map(({ label, value, accent }) => (
        <div key={label} className="flex items-center justify-between px-3 py-1.5 border-b border-white/40 last:border-0 text-[12px]">
          <span className="text-stone-600">{label}</span>
          <span className={`font-semibold ${accent ? "text-emerald-600" : "text-stone-800"}`}>{value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-2 text-[13px]" style={{ background: "rgba(245,158,11,0.06)" }}>
        <span className="font-semibold text-stone-700">Celkem</span>
        <span className="font-display font-bold text-stone-900">{totals.finalTotal} Kč</span>
      </div>
      {totals.pricePerPizza > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 text-[11.5px]">
          <span className="text-stone-500">Cena za kus</span>
          <span className="font-semibold text-stone-600">{totals.pricePerPizza} Kč/ks</span>
        </div>
      )}
    </div>
  );
}

export default function PizzaDetailPage({ data }: { data: PizzaOrderData }) {
  const { order, rows, totalCount, totals } = data;
  const pricePerPizza = totals.pricePerPizza;
  const sent = order.status === "sent";

  const pizzaCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.pizzaItem) {
      const key = `${r.pizzaItem.code}. ${r.pizzaItem.name}`;
      pizzaCounts.set(key, (pizzaCounts.get(key) ?? 0) + r.count);
    }
  }

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <Link className="text-[12px] text-stone-400 hover:text-stone-600 transition" href="/historie">← Historie</Link>
        <span className="font-display font-bold text-[15px] text-stone-900">Pizza {formatDate(order.date)}</span>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={sent ? { background: "rgba(21,128,61,0.12)", color: "#15803d" } : { background: "rgba(26,18,8,0.07)", color: "#7a6552" }}
        >
          {sent ? "Odesláno" : "Koncept"}
        </span>
        {order.sentAt && <span className="text-[12px] text-stone-500">{formatSentAt(order.sentAt)}</span>}
        {totalCount > 0 && (
          <span className="ml-auto font-display font-bold text-[16px] text-stone-900">{totals.finalTotal} Kč</span>
        )}
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link className="text-[12px] text-stone-400 hover:text-stone-600 transition" href="/historie">←</Link>
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Pizza {formatDate(order.date)}</span>
          {totalCount > 0 && (
            <span className="font-display font-bold text-[14px] text-stone-900">{totals.finalTotal} Kč</span>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={sent ? { background: "rgba(21,128,61,0.12)", color: "#15803d" } : { background: "rgba(26,18,8,0.07)", color: "#7a6552" }}
          >
            {sent ? "Odesláno" : "Koncept"}
          </span>
          {order.sentAt && <span className="text-[11px] text-stone-500">{formatSentAt(order.sentAt)}</span>}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 space-y-4 pb-28 md:pb-8">
        {/* Order rows */}
        <section className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(234,88,12,0.07)" }}>
            <MIcon name="local_pizza" size={17} fill style={{ color: "#EA580C" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Objednávky</span>
            {totalCount > 0 && (
              <span className="text-[11px] text-stone-500">
                {totalCount} ks · {totals.finalTotal} Kč
                {pricePerPizza > 0 && ` · ${pricePerPizza} Kč/ks`}
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-stone-400 text-center">Žádné řádky v objednávce.</div>
          ) : (
            <>
              <div className="hidden md:grid gap-3 px-4 py-1.5 border-b border-white/30 font-display text-[10px] uppercase tracking-wide text-stone-500 font-semibold" style={{ gridTemplateColumns: "28px 1fr 2fr 60px 80px 80px", background: "rgba(255,255,255,0.3)" }}>
                <span>#</span>
                <span>Jméno</span>
                <span>Pizza</span>
                <span className="text-center">Ks</span>
                <span className="text-right">Cena</span>
                <span className="text-right">Platí</span>
              </div>
              {rows.map((row, idx) => {
                const adjustedPrice = row.pizzaItem && pricePerPizza > 0 ? pricePerPizza * row.count : 0;
                return (
                  <div key={row.id} className="border-b border-white/30 last:border-0">
                    {/* Mobile */}
                    <div className="md:hidden flex items-center gap-3 px-4 py-3">
                      <span className="font-mono text-[11px] text-stone-400 w-5 shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-stone-800">{row.personName || "–"}</p>
                        <p className="text-[12px] text-stone-500 truncate">
                          {row.pizzaItem ? `${row.pizzaItem.code}. ${row.pizzaItem.name}` : "–"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] text-stone-400">{row.count} ks</p>
                        <p className="text-[12px] font-semibold text-stone-700">{adjustedPrice > 0 ? `${adjustedPrice} Kč` : row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}</p>
                      </div>
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:grid items-center gap-3 px-4 py-2.5 text-[12.5px]" style={{ gridTemplateColumns: "28px 1fr 2fr 60px 80px 80px" }}>
                      <span className="font-mono text-[11px] text-stone-400">{idx + 1}</span>
                      <span className="font-medium text-stone-800">{row.personName || "–"}</span>
                      <span className="text-stone-600">{row.pizzaItem ? `${row.pizzaItem.code}. ${row.pizzaItem.name}` : "–"}</span>
                      <span className="text-center text-stone-600">{row.count}</span>
                      <span className="text-right text-stone-500">{row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}</span>
                      <span className="text-right font-semibold text-stone-800">{adjustedPrice > 0 ? `${adjustedPrice} Kč` : "–"}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </section>

        {/* Summary */}
        {(pizzaCounts.size > 0 || totals.finalTotal > 0) && (
          <section className="glass rounded-3xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(79,138,83,0.07)" }}>
              <MIcon name="receipt_long" size={17} fill style={{ color: "#4F8A53" }} />
              <span className="font-display font-bold text-[13.5px] text-stone-900">Souhrn</span>
            </div>
            <div className="p-4">
              {pizzaCounts.size > 0 && (
                <div>
                  <p className="font-display text-[11px] uppercase tracking-wide text-stone-500 font-semibold mb-2">Pizzy</p>
                  {[...pizzaCounts.entries()].map(([k, v]) => (
                    <p key={k} className="text-[12.5px] text-stone-700 py-0.5">
                      <strong className="text-stone-900">{v}×</strong> {k}
                    </p>
                  ))}
                  <PizzaPriceBreakdown totals={totals} />
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
