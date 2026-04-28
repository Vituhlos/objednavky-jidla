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
    <div className="k-shell">
      <AppTopBar />

      {/* ── Toasts & banners (fixed/absolute) ── */}
      {justSent && (
        <div aria-live="polite" role="status" className="fixed top-16 left-1/2 -translate-x-1/2 z-[300] fade-up pointer-events-none">
          <div className="glass rounded-full px-5 py-2.5 flex items-center gap-2 shadow-lg">
            <MIcon name="check_circle" size={16} fill style={{ color: "#16a34a" }} />
            <span className="font-display font-semibold text-[13px] text-stone-900">Objednávka odeslána!</span>
          </div>
        </div>
      )}
      {pendingDelete && (
        <div aria-live="polite" role="status" className="k-toast">
          <span>Řádek smazán</span>
          <button className="k-toast__undo" onClick={handleUndoDelete} type="button">Zpět</button>
        </div>
      )}
      {showOfflineBanner && (
        <div aria-live="assertive" role="alert" className="k-offline">
          <MIcon name="wifi_off" size={14} />
          <span>Odpojeno – živé aktualizace nefungují.</span>
        </div>
      )}

      {/* ── Desktop info strip ── */}
      <div className="hidden md:flex px-5 py-2 border-b border-white/50 items-center gap-4 topbar shrink-0">
        <div className="flex items-center gap-3 flex-1 text-[12px] text-stone-600">
          <span className="inline-flex items-center gap-1.5">
            <MIcon name="calendar_today" size={13} style={{ color: "#D97706" }} />
            <span className="font-medium">{dayStr}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
              title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
            />
          </span>
          {!isSent && !isPastCutoff && countdown && (
            <span className="inline-flex items-center gap-1 text-stone-500">
              <MIcon name="schedule" size={13} /> Uzávěrka {countdown} ({cutoffTime})
            </span>
          )}
          {!isSent && isPastCutoff && (
            <span className="inline-flex items-center gap-1 text-orange-600">
              <MIcon name="schedule" size={13} /> Po uzávěrce
            </span>
          )}
          {isSent && sentAt && (
            <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
              <MIcon name="check_circle" size={13} fill /> Odesláno v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        {!isSent && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              className="text-[12px] px-3 py-1.5 rounded-xl glass-soft outline-none placeholder:text-stone-400 w-[180px]"
              defaultValue={extraEmail}
              onBlur={handleEmailBlur}
              onChange={(e) => setExtraEmail(e.target.value)}
              placeholder="Další e-mail (volitelné)"
              type="email"
            />
            <button
              className="px-4 py-1.5 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
              disabled={isPending}
              onClick={() => setShowSendConfirm(true)}
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
              type="button"
            >
              {isPending ? "Odesílám…" : "Odeslat"}
            </button>
          </div>
        )}
        {isSent && (
          <button
            className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full glass-btn text-stone-600"
            disabled={isPending}
            onClick={handleReopen}
            type="button"
          >
            {isPending ? "…" : "Znovu otevřít"}
          </button>
        )}
        {sendError && <span className="text-[11.5px] text-red-600">{sendError}</span>}
      </div>

      {/* ── Mobile info strip ── */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="px-4 py-2 flex items-center gap-2 text-[11.5px] text-stone-600 flex-wrap">
          <MIcon name="calendar_today" size={12} style={{ color: "#D97706" }} />
          <span className="flex-1">{dayStr}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
            title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
          />
          {!isSent && !isPastCutoff && countdown && (
            <span className="inline-flex items-center gap-1 text-stone-500">
              <MIcon name="schedule" size={12} /> {cutoffTime}
            </span>
          )}
          {isSent && (
            <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
              <MIcon name="check_circle" size={12} fill /> Odesláno
            </span>
          )}
        </div>
        {!isSent && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <input
              className="flex-1 text-[12px] px-3 py-1.5 rounded-xl glass-soft outline-none placeholder:text-stone-400 min-w-0"
              defaultValue={extraEmail}
              onBlur={handleEmailBlur}
              onChange={(e) => setExtraEmail(e.target.value)}
              placeholder="Další e-mail (volitelné)"
              type="email"
            />
            <button
              className="shrink-0 px-4 py-1.5 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
              disabled={isPending}
              onClick={() => setShowSendConfirm(true)}
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
              type="button"
            >
              {isPending ? "…" : "Odeslat"}
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable main content ── */}
      <main className="flex-1 overflow-y-auto scroll-area p-4">
        <div className="flex flex-col gap-4 pb-20">

          {menuEmpty && !isSent && (
            <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 text-[12.5px]"
              style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.07)" }}>
              <MIcon name="warning" size={16} style={{ color: "#D97706" }} />
              <span className="text-stone-700">
                <strong>Jídelníček není naplněný.</strong>{" "}
                Přejděte do{" "}
                <a href="/jidelnicek" className="underline text-stone-700 hover:text-stone-900">Jídelníčku</a>
                {" "}a importujte PDF nebo přidejte položky ručně.
              </span>
            </div>
          )}

          {/* Department panels — 3-col on desktop */}
          <div className="grid md:grid-cols-3 gap-4">
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

          {/* Bottom status bar */}
          <div
            className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
            style={isSent ? { borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.07)" } : {}}
          >
            <div
              className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0"
              style={{ background: isSent ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.1)" }}
            >
              <MIcon name={isSent ? "check_circle" : "lock"} size={18} fill style={{ color: isSent ? "#16a34a" : "#94a3b8" }} />
            </div>
            <div className="flex-1 text-[12.5px] text-stone-700 leading-snug">
              {isSent ? (
                <>
                  <strong className="text-green-700">Objednávka odeslána</strong>
                  {sentAt && <span> v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span>}
                  <span className="text-stone-500"> · Další úpravy nejsou možné.</span>
                </>
              ) : (
                <>
                  <strong>Uzávěrka v {cutoffTime}.</strong>
                  <span className="text-stone-500"> Objednávku po uzávěrce odešle správce.</span>
                </>
              )}
            </div>
            {!isSent && totalPrice > 0 && (
              <span className="font-display font-bold text-[14px] text-stone-800 shrink-0">{totalPrice} Kč</span>
            )}
            {!isSent && (
              <button
                className="shrink-0 text-[11.5px] font-medium px-3 py-1.5 rounded-full glass-btn text-stone-500"
                onClick={() => setClearConfirm(true)}
                type="button"
              >
                Smazat
              </button>
            )}
            {isSent && (
              <button
                className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full glass-btn text-stone-600"
                disabled={isPending}
                onClick={handleReopen}
                type="button"
              >
                {isPending ? "…" : "Znovu otevřít"}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
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
    </div>
  );
}
