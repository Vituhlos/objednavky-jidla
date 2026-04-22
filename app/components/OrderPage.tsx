"use client";

import { useState, useTransition, useCallback } from "react";
import type {
  OrderData,
  OrderRowEnriched,
  Department,
  DepartmentData,
} from "@/lib/types";
import { DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/types";
import { computeRowPrice } from "@/lib/pricing";
import { DepartmentPanel } from "./DepartmentPanel";
import {
  actionAddRow,
  actionUpdateRow,
  actionDeleteRow,
  actionSendOrder,
  actionUpdateExtraEmail,
} from "@/app/actions";
import AppSidebar from "./AppSidebar";

function recalcDepartments(
  departments: DepartmentData[]
): DepartmentData[] {
  return departments.map((d) => ({
    ...d,
    subtotal: d.rows.reduce((s, r) => s + r.rowPrice, 0),
  }));
}

function patchRow(
  departments: DepartmentData[],
  rowId: number,
  updated: OrderRowEnriched
): DepartmentData[] {
  return recalcDepartments(
    departments.map((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === rowId ? updated : r)),
    }))
  );
}

export default function OrderPage({ initialData, cutoffTime = "08:00" }: { initialData: OrderData; cutoffTime?: string }) {
  const [departments, setDepartments] = useState(initialData.departments);
  const [orderStatus, setOrderStatus] = useState(initialData.order.status);
  const [orderId] = useState(initialData.order.id);
  const [extraEmail, setExtraEmail] = useState(
    initialData.order.extraEmail ?? ""
  );
  const [sentAt, setSentAt] = useState(initialData.order.sentAt);
  const [isPending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);

  const isSent = orderStatus === "sent";

  const totalPrice = departments.reduce((s, d) => s + d.subtotal, 0);

  const handleAddRow = useCallback(
    (department: Department) => {
      startTransition(async () => {
        const newRow = await actionAddRow(orderId, department);
        setDepartments((prev) =>
          recalcDepartments(
            prev.map((d) =>
              d.name === department
                ? { ...d, rows: [...d.rows, newRow] }
                : d
            )
          )
        );
      });
    },
    [orderId]
  );

  const handleUpdateRow = useCallback(
    (
      rowId: number,
      updates: Partial<{
        personName: string;
        soupItemId: number | null;
        mainItemId: number | null;
        rollCount: number;
        breadDumplingCount: number;
        potatoDumplingCount: number;
        ketchupCount: number;
        tatarkaCount: number;
        bbqCount: number;
      }>
    ) => {
      // Optimistic update: compute new price locally
      setDepartments((prev) => {
        const allRows = prev.flatMap((d) => d.rows);
        const row = allRows.find((r) => r.id === rowId);
        if (!row) return prev;

        const merged = { ...row, ...updates };
        const soupItem =
          "soupItemId" in updates
            ? initialData.todayMenu.soups.find(
                (s) => s.id === updates.soupItemId
              ) ?? null
            : row.soupItem;
        const mainItem =
          "mainItemId" in updates
            ? initialData.todayMenu.meals.find(
                (m) => m.id === updates.mainItemId
              ) ?? null
            : row.mainItem;

        const optimistic: OrderRowEnriched = {
          ...merged,
          soupItem: soupItem ?? null,
          mainItem: mainItem ?? null,
          rowPrice: computeRowPrice(merged, soupItem ?? null, mainItem ?? null),
        };
        return patchRow(prev, rowId, optimistic);
      });

      startTransition(async () => {
        const updated = await actionUpdateRow(rowId, updates);
        setDepartments((prev) => patchRow(prev, rowId, updated));
      });
    },
    [initialData.todayMenu]
  );

  const handleDeleteRow = useCallback((rowId: number) => {
    startTransition(async () => {
      await actionDeleteRow(rowId);
      setDepartments((prev) =>
        recalcDepartments(
          prev.map((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== rowId) }))
        )
      );
    });
  }, []);

  const handleSend = () => {
    if (isSent) return;
    setSendError(null);
    startTransition(async () => {
      try {
        await actionSendOrder(orderId, extraEmail);
        setOrderStatus("sent");
        setSentAt(new Date().toISOString());
      } catch (error) {
        setSendError(
          error instanceof Error
            ? error.message
            : "Odeslání se nezdařilo. Zkuste to znovu."
        );
      }
    });
  };

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    startTransition(async () => {
      await actionUpdateExtraEmail(orderId, e.target.value);
    });
  };

  const today = new Date();
  const dayStr = today.toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  const allSoups = initialData.todayMenu.soups;
  const allMeals = initialData.todayMenu.meals;

  const summaryRows = departments.flatMap((d) =>
    d.rows.filter((r) => r.personName || r.mainItemId)
  );
  const activeDepartments = departments.filter(
    (d) => d.rows.some((r) => r.personName || r.mainItemId)
  );

  const soupCounts = new Map<string, number>();
  const mealCounts = new Map<string, number>();
  const extrasCounts = new Map<string, number>();

  for (const r of summaryRows) {
    if (r.soupItem) {
      const key = `${r.soupItem.code} – ${r.soupItem.name}`;
      soupCounts.set(key, (soupCounts.get(key) ?? 0) + 1);
    }
    if (r.mainItem) {
      const key = `${r.mainItem.code} – ${r.mainItem.name}`;
      mealCounts.set(key, (mealCounts.get(key) ?? 0) + 1);
    }
    const extrasMap = [
      { label: "Houskový knedlík", count: r.breadDumplingCount },
      { label: "Bramborový knedlík", count: r.potatoDumplingCount },
      { label: "Kečup", count: r.ketchupCount },
      { label: "Tatarka", count: r.tatarkaCount },
      { label: "BBQ omáčka", count: r.bbqCount },
      { label: "Houska", count: r.rollCount },
    ];
    for (const { label, count } of extrasMap) {
      if (count > 0) {
        extrasCounts.set(label, (extrasCounts.get(label) ?? 0) + count);
      }
    }
  }

  return (
    <main className="app-shell">
      <AppSidebar />

      <section className="main-stage">
        <header className="hero">
          <div className="hero__topline">
            <span>{dayStr}</span>
          </div>
          <div className="hero__content">
            <div>
              <p className="hero__eyebrow">Dnešní provoz</p>
              <h2>Dnešní objednávka</h2>
              <p className="hero__description">
                Vyplňte jméno a vybírejte pouze z aktuální nabídky. Odeslání
                zůstává centrální a sdílené pro celé oddělení.
              </p>
            </div>

            <div className="hero__actions">
              <div className="status-card">
                <span className="status-card__label">Stav objednávky</span>
                <strong className={isSent ? "status--sent" : "status--draft"}>
                  {isSent
                    ? `ODESLÁNO ${sentAt ? new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : ""}`
                    : "KONCEPT"}
                </strong>
              </div>
              <label className="email-field">
                <span>Další e-mail příjemce</span>
                <input
                  defaultValue={extraEmail}
                  disabled={isSent}
                  onBlur={handleEmailBlur}
                  onChange={(e) => setExtraEmail(e.target.value)}
                  placeholder="volitelný e-mail..."
                  type="email"
                />
              </label>
              {sendError && (
                <p className="send-error">{sendError}</p>
              )}
              <div className="hero__button-row">
                <button
                  className="header-action header-action--primary"
                  disabled={isSent || isPending}
                  onClick={handleSend}
                  type="button"
                >
                  {isPending ? "Odesílám..." : "Odeslat objednávku"}
                </button>
              </div>
            </div>
          </div>
        </header>

        {!isSent && (
          <div className="alert-strip">
            <strong>Uzávěrka dnes v {cutoffTime}.</strong>
            <span>
              Vybírejte pouze z rozbalovacích seznamů a zachovejte sdílený
              řádkový model.
            </span>
          </div>
        )}

        {isSent && (
          <div className="alert-strip alert-strip--success">
            <strong>Objednávka byla odeslána.</strong>
            <span>Další úpravy nejsou možné.</span>
          </div>
        )}

        <div className="workspace">
          <div className="department-stack">
            {DEPARTMENTS.map((dept) => {
              const deptData = departments.find((d) => d.name === dept)!;
              return (
                <DepartmentPanel
                  data={deptData}
                  isSent={isSent}
                  key={dept}
                  meals={allMeals}
                  onAddRow={() => handleAddRow(dept)}
                  onDeleteRow={handleDeleteRow}
                  onUpdateRow={handleUpdateRow}
                  soups={allSoups}
                />
              );
            })}
          </div>

          <aside className="summary-panel">
            <div className="summary-panel__header">
              <p className="summary-panel__eyebrow">Odesílací list</p>
              <h2>Souhrn objednávky</h2>
            </div>

            {activeDepartments.length > 0 && (
              <div className="summary-group">
                <h3>Aktivní oddělení</h3>
                {activeDepartments.map((d) => (
                  <p key={d.name}>{DEPARTMENT_LABELS[d.name]}</p>
                ))}
              </div>
            )}

            {soupCounts.size > 0 && (
              <div className="summary-group">
                <h3>Polévky</h3>
                {[...soupCounts.entries()].map(([k, v]) => (
                  <p key={k}>
                    {v}× {k}
                  </p>
                ))}
              </div>
            )}

            {mealCounts.size > 0 && (
              <div className="summary-group">
                <h3>Jídla</h3>
                {[...mealCounts.entries()].map(([k, v]) => (
                  <p key={k}>
                    {v}× {k}
                  </p>
                ))}
              </div>
            )}

            {extrasCounts.size > 0 && (
              <div className="summary-group">
                <h3>Přílohy</h3>
                {[...extrasCounts.entries()].map(([k, v]) => (
                  <p key={k}>
                    {v}× {k}
                  </p>
                ))}
              </div>
            )}

            {summaryRows.length === 0 && (
              <div className="summary-group summary-group--empty">
                <p>Zatím žádné položky.</p>
                <p>Přidejte řádky do oddělení a vyplňte jídla.</p>
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
