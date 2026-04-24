"use client";

import { useState, useTransition, useCallback } from "react";
import type { OrderData, OrderRowEnriched, Department, DepartmentData } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import { computeRowPrice, EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { DepartmentPanel } from "./DepartmentPanel";
import AppTopBar from "./AppTopBar";
import {
  actionAddRow,
  actionUpdateRow,
  actionDeleteRow,
  actionSendOrder,
  actionUpdateExtraEmail,
} from "@/app/actions";

// ── Inline SVG icons ──────────────────────────────────────

const IconCalendar = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14">
    <rect height="18" rx="2" width="18" x="3" y="4"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);

const IconClock = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);

const IconInfo = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4M12 8h.01"/>
  </svg>
);

const IconLock = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <rect height="11" rx="2" width="18" x="3" y="11"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const IconCheck = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
    <path d="M22 4L12 14.01l-3-3"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────

function isRowSubmitted(r: OrderRowEnriched): boolean {
  return !!(r.personName || r.soupItemId || r.mainItemId);
}

function recalcDepartments(departments: DepartmentData[]): DepartmentData[] {
  return departments.map((d) => ({
    ...d,
    subtotal: d.rows.filter(isRowSubmitted).reduce((s, r) => s + r.rowPrice, 0),
  }));
}

function patchRow(departments: DepartmentData[], rowId: number, updated: OrderRowEnriched): DepartmentData[] {
  return recalcDepartments(
    departments.map((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === rowId ? updated : r)),
    }))
  );
}

// ── Component ─────────────────────────────────────────────

export default function OrderPage({
  initialData,
  cutoffTime = "08:00",
  menuEmpty = false,
  defaultSoupPrice = 30,
  defaultMealPrice = 110,
  extrasPrices = EXTRAS_PRICES_DEFAULT,
}: {
  initialData: OrderData;
  cutoffTime?: string;
  menuEmpty?: boolean;
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
}) {
  const [departments, setDepartments] = useState(initialData.departments);
  const [orderStatus, setOrderStatus] = useState(initialData.order.status);
  const [orderId] = useState(initialData.order.id);
  const [extraEmail, setExtraEmail] = useState(initialData.order.extraEmail ?? "");
  const [sentAt, setSentAt] = useState(initialData.order.sentAt);
  const [isPending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);

  const isSent = orderStatus === "sent";

  const handleAddRow = useCallback(
    async (department: Department): Promise<number> => {
      const newRow = await actionAddRow(orderId, department);
      setDepartments((prev) =>
        recalcDepartments(
          prev.map((d) =>
            d.name === department ? { ...d, rows: [...d.rows, newRow] } : d
          )
        )
      );
      return newRow.id;
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
        mealCount: number;
        mainItemId2: number | null;
        mealCount2: number;
        rollCount: number;
        breadDumplingCount: number;
        potatoDumplingCount: number;
        ketchupCount: number;
        tatarkaCount: number;
        bbqCount: number;
      }>
    ) => {
      setDepartments((prev) => {
        const allRows = prev.flatMap((d) => d.rows);
        const row = allRows.find((r) => r.id === rowId);
        if (!row) return prev;
        const merged = { ...row, ...updates };
        const soupItem =
          "soupItemId" in updates
            ? initialData.todayMenu.soups.find((s) => s.id === updates.soupItemId) ?? null
            : row.soupItem;
        const mainItem =
          "mainItemId" in updates
            ? initialData.todayMenu.meals.find((m) => m.id === updates.mainItemId) ?? null
            : row.mainItem;
        const mainItem2 =
          "mainItemId2" in updates
            ? initialData.todayMenu.meals.find((m) => m.id === updates.mainItemId2) ?? null
            : row.mainItem2;
        const optimistic: OrderRowEnriched = {
          ...merged,
          soupItem: soupItem ?? null,
          mainItem: mainItem ?? null,
          mainItem2: mainItem2 ?? null,
          rowPrice: computeRowPrice(merged, soupItem ?? null, mainItem ?? null, mainItem2 ?? null, defaultSoupPrice, defaultMealPrice, extrasPrices),
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

  const isPastCutoff = (() => {
    const [h, m] = cutoffTime.split(":").map(Number);
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
    return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
  })();

  const handleSend = () => {
    if (isSent) return;
    setSendError(null);
    startTransition(async () => {
      try {
        await actionSendOrder(orderId, extraEmail);
        setOrderStatus("sent");
        setSentAt(new Date().toISOString());
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : "Odeslání se nezdařilo. Zkuste to znovu."
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
  const dayStr =
    today.toLocaleDateString("cs-CZ", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase()) +
    " " +
    today.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

  const allSoups = initialData.todayMenu.soups;
  const allMeals = initialData.todayMenu.meals;

  return (
    <div className="v2-shell">
      <AppTopBar />

      {/* ── Info strip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span className="v2-fact">
            <IconCalendar />
            <span>{dayStr}</span>
          </span>
          {!isSent && !isPastCutoff && (
            <span className="v2-fact">
              <IconClock />
              <span>
                Uzávěrka dnes v{" "}
                <strong className="v2-accent">{cutoffTime}</strong>
              </span>
            </span>
          )}
          {!isSent && isPastCutoff && (
            <span className="v2-fact" style={{ color: "var(--v2-orange)" }}>
              <IconClock />
              <span>Po uzávěrce – objednávka ještě nebyla odeslána</span>
            </span>
          )}
        </div>
        {!isSent && (
          <div className="v2-infostrip__send">
            <input
              className="v2-email-input"
              defaultValue={extraEmail}
              disabled={isSent}
              onBlur={handleEmailBlur}
              onChange={(e) => setExtraEmail(e.target.value)}
              placeholder="Další e-mail (volitelné)"
              type="email"
            />
            <button
              className="v2-send-btn"
              disabled={isSent || isPending}
              onClick={handleSend}
              type="button"
            >
              {isPending ? "Odesílám…" : "Odeslat"}
            </button>
          </div>
        )}
        {sendError && <p className="v2-send-error">{sendError}</p>}
      </div>

      {/* ── Alerts ── */}
      {menuEmpty && !isSent && (
        <div className="v2-alert v2-alert--warn">
          <strong>Jídelníček není naplněný.</strong>{" "}
          Přejděte do{" "}
          <a href="/jidelnicek" style={{ textDecoration: "underline" }}>Jídelníčku</a>
          {" "}a importujte PDF nebo přidejte položky ručně.
        </div>
      )}

      {/* ── Main content ── */}
      <main className="v2-content">
        {DEPARTMENTS.map((dept) => {
          const deptData = departments.find((d) => d.name === dept)!;
          return (
            <DepartmentPanel
              data={deptData}
              defaultMealPrice={defaultMealPrice}
              defaultSoupPrice={defaultSoupPrice}
              extrasPrices={extrasPrices}
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

        {/* ── Bottom status bar ── */}
        <div className={`v2-statusbar${isSent ? " v2-statusbar--sent" : ""}`}>
          {isSent ? (
            <>
              <span className="v2-statusbar__icon v2-statusbar__icon--green"><IconCheck /></span>
              <div>
                <strong>Objednávka byla odeslána.</strong>
                {sentAt && (
                  <span>
                    {" "}v{" "}
                    {new Date(sentAt).toLocaleTimeString("cs-CZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                <span> Další úpravy nejsou možné.</span>
              </div>
            </>
          ) : (
            <>
              <span className="v2-statusbar__icon"><IconLock /></span>
              <div>
                <strong>Uzávěrka proběhne v {cutoffTime}.</strong>
                <span> Objednávku po uzávěrce odešle správce.</span>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
