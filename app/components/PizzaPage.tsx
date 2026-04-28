"use client";

import { useState, useTransition, useCallback } from "react";
import type { PizzaOrderData, PizzaOrderRow, PizzaItem } from "@/lib/pizza";
import { computePizzaTotals, PIZZA_BOX_FEE } from "@/lib/pizza-utils";
import MIcon from "./MIcon";
import type { PizzaTotals } from "@/lib/pizza-utils";
import {
  actionAddPizzaRow,
  actionUpdatePizzaRow,
  actionDeletePizzaRow,
  actionUpdatePizzaPrices,
} from "@/app/actions";
import AppTopBar from "./AppTopBar";
import { ConfirmModal } from "./ConfirmModal";

function recalcRows(rows: PizzaOrderRow[], items: PizzaItem[]): PizzaOrderRow[] {
  return rows.map((r) => {
    const pizzaItem = items.find((i) => i.id === r.pizzaItemId) ?? null;
    return { ...r, pizzaItem, rowPrice: pizzaItem ? pizzaItem.price * r.count : 0 };
  });
}

export default function PizzaPage({ initialData }: { initialData: PizzaOrderData }) {
  const [rows, setRows] = useState(initialData.rows);
  const [pizzaItems, setPizzaItems] = useState(initialData.pizzaItems);
  const [orderId] = useState(initialData.order.id);
  const [isPending, startTransition] = useTransition();
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const totals = computePizzaTotals(rows);
  const totalCount = rows.reduce((s, r) => s + r.count, 0);

  const pizzaCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.pizzaItem) {
      const key = `${r.pizzaItem.code}. ${r.pizzaItem.name}`;
      pizzaCounts.set(key, (pizzaCounts.get(key) ?? 0) + r.count);
    }
  }

  const handleAddRow = useCallback(() => {
    startTransition(async () => {
      const newRow = await actionAddPizzaRow(orderId);
      setRows((prev) => recalcRows([...prev, newRow], pizzaItems));
    });
  }, [orderId, pizzaItems]);

  const handleUpdateRow = useCallback(
    (rowId: number, updates: Partial<{ personName: string; pizzaItemId: number | null; count: number }>) => {
      setRows((prev) => recalcRows(prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)), pizzaItems));
      startTransition(async () => {
        const updated = await actionUpdatePizzaRow(rowId, updates);
        setRows((prev) => recalcRows(prev.map((r) => (r.id === rowId ? updated : r)), pizzaItems));
      });
    },
    [pizzaItems]
  );

  const handleDeleteRow = useCallback((rowId: number) => {
    startTransition(async () => {
      await actionDeletePizzaRow(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    });
  }, []);

  const handleScrape = () => {
    setScrapeError(null);
    setScrapeStatus("Načítám ceník z webu...");
    startTransition(async () => {
      try {
        const res = await fetch("/api/pizza/scrape");
        let json: { items?: Array<{ code: number; name: string; price: number }>; error?: string };
        try {
          json = await res.json() as typeof json;
        } catch {
          setScrapeError(`Server vrátil neočekávanou odpověď (HTTP ${res.status}).`);
          setScrapeStatus(null);
          return;
        }
        if (!res.ok || json.error) {
          setScrapeError(json.error ?? "Neznámá chyba při načítání ceníku.");
          setScrapeStatus(null);
          return;
        }
        const items = json.items!;
        await actionUpdatePizzaPrices(items);
        setPizzaItems(items.map((it, idx) => ({ id: idx + 1, ...it })));
        setRows((prev) => recalcRows(prev, items.map((it, idx) => ({ id: idx + 1, ...it }))));
        setScrapeStatus(`Ceník aktualizován – ${items.length} pizz načteno.`);
      } catch (e) {
        setScrapeError(`Nepodařilo se načíst ceník: ${e instanceof Error ? e.message : "neznámá chyba"}`);
        setScrapeStatus(null);
      }
    });
  };

  return (
    <div className="k-shell">
      <AppTopBar />

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-stone-900">Pizza</span>
        {totalCount > 0 && (
          <span className="text-[12px] text-stone-600">
            <strong>{totalCount} ks</strong> · <strong className="text-stone-800">{totals.finalTotal} Kč</strong>
            {totals.pricePerPizza > 0 && ` · ${totals.pricePerPizza} Kč/ks`}
          </span>
        )}
        {scrapeStatus && <span className="text-[12px] text-emerald-600">{scrapeStatus}</span>}
        {scrapeError && <span className="text-[12px] text-red-500 truncate max-w-xs">{scrapeError}</span>}
        <div className="ml-auto">
          <button
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-soft text-stone-600"
            disabled={isPending}
            onClick={handleScrape}
            type="button"
          >
            <MIcon name="refresh" size={14} />
            {isPending ? "Načítám..." : "Aktualizovat ceník"}
          </button>
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Pizza</span>
          {totalCount > 0 && (
            <span className="text-[12px] text-stone-700 font-semibold">{totalCount} ks · {totals.finalTotal} Kč</span>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 pb-2.5">
          {scrapeStatus && <span className="text-[11px] text-emerald-600 flex-1 truncate">{scrapeStatus}</span>}
          {scrapeError && <span className="text-[11px] text-red-500 flex-1 truncate">{scrapeError}</span>}
          <button
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-soft text-stone-600 shrink-0 disabled:opacity-50 hover:bg-white/80 active:scale-[0.97] transition"
            disabled={isPending}
            onClick={handleScrape}
            type="button"
          >
            <MIcon name="refresh" size={13} />
            {isPending ? "Načítám..." : "Aktualizovat ceník"}
          </button>
        </div>
      </div>

      {pizzaItems.length === 0 && (
        <div className="mx-4 mt-4 p-3.5 glass rounded-2xl border border-slate-200/60 text-[12.5px] text-stone-700">
          <strong>Ceník není načten.</strong>{" "}
          Klikněte na „Aktualizovat ceník" pro načtení aktuálního ceníku z webu.
        </div>
      )}

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-28 md:pb-8">
      <div className="space-y-4 md:grid md:gap-4 md:space-y-0 md:items-start" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* Orders */}
        <section className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(234,88,12,0.07)" }}>
            <MIcon name="local_pizza" size={17} fill style={{ color: "#EA580C" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Objednávky</span>
            {totalCount > 0 && (
              <span className="text-[11px] text-stone-500">{totalCount} ks · {totals.finalTotal} Kč</span>
            )}
            <button
              className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
              disabled={isPending}
              onClick={handleAddRow}
              type="button"
            >
              <MIcon name="add" size={13} /> Přidat
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-stone-400">
              <MIcon name="local_pizza" size={32} fill />
              <p className="text-[13px]">Zatím nikdo neobjednal</p>
              <p className="text-[11.5px]">Přidej první osobu tlačítkem výše</p>
            </div>
          ) : (
            <>
              <div className="hidden md:grid gap-3 px-4 py-1.5 border-b border-white/30 font-display text-[10px] uppercase tracking-wide text-stone-500 font-semibold" style={{ gridTemplateColumns: "28px 1fr 2fr 90px 80px 80px 32px", background: "rgba(255,255,255,0.3)" }}>
                <span>#</span>
                <span>Jméno</span>
                <span>Pizza</span>
                <span className="text-center">Ks</span>
                <span className="text-right">Cena</span>
                <span className="text-right">Platí</span>
                <span></span>
              </div>
              {rows.map((row, idx) => (
                <PizzaRow
                  idx={idx}
                  isPending={isPending}
                  key={row.id}
                  onDelete={(id) => setDeleteConfirmId(id)}
                  onUpdate={handleUpdateRow}
                  pizzaItems={pizzaItems}
                  pricePerPizza={totals.pricePerPizza}
                  row={row}
                />
              ))}
              {deleteConfirmId !== null && (
                <ConfirmModal
                  message="Tento řádek objednávky pizzy bude odstraněn."
                  onClose={() => setDeleteConfirmId(null)}
                  onConfirm={() => { handleDeleteRow(deleteConfirmId); setDeleteConfirmId(null); }}
                  title="Smazat řádek"
                />
              )}
            </>
          )}
        </section>

        {/* Summary */}
        {(pizzaCounts.size > 0 || pizzaItems.length > 0) && (
          <section className="glass rounded-3xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(79,138,83,0.07)" }}>
              <MIcon name="receipt_long" size={17} fill style={{ color: "#4F8A53" }} />
              <span className="font-display font-bold text-[13.5px] text-stone-900">Souhrn</span>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">
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
              {pizzaItems.length > 0 && (
                <div>
                  <p className="font-display text-[11px] uppercase tracking-wide text-stone-500 font-semibold mb-2">Ceník</p>
                  {pizzaItems.map((item) => (
                    <p key={item.id} className="text-[12px] text-stone-600 py-0.5">
                      <strong className="text-stone-800">{item.code}.</strong> {item.name} – {item.price} Kč
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      </main>
    </div>
  );
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

function PizzaRow({
  row,
  idx,
  pizzaItems,
  isPending,
  pricePerPizza,
  onUpdate,
  onDelete,
}: {
  row: PizzaOrderRow;
  idx: number;
  pizzaItems: PizzaItem[];
  isPending: boolean;
  pricePerPizza: number;
  onUpdate: (rowId: number, updates: Partial<{ personName: string; pizzaItemId: number | null; count: number }>) => void;
  onDelete: (rowId: number) => void;
}) {
  const adjustedPrice = row.pizzaItem && pricePerPizza > 0 ? pricePerPizza * row.count : 0;

  return (
    <div className="group border-b border-white/30 last:border-0">
      {/* Mobile */}
      <div className="md:hidden flex items-start gap-2 px-4 py-3">
        <span className="font-mono text-[11px] text-stone-400 w-5 pt-2 shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <input
            className="glass-soft rounded-xl px-3 py-1.5 text-[13px] w-full outline-none"
            defaultValue={row.personName}
            disabled={isPending}
            onBlur={(e) => onUpdate(row.id, { personName: e.target.value })}
            placeholder="Jméno..."
            type="text"
          />
          <select
            className="k-select"
            disabled={isPending || pizzaItems.length === 0}
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
            <button className="stepper-btn" disabled={isPending || row.count <= 1} onClick={() => onUpdate(row.id, { count: row.count - 1 })} type="button">−</button>
            <span className="stepper-count">{row.count}</span>
            <button className="stepper-btn" disabled={isPending || row.count >= 10} onClick={() => onUpdate(row.id, { count: row.count + 1 })} type="button">+</button>
          </div>
          <span className="text-[11px] text-stone-500">{adjustedPrice > 0 ? `${adjustedPrice} Kč` : row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}</span>
          <button
            className="w-6 h-6 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 transition"
            disabled={isPending}
            onClick={() => onDelete(row.id)}
            type="button"
          >
            <MIcon name="close" size={13} />
          </button>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:grid items-center gap-3 px-4 py-2.5" style={{ gridTemplateColumns: "28px 1fr 2fr 90px 80px 80px 32px" }}>
        <span className="font-mono text-[11px] text-stone-400">{idx + 1}</span>
        <input
          className="glass-soft rounded-xl px-3 py-1.5 text-[13px] outline-none"
          defaultValue={row.personName}
          disabled={isPending}
          onBlur={(e) => onUpdate(row.id, { personName: e.target.value })}
          placeholder="Jméno..."
          type="text"
        />
        <select
          className="k-select"
          disabled={isPending || pizzaItems.length === 0}
          onChange={(e) => onUpdate(row.id, { pizzaItemId: e.target.value ? Number(e.target.value) : null })}
          value={row.pizzaItemId ?? ""}
        >
          <option value="">— vyberte —</option>
          {pizzaItems.map((item) => (
            <option key={item.id} value={item.id}>{item.code}. {item.name} ({item.price} Kč)</option>
          ))}
        </select>
        <div className="flex items-center gap-1 justify-center">
          <button className="stepper-btn" disabled={isPending || row.count <= 1} onClick={() => onUpdate(row.id, { count: row.count - 1 })} type="button">−</button>
          <span className="stepper-count">{row.count}</span>
          <button className="stepper-btn" disabled={isPending || row.count >= 10} onClick={() => onUpdate(row.id, { count: row.count + 1 })} type="button">+</button>
        </div>
        <span className="text-[12.5px] text-stone-500 text-right">{row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}</span>
        <span className="text-[12.5px] font-semibold text-stone-800 text-right">{adjustedPrice > 0 ? `${adjustedPrice} Kč` : "–"}</span>
        <button
          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50/80 transition opacity-0 group-hover:opacity-100"
          disabled={isPending}
          onClick={() => onDelete(row.id)}
          type="button"
        >
          <MIcon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
