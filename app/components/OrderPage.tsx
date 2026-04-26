"use client";

import { useState, useTransition, useCallback, useEffect, useRef, useMemo } from "react";
import type { OrderData, OrderRowEnriched, Department, DepartmentData, MealEntry } from "@/lib/types";
import { computeRowPrice, EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { DepartmentPanel } from "./DepartmentPanel";
import AppTopBar from "./AppTopBar";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import {
  actionAddRow,
  actionUpdateRow,
  actionDeleteRow,
  actionSendOrder,
  actionUpdateExtraEmail,
  actionClearOrder,
  actionReopenOrder,
} from "@/app/actions";

// ── Inline SVG icons ──────────────────────────────────────

const IconCalendar = () => <MIcon name="calendar_today" size={14} />;
const IconClock    = () => <MIcon name="schedule" size={14} />;
const IconInfo     = () => <MIcon name="info" size={14} />;
const IconLock     = () => <MIcon name="lock" size={16} fill />;
const IconCheck    = () => <MIcon name="check_circle" size={16} fill />;

// ── Helpers ───────────────────────────────────────────────

function getPragueNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
}

function parseCutoffMinutes(cutoffTime: string) {
  const [h, m] = cutoffTime.split(":").map(Number);
  return h * 60 + m;
}

function recalcDepartments(departments: DepartmentData[]): DepartmentData[] {
  return departments.map((d) => ({
    ...d,
    subtotal: d.rows.filter(hasOrderRowContent).reduce((s, r) => s + r.rowPrice, 0),
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
  const departmentsRef = useRef(initialData.departments);
  useEffect(() => { departmentsRef.current = departments; }, [departments]);

  const [orderStatus, setOrderStatus] = useState(initialData.order.status);
  const orderId = initialData.order.id;
  const [extraEmail, setExtraEmail] = useState(initialData.order.extraEmail ?? "");
  const [sentAt, setSentAt] = useState(initialData.order.sentAt);
  const [isPending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const justSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  type PendingDelete = { rowId: number; rowData: OrderRowEnriched; deptName: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSent = orderStatus === "sent";

  // ── Live cutoff check ─────────────────────────────────────
  const checkCutoff = useCallback(() => {
    const now = getPragueNow();
    return now.getHours() * 60 + now.getMinutes() >= parseCutoffMinutes(cutoffTime);
  }, [cutoffTime]);

  const [isPastCutoff, setIsPastCutoff] = useState(checkCutoff);

  useEffect(() => {
    const id = setInterval(() => setIsPastCutoff(checkCutoff()), 30_000);
    return () => clearInterval(id);
  }, [checkCutoff]);

  // ── Real-time sync via SSE ────────────────────────────────
  const [sseConnected, setSseConnected] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const isPendingRef = useRef(isPending);
  useEffect(() => { isPendingRef.current = isPending; }, [isPending]);

  const tabNotifCount = useRef(0);
  const originalTitle = useRef<string>("");

  useEffect(() => {
    originalTitle.current = document.title;
    const resetTitle = () => {
      if (tabNotifCount.current > 0) {
        tabNotifCount.current = 0;
        document.title = originalTitle.current;
      }
    };
    const onVisibility = () => { if (!document.hidden) resetTitle(); };
    window.addEventListener("focus", resetTitle);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", resetTitle);
      document.removeEventListener("visibilitychange", onVisibility);
      document.title = originalTitle.current;
    };
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/sse");
    es.addEventListener("open", () => { setSseConnected(true); setHasEverConnected(true); });
    es.addEventListener("error", () => setSseConnected(false));
    es.addEventListener("change", () => {
      setSseConnected(true);
      if (document.hidden) {
        tabNotifCount.current += 1;
        document.title = `(${tabNotifCount.current}) Nová objednávka`;
        return;
      }
      if (isPendingRef.current) return;
      fetch("/api/order-refresh")
        .then((r) => r.ok ? r.json() : null)
        .then((data: { departments: DepartmentData[]; totalPrice: number; status: string; sentAt: string | null } | null) => {
          if (!data) return;
          setDepartments(data.departments);
          setOrderStatus(data.status as "draft" | "sent");
          if (data.sentAt) setSentAt(data.sentAt);
        })
        .catch(() => {});
    });
    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddRow = useCallback(
    async (department: Department): Promise<number> => {
      try {
        const newRow = await actionAddRow(orderId, department);
        setDepartments((prev) =>
          recalcDepartments(
            prev.map((d) =>
              d.name === department ? { ...d, rows: [...d.rows, newRow] } : d
            )
          )
        );
        return newRow.id;
      } catch {
        setSendError("Nepodařilo se přidat řádek. Zkuste to znovu.");
        throw new Error("add failed");
      }
    },
    [orderId]
  );

  const handleUpdateRow = useCallback(
    (
      rowId: number,
      updates: Partial<{
        personName: string;
        soupItemId: number | null;
        soupItemId2: number | null;
        mainItemId: number | null;
        mealCount: number;
        extraMeals: MealEntry[];
        rollCount: number;
        breadDumplingCount: number;
        potatoDumplingCount: number;
        ketchupCount: number;
        tatarkaCount: number;
        bbqCount: number;
        note: string;
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
        const soupItem2 =
          "soupItemId2" in updates
            ? initialData.todayMenu.soups.find((s) => s.id === updates.soupItemId2) ?? null
            : row.soupItem2;
        const mainItem =
          "mainItemId" in updates
            ? initialData.todayMenu.meals.find((m) => m.id === updates.mainItemId) ?? null
            : row.mainItem;
        const extraMealItems =
          "extraMeals" in updates
            ? (updates.extraMeals ?? [])
                .map((e) => ({ item: initialData.todayMenu.meals.find((m) => m.id === e.itemId) ?? null, count: e.count }))
                .filter((e): e is { item: NonNullable<typeof e.item>; count: number } => e.item != null)
            : row.extraMealItems;
        const optimistic: OrderRowEnriched = {
          ...merged,
          soupItem: soupItem ?? null,
          soupItem2: soupItem2 ?? null,
          mainItem: mainItem ?? null,
          extraMealItems,
          rowPrice: computeRowPrice(merged, soupItem ?? null, soupItem2 ?? null, mainItem ?? null, extraMealItems, defaultSoupPrice, defaultMealPrice, extrasPrices),
        };
        return patchRow(prev, rowId, optimistic);
      });
      startTransition(async () => {
        try {
          const updated = await actionUpdateRow(rowId, updates);
          setDepartments((prev) => patchRow(prev, rowId, updated));
        } catch {
          setSendError("Nepodařilo se uložit změny. Zkuste to znovu.");
          // Rollback: refetch by reverting to server-confirmed state via re-render
          setDepartments((prev) => recalcDepartments([...prev]));
        }
      });
    },
    [initialData.todayMenu]
  );

  const handleClear = useCallback(() => {
    startTransition(async () => {
      await actionClearOrder(orderId);
      setDepartments((prev) =>
        recalcDepartments(prev.map((d) => ({ ...d, rows: [] })))
      );
      setClearConfirm(false);
    });
  }, [orderId]);

  const handleReopen = useCallback(() => {
    startTransition(async () => {
      await actionReopenOrder(orderId);
      setOrderStatus("draft");
      setSentAt(null);
    });
  }, [orderId]);

  const commitDelete = useCallback((rowId: number) => {
    actionDeleteRow(rowId).catch(() => {});
    setPendingDelete(null);
    pendingDeleteRef.current = null;
    pendingDeleteTimer.current = null;
  }, []);

  const handleDeleteRow = useCallback((rowId: number) => {
    if (pendingDeleteTimer.current && pendingDeleteRef.current) {
      clearTimeout(pendingDeleteTimer.current);
      commitDelete(pendingDeleteRef.current.rowId);
    }

    // Find and capture row data before removing from UI
    const dept = departmentsRef.current.find((d) => d.rows.some((r) => r.id === rowId));
    const rowData = dept?.rows.find((r) => r.id === rowId);

    // Optimistic remove
    setDepartments((prev) =>
      recalcDepartments(prev.map((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== rowId) })))
    );

    if (!rowData || !dept) {
      actionDeleteRow(rowId).catch(() => {});
      return;
    }

    const info: PendingDelete = { rowId, rowData, deptName: dept.name };
    pendingDeleteRef.current = info;
    setPendingDelete(info);
    pendingDeleteTimer.current = setTimeout(() => commitDelete(rowId), 5000);
  }, [commitDelete]);

  const handleUndoDelete = useCallback(() => {
    if (!pendingDeleteTimer.current || !pendingDeleteRef.current) return;
    clearTimeout(pendingDeleteTimer.current);
    pendingDeleteTimer.current = null;
    const { deptName, rowData } = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    setDepartments((prev) =>
      recalcDepartments(
        prev.map((d) => d.name === deptName ? { ...d, rows: [...d.rows, rowData] } : d)
      )
    );
    setPendingDelete(null);
  }, []);

  const handleSend = () => {
    if (isSent) return;
    setSendError(null);
    startTransition(async () => {
      try {
        await actionSendOrder(orderId, extraEmail);
        setOrderStatus("sent");
        setSentAt(new Date().toISOString());
        setJustSent(true);
        if (justSentTimer.current) clearTimeout(justSentTimer.current);
        justSentTimer.current = setTimeout(() => setJustSent(false), 2800);
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : "Odeslání se nezdařilo. Zkuste to znovu."
        );
      }
    });
  };

  const handleEmailBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    startTransition(async () => {
      await actionUpdateExtraEmail(orderId, e.target.value);
    });
  }, [orderId]);

  const activeOrderCount = useMemo(
    () => departments.flatMap((d) => d.rows).filter(hasOrderRowContent).length,
    [departments]
  );
  const totalPrice = useMemo(
    () => departments.reduce((s, d) => s + d.subtotal, 0),
    [departments]
  );

  const getCountdown = useCallback((): string | null => {
    const now = getPragueNow();
    const diff = parseCutoffMinutes(cutoffTime) - (now.getHours() * 60 + now.getMinutes());
    if (diff <= 0) return null;
    if (diff < 60) return `za ${diff} min`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `za ${hours} h ${mins} min` : `za ${hours} h`;
  }, [cutoffTime]);
  const [countdown, setCountdown] = useState(getCountdown);
  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoffTime]);

  const dayStr = useMemo(() => {
    const today = new Date();
    return (
      today.toLocaleDateString("cs-CZ", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase()) +
      " " +
      today.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })
    );
  }, []);

  const allSoups = initialData.todayMenu.soups;
  const allMeals = initialData.todayMenu.meals;

  useEffect(() => {
    return () => {
      if (justSentTimer.current) clearTimeout(justSentTimer.current);
      if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    };
  }, []);

  const showOfflineBanner = hasEverConnected && !sseConnected;

  return (
    <div className="v2-shell">
      <AppTopBar />
      {justSent && (
        <div aria-live="polite" className="v2-sent-toast" role="status">
          <div className="v2-sent-toast__inner">
            <IconCheck />
            <span>Objednávka odeslána!</span>
          </div>
        </div>
      )}
      {pendingDelete && (
        <div aria-live="polite" className="v2-undo-toast" role="status">
          <span>Řádek smazán</span>
          <button className="v2-undo-toast__btn" onClick={handleUndoDelete} type="button">
            Zpět
          </button>
        </div>
      )}
      {showOfflineBanner && (
        <div aria-live="assertive" className="v2-offline-banner" role="alert">
          <MIcon name="wifi_off" size={14} />
          <span>Odpojeno – živé aktualizace nefungují. Zkontrolujte připojení.</span>
        </div>
      )}

      {/* ── Info strip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span className="v2-fact">
            <IconCalendar />
            <span>{dayStr}</span>
            <span
              className={`sse-dot${sseConnected ? " sse-dot--on" : ""}`}
              title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
            />
          </span>
          {!isSent && !isPastCutoff && countdown && (
            <span className="v2-fact">
              <IconClock />
              <span>
                Uzávěrka {countdown} ({cutoffTime})
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
              onClick={() => setShowSendConfirm(true)}
              type="button"
            >
              {isPending ? "Odesílám…" : "Odeslat"}
            </button>
            {showSendConfirm && (
              <ConfirmModal
                confirmLabel="Odeslat"
                confirmVariant="primary"
                isPending={isPending}
                onClose={() => setShowSendConfirm(false)}
                onConfirm={() => { setShowSendConfirm(false); handleSend(); }}
                title="Odeslat objednávku"
              >
                <div className="send-summary">
                  <div className="send-summary__item">
                    <span className="send-summary__value">{activeOrderCount}</span>
                    <span className="send-summary__label">objednávek</span>
                  </div>
                  <div className="send-summary__item">
                    <span className="send-summary__value">{totalPrice} Kč</span>
                    <span className="send-summary__label">celkem</span>
                  </div>
                </div>
              </ConfirmModal>
            )}
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
        <div className="v2-dept-grid">
          {departments.map((dept) => (
            <DepartmentPanel
              data={dept}
              defaultMealPrice={defaultMealPrice}
              defaultSoupPrice={defaultSoupPrice}
              extrasPrices={extrasPrices}
              isSent={isSent}
              key={dept.name}
              meals={allMeals}
              onAddRow={() => handleAddRow(dept.name)}
              onDeleteRow={handleDeleteRow}
              onUpdateRow={handleUpdateRow}
              soups={allSoups}
            />
          ))}
        </div>

        {/* ── Bottom status bar ── */}
        <div className={`v2-statusbar${isSent ? " v2-statusbar--sent" : ""}`}>
          {isSent ? (
            <>
              <span className="v2-statusbar__icon v2-statusbar__icon--green"><IconCheck /></span>
              <div style={{ flex: 1 }}>
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
              <button
                className="v2-btn v2-btn--secondary"
                disabled={isPending}
                onClick={handleReopen}
                style={{ marginLeft: "auto", flexShrink: 0 }}
                type="button"
              >
                {isPending ? "…" : "Znovu otevřít"}
              </button>
            </>
          ) : (
            <>
              <span className="v2-statusbar__icon"><IconLock /></span>
              <div style={{ flex: 1 }}>
                <strong>Uzávěrka proběhne v {cutoffTime}.</strong>
                <span> Objednávku po uzávěrce odešle správce.</span>
              </div>
              <button
                className="v2-btn v2-btn--ghost"
                onClick={() => setClearConfirm(true)}
                style={{ marginLeft: "auto", flexShrink: 0 }}
                type="button"
              >
                Smazat objednávku
              </button>
              {clearConfirm && (
                <ConfirmModal
                  confirmLabel="Smazat"
                  isPending={isPending}
                  message="Celá dnešní objednávka bude vymazána. Tuto akci nelze vrátit."
                  onClose={() => setClearConfirm(false)}
                  onConfirm={handleClear}
                  title="Smazat objednávku"
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
