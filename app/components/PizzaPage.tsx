"use client";

import { useState, useTransition, useCallback } from "react";
import type { PizzaOrderData, PizzaOrderRow, PizzaItem } from "@/lib/pizza";
import {
  actionAddPizzaRow,
  actionUpdatePizzaRow,
  actionDeletePizzaRow,
  actionUpdatePizzaPrices,
} from "@/app/actions";
import AppSidebar from "./AppSidebar";

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

  const today = new Date().toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <main className="app-shell">
      <AppSidebar />

      <section className="main-stage">
        <header className="hero">
          <div className="hero__topline">
            <span>{today}</span>
          </div>
          <div className="hero__content">
            <div>
              <p className="hero__eyebrow">Sdílený objednávkový list</p>
              <h2>Pizza</h2>
              <p className="hero__description">
                Vyberte si pizzu z aktuálního ceníku. Ceník lze aktualizovat
                přímo z webu pizza-dublovice.cz.
              </p>
            </div>
            <div className="hero__actions">
              <div className="status-card">
                <span className="status-card__label">Celkem pizz</span>
                <strong className="status--draft">{totalCount} ks</strong>
              </div>
              <div className="hero__button-row">
                <button
                  className="header-action header-action--secondary"
                  disabled={isPending}
                  onClick={handleScrape}
                  type="button"
                >
                  {isPending ? "Načítám..." : "Aktualizovat ceník z webu"}
                </button>
              </div>
              {scrapeStatus && <p className="pizza-scrape-status">{scrapeStatus}</p>}
              {scrapeError && <p className="send-error">{scrapeError}</p>}
            </div>
          </div>
        </header>

        {pizzaItems.length === 0 && (
          <div className="alert-strip">
            <strong>Ceník není načten.</strong>
            <span>
              Klikněte na „Aktualizovat ceník z webu" nebo zadejte pizzy ručně
              až po načtení.
            </span>
          </div>
        )}

        <div className="workspace">
          <div className="pizza-panel">
            <div className="pizza-panel__header">
              <p className="department__eyebrow">Objednávky</p>
              <h2 className="pizza-panel__title">Seznam objednávek</h2>
            </div>

            <div className="pizza-table">
              <div className="pizza-table-head">
                <span>#</span>
                <span>Jméno</span>
                <span>Pizza</span>
                <span>Ks</span>
                <span>Cena</span>
                <span></span>
              </div>

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

              {rows.length === 0 && (
                <div className="pizza-empty">
                  Zatím žádné objednávky. Přidejte první osobu.
                </div>
              )}
            </div>

            <div className="pizza-panel__footer">
              <button
                className="row-add-btn"
                disabled={isPending}
                onClick={handleAddRow}
                type="button"
              >
                + Přidat osobu
              </button>
            </div>
          </div>

          <aside className="summary-panel">
            <div className="summary-panel__header">
              <p className="summary-panel__eyebrow">Přehled</p>
              <h2>Souhrn objednávky</h2>
            </div>

            {pizzaCounts.size > 0 ? (
              <div className="summary-group">
                <h3>Pizzy</h3>
                {[...pizzaCounts.entries()].map(([k, v]) => (
                  <p key={k}>
                    {v}× {k}
                  </p>
                ))}
              </div>
            ) : (
              <div className="summary-group summary-group--empty">
                <p>Zatím žádné výběry.</p>
              </div>
            )}

            {pizzaItems.length > 0 && (
              <div className="summary-group">
                <h3>Ceník</h3>
                {pizzaItems.map((item) => (
                  <p key={item.id} style={{ fontSize: "0.82rem" }}>
                    <strong>{item.code}.</strong> {item.name} – {item.price} Kč
                  </p>
                ))}
              </div>
            )}

            <div className="summary-panel__total">
              <span>Celková cena</span>
              <strong>{totalPrice} Kč</strong>
            </div>
          </aside>
        </div>
      </section>
    </main>
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
    <div className="pizza-row">
      <span className="pizza-row__num">{idx + 1}</span>

      <div className="cell">
        <input
          className="cell-input"
          defaultValue={row.personName}
          disabled={isPending}
          onBlur={(e) => onUpdate(row.id, { personName: e.target.value })}
          placeholder="Jméno..."
          type="text"
        />
      </div>

      <div className="cell">
        <select
          className="cell-select"
          disabled={isPending || pizzaItems.length === 0}
          onChange={(e) =>
            onUpdate(row.id, {
              pizzaItemId: e.target.value ? Number(e.target.value) : null,
            })
          }
          value={row.pizzaItemId ?? ""}
        >
          <option value="">— vyberte —</option>
          {pizzaItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code}. {item.name} ({item.price} Kč)
            </option>
          ))}
        </select>
      </div>

      <div className="cell cell--center">
        <div className="extras-panel__stepper">
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
      </div>

      <div className="cell cell--price">
        {row.rowPrice > 0 ? `${row.rowPrice} Kč` : "–"}
      </div>

      <div className="cell cell--action">
        <button
          className="row-delete-btn"
          disabled={isPending}
          onClick={() => onDelete(row.id)}
          title="Odstranit řádek"
          type="button"
        >
          ×
        </button>
      </div>
    </div>
  );
}
