"use client";

import { useState, useTransition, useCallback } from "react";
import type { OrderData, OrderRowEnriched, Department, DepartmentData } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import { computeRowPrice } from "@/lib/pricing";
import { DepartmentPanel } from "./DepartmentPanel";
import {
  actionAddRow,
  actionUpdateRow,
  actionDeleteRow,
  actionSendOrder,
  actionUpdateExtraEmail,
} from "@/app/actions";

// ── Inline SVG icons ──────────────────────────────────────

const IconOrders = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect height="4" rx="1" width="6" x="9" y="3"/>
    <path d="M9 12h6M9 16h4"/>
  </svg>
);

const IconPizza = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <path d="M12 2a10 10 0 0110 10"/>
    <path d="M2 12C2 6.48 6.48 2 12 2l-10 20 20-10z"/>
    <circle cx="12" cy="13" fill="currentColor" r="1"/>
  </svg>
);

const IconHistory = () => (
  <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);

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

function recalcDepartments(departments: DepartmentData[]): DepartmentData[] {
  return departments.map((d) => ({
    ...d,
    subtotal: d.rows.reduce((s, r) => s + r.rowPrice, 0),
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
}: {
  initialData: OrderData;
  cutoffTime?: string;
  menuEmpty?: boolean;
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
      {/* ── Top navigation bar ── */}
      <header className="v2-topbar">
        <div className="v2-topbar__brand">
          <div className="v2-topbar__logo">
            <svg fill="currentColor" height="20" viewBox="0 0 24 24" width="20">
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
          <span className="v2-topbar__title">Dnešní objednávka</span>
        </div>
        <nav className="v2-topbar__nav">
          <a className="v2-navlink v2-navlink--active" href="/">
            <IconOrders />
            <span>Objednávky</span>
          </a>
          <a className="v2-navlink" href="/pizza">
            <IconPizza />
            <span>Pizza</span>
          </a>
          <a className="v2-navlink" href="/historie">
            <IconHistory />
            <span>Historie</span>
          </a>
        </nav>
      </header>

      {/* ── Info strip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span className="v2-fact">
            <IconCalendar />
            <span>{dayStr}</span>
          </span>
          {!isSent && (
            <span className="v2-fact">
              <IconClock />
              <span>
                Objednávat můžete do{" "}
                <strong className="v2-accent">{cutoffTime}</strong>
              </span>
            </span>
          )}
          <span className="v2-fact">
            <IconInfo />
            <span>
              Uzávěrka objednávek dnes v{" "}
              <strong className="v2-accent">{cutoffTime}</strong>.
            </span>
          </span>
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
              disabled={isSent || isPending || isPastCutoff}
              onClick={handleSend}
              type="button"
            >
              {isPending ? "Odesílám…" : isPastCutoff ? "Po uzávěrce" : "Odeslat"}
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
