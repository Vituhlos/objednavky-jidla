"use client";

import { useState, useTransition, useCallback } from "react";
import type { PizzaOrderData, PizzaOrderRow, PizzaItem } from "@/lib/pizza";
import {
  actionAddPizzaRow,
  actionUpdatePizzaRow,
  actionDeletePizzaRow,
  actionUpdatePizzaPrices,
} from "@/app/actions";
import AppTopBar from "./AppTopBar";

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

  const totalPrice = rows.reduce((s, r) => s + r.rowPrice, 0);
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
      setRows((prev) =>
        recalcRows(
          prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)),
          pizzaItems
        )
      );
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
        const json = await res.json() as { items?: Array<{ code: number; name: string; price: number }>; error?: string };
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
      } catch {
        setScrapeError("Nepodařilo se připojit k webu pizza-dublovice.cz.");
        setScrapeStatus(null);
      }
    });
  };

  return (
    <div className="v2-shell">
      <AppTopBar />

      {/* ── Infostrip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span style={{ fontWeight: 700, color: "var(--v2-text)", fontSize: "0.95rem" }}>Pizza</span>
          {totalCount > 0 && (
            <span className="v2-fact">
              <strong>{totalCount} ks</strong>
              {" · "}
              <strong className="v2-accent">{totalPrice} Kč</strong>
            </span>
          )}
          {scrapeStatus && (
            <span className="v2-fact" style={{ color: "var(--v2-green)" }}>{scrapeStatus}</span>
          )}
          {scrapeError && (
            <span className="v2-fact" style={{ color: "#dc2626" }}>{scrapeError}</span>
          )}
        </div>
        <div className="v2-infostrip__send">
          <button
            className="v2-btn v2-btn--secondary"
            disabled={isPending}
            onClick={handleScrape}
            type="button"
          >
            {isPending ? "Načítám..." : "Aktualizovat ceník z webu"}
          </button>
        </div>
      </div>

      {pizzaItems.length === 0 && (
        <div className="v2-alert v2-alert--warn">
          <strong>Ceník není načten.</strong>{" "}
          Klikněte na „Aktualizovat ceník z webu" nebo zadejte pizzy ručně až po načtení.
        </div>
      )}

      {/* ── Content ── */}
      <main className="v2-content">
        {/* Orders */}
        <section className="v2-dept">
          <div className="v2-dept__head">
            <div className="v2-dept__info">
              <div>
                <h2 className="v2-dept__title">Objednávky</h2>
                {totalCount > 0 && (
                  <span className="v2-dept__count">{totalCount} ks · {totalPrice} Kč celkem</span>
                )}
              </div>
            </div>
            <button className="v2-add-btn" disabled={isPending} onClick={handleAddRow} type="button">
              + Přidat osobu
            </button>
          </div>

          {rows.length > 0 && (
            <div className="v2-pizza-cols-head" aria-hidden>
              <span>#</span>
              <span>Jméno</span>
              <span>Pizza</span>
              <span style={{ textAlign: "center" }}>Ks</span>
              <span style={{ textAlign: "right" }}>Cena</span>
              <span></span>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="v2-empty-state">Zatím žádné objednávky. Přidejte první osobu.</div>
          ) : (
            <div>
              {rows.map((row, idx) => (
                <PizzaRow
                  idx={idx}
                  isPending={isPending}
                  key={row.id}
                  onDelete={handleDeleteRow}
                  onUpdate={handleUpdateRow}
                  pizzaItems={pizzaItems}
                  row={row}
                />
              ))}
            </div>
          )}
        </section>

        {/* Summary */}
        {(pizzaCounts.size > 0 || pizzaItems.length > 0) && (
          <section className="v2-dept">
            <div className="v2-dept__head">
              <div>
                <h2 className="v2-dept__title">Souhrn</h2>
              </div>
            </div>
            <div className="v2-pizza-summary">
              {pizzaCounts.size > 0 && (
                <div className="v2-pizza-summary__group">
                  <h3>Pizzy</h3>
                  {[...pizzaCounts.entries()].map(([k, v]) => (
                    <p key={k}><strong>{v}×</strong> {k}</p>
                  ))}
                  <p className="v2-pizza-summary__total">
                    Celkem: <span className="v2-accent">{totalPrice} Kč</span>
                  </p>
                </div>
              )}
              {pizzaItems.length > 0 && (
                <div className="v2-pizza-summary__group">
                  <h3>Ceník</h3>
                  {pizzaItems.map((item) => (
                    <p key={item.id} style={{ fontSize: "0.82rem" }}>
                      <strong>{item.code}.</strong> {item.name} – {item.price} Kč
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PizzaRow({
  row,
  idx,
  pizzaItems,
  isPending,
  onUpdate,
  onDelete,
}: {
  row: PizzaOrderRow;
  idx: number;
  pizzaItems: PizzaItem[];
  isPending: boolean;
  onUpdate: (rowId: number, updates: Partial<{ personName: string; pizzaItemId: number | null; count: number }>) => void;
  onDelete: (rowId: number) => void;
}) {
  return (
    <div className="v2-pizza-row">
      <span className="v2-pizza-row__num">{idx + 1}</span>

      <input
        className="v2-pizza-input"
        defaultValue={row.personName}
        disabled={isPending}
        onBlur={(e) => onUpdate(row.id, { personName: e.target.value })}
        placeholder="Jméno..."
        type="text"
      />

      <select
        className="v2-pizza-select"
        disabled={isPending || pizzaItems.length === 0}
        onChange={(e) => onUpdate(row.id, { pizzaItemId: e.target.value ? Number(e.target.value) : null })}
        value={row.pizzaItemId ?? ""}
      >
        <option value="">— vyberte —</option>
        {pizzaItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code}. {item.name} ({item.price} Kč)
          </option>
        ))}
      </select>

      <div className="v2-pizza-stepper" style={{ display: "flex", alignItems: "center", gap: "0.3rem", justifyContent: "center" }}>
        <button
          className="stepper-btn"
          disabled={isPending || row.count <= 1}
          onClick={() => onUpdate(row.id, { count: row.count - 1 })}
          type="button"
        >
          −
        </button>
        <span className="stepper-count">{row.count}</span>
        <button
          className="stepper-btn"
          disabled={isPending || row.count >= 10}
          onClick={() => onUpdate(row.id, { count: row.count + 1 })}
          type="button"
        >
          +
        </button>
      </div>

      <span className="v2-pizza-price">{row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}</span>

      <button
        className="v2-delete-btn"
        disabled={isPending}
        onClick={() => onDelete(row.id)}
        title="Odstranit řádek"
        type="button"
      >
        ×
      </button>
    </div>
  );
}
