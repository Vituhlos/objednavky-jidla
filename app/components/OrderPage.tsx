"use client";

import { useState, useTransition, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getHolidayEmoji } from "@/lib/holidays";
import type { OrderData, OrderRowEnriched, Department, DepartmentData, MealEntry } from "@/lib/types";
import { computeRowPrice, EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { DepartmentPanel } from "./DepartmentPanel";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import {
  actionAddRow,
  actionUpdateRow,
  actionDeleteRow,
  actionSendOrder,
  actionClearOrder,
  actionReopenOrder,
} from "@/app/actions";

// ── Helpers ───────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDayLabel(date: string, todayDate: string): string {
  if (date === todayDate) return "Dnes";
  if (date === addDays(todayDate, 1)) return "Zítra";
  const [y, m, d] = date.split("-").map(Number);
  const obj = new Date(y, m - 1, d);
  const wd = obj.toLocaleDateString("cs-CZ", { weekday: "short" });
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d}.${m}.`;
}

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
  availableDates,
  selectedDate,
  todayDate,
  holidayName,
  holidayDescription,
}: {
  initialData: OrderData;
  cutoffTime?: string;
  menuEmpty?: boolean;
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
  availableDates?: string[];
  selectedDate?: string;
  todayDate?: string;
  holidayName?: string | null;
  holidayDescription?: string | null;
}) {
  const router = useRouter();
  const isFutureDay = !!(selectedDate && todayDate && selectedDate > todayDate);
  const showDayPicker = !!(availableDates && availableDates.length > 1 && todayDate);

  const [departments, setDepartments] = useState(initialData.departments);
  const departmentsRef = useRef(initialData.departments);
  useEffect(() => { departmentsRef.current = departments; }, [departments]);

  const [orderStatus, setOrderStatus] = useState(initialData.order.status);
  const orderId = initialData.order.id;
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

  // Sync state when selected date changes — component isn't remounted, only gets new props
  const prevOrderIdRef = useRef(initialData.order.id);
  if (prevOrderIdRef.current !== initialData.order.id) {
    prevOrderIdRef.current = initialData.order.id;
    setDepartments(initialData.departments);
    departmentsRef.current = initialData.departments;
    setOrderStatus(initialData.order.status);
    setSentAt(initialData.order.sentAt);
    setJustSent(false);
    setSendError(null);
    setPendingDelete(null);
  }

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
  const isFutureDayRef = useRef(isFutureDay);
  useEffect(() => { isFutureDayRef.current = isFutureDay; }, [isFutureDay]);
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

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
      if (isFutureDayRef.current) return;
      const params = new URLSearchParams();
      if (selectedDateRef.current) params.set("date", selectedDateRef.current);
      const refreshUrl = params.size > 0 ? `/api/order-refresh?${params.toString()}` : "/api/order-refresh";
      fetch(refreshUrl)
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
          router.refresh();
        }
      });
    },
    [defaultMealPrice, defaultSoupPrice, extrasPrices, initialData.todayMenu, router]
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
        await actionSendOrder(orderId);
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

  const activeOrderCount = useMemo(
    () => departments.flatMap((d) => d.rows).filter(hasOrderRowContent).length,
    [departments]
  );
  const existingNames = useMemo(
    () => departments.flatMap((d) => d.rows).filter(hasOrderRowContent).map((r) => r.personName.trim()).filter(Boolean),
    [departments]
  );
  const totalPrice = useMemo(
    () => departments.reduce((s, d) => s + d.subtotal, 0),
    [departments]
  );

  const getCountdownInfo = useCallback((): { label: string; mins: number } | null => {
    const now = getPragueNow();
    const diff = parseCutoffMinutes(cutoffTime) - (now.getHours() * 60 + now.getMinutes());
    if (diff <= 0) return null;
    if (diff < 60) return { label: `za ${diff} min`, mins: diff };
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return { label: mins > 0 ? `za ${hours} h ${mins} min` : `za ${hours} h`, mins: diff };
  }, [cutoffTime]);
  const [countdownInfo, setCountdownInfo] = useState(getCountdownInfo);
  const countdown = countdownInfo?.label ?? null;
  const countdownMins = countdownInfo?.mins ?? null;
  useEffect(() => {
    const id = setInterval(() => setCountdownInfo(getCountdownInfo()), 30_000);
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

  const allSoups = initialData.todayMenu.soups.filter((i) => i.name !== "Zavřeno");
  const allMeals = initialData.todayMenu.meals.filter((i) => i.name !== "Zavřeno");
  const noMenu = allSoups.length === 0 && allMeals.length === 0;

  const formattedClosedDate = selectedDate
    ? new Date(`${selectedDate}T12:00:00`)
        .toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        .replace(/^\w/, (c) => c.toUpperCase())
    : null;
  const holidayEmoji = getHolidayEmoji(holidayName ?? null);

  useEffect(() => {
    return () => {
      if (justSentTimer.current) clearTimeout(justSentTimer.current);
      if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    };
  }, []);

  const showOfflineBanner = hasEverConnected && !sseConnected;

  return (
    <div className="k-shell">

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
            <span className={`inline-flex items-center gap-1 font-medium ${countdownMins !== null && countdownMins <= 10 ? "text-red-500" : countdownMins !== null && countdownMins <= 30 ? "text-orange-500" : "text-stone-500"}`}>
              <MIcon name="schedule" size={13} /> Uzávěrka {countdown} ({cutoffTime})
            </span>
          )}
          {!isSent && isPastCutoff && (
            <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
              <MIcon name="schedule" size={13} /> Po uzávěrce ({cutoffTime})
            </span>
          )}
          {isSent && sentAt && (
            <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
              <MIcon name="check_circle" size={13} fill /> Odesláno v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        {activeOrderCount > 0 && (
          <span className="text-[12px] text-stone-500 shrink-0">
            {activeOrderCount} {activeOrderCount === 1 ? "objednávka" : activeOrderCount < 5 ? "objednávky" : "objednávek"} · {totalPrice} Kč
          </span>
        )}
        {!isSent && !isFutureDay && !noMenu && (
          <div className="flex items-center gap-2 shrink-0">
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
        {isFutureDay && !isSent && !noMenu && (
          <span className="text-[11.5px] text-stone-500 inline-flex items-center gap-1.5 shrink-0">
            <MIcon name="schedule" size={13} />
            Odešle se automaticky v den samotný
          </span>
        )}
        {sendError && <span className="text-[11.5px] text-red-600">{sendError}</span>}
      </div>

      {/* ── Mobile info strip ── */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5 flex items-center gap-2.5">
        <MIcon name="calendar_today" size={13} style={{ color: "#D97706" }} />
        <span className="text-[12.5px] font-medium text-stone-700 truncate">{dayStr}</span>
        {activeOrderCount > 0 && (
          <span className="text-[11px] text-stone-500 shrink-0">
            {activeOrderCount} · {totalPrice} Kč
          </span>
        )}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
          title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
        />
        {!isSent && !isPastCutoff && countdown && (
          <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium shrink-0 ${countdownMins !== null && countdownMins <= 10 ? "text-red-500" : countdownMins !== null && countdownMins <= 30 ? "text-orange-500" : "text-stone-500"}`}>
            <MIcon name="schedule" size={12} /> {countdown}
          </span>
        )}
        {!isSent && isPastCutoff && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-orange-600 shrink-0">
            <MIcon name="schedule" size={12} /> Po uzávěrce
          </span>
        )}
        {isSent && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-green-700 font-semibold shrink-0">
            <MIcon name="check_circle" size={12} fill /> Odesláno
          </span>
        )}
        {!isSent && !isFutureDay && !noMenu && (
          <button
            className="shrink-0 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-50 active:scale-[0.97] transition"
            disabled={isPending}
            onClick={() => setShowSendConfirm(true)}
            style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
            type="button"
          >
            {isPending ? "…" : "Odeslat"}
          </button>
        )}
        {isFutureDay && !isSent && !noMenu && (
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 shrink-0">
            <MIcon name="schedule" size={12} />
            Auto
          </span>
        )}
      </div>

      {/* ── Scrollable main content ── */}
      <main className="flex-1 overflow-y-auto scroll-area p-4">
        <div className="flex flex-col gap-4 pb-20">

          {showDayPicker && (
            <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
              <div
                className="flex p-1 rounded-2xl gap-0.5"
                style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
              >
                {availableDates!.map((date) => {
                  const isActive = date === selectedDate;
                  return (
                    <button
                      key={date}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.96] ${
                        isActive ? "" : "text-stone-500 hover:text-stone-700 hover:bg-white/60"
                      }`}
                      onClick={() => router.push(`/?date=${date}`)}
                      style={isActive ? {
                        background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                        color: "white",
                        boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)",
                      } : {}}
                      type="button"
                    >
                      {getDayLabel(date, todayDate!)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {noMenu ? (
            /* ── Closed / no-menu banner ── */
            <div className="glass rounded-3xl overflow-hidden" style={{ borderColor: holidayName ? "rgba(245,158,11,0.22)" : "rgba(26,18,8,0.08)" }}>
              <div className="flex flex-col items-center text-center px-6 py-8 md:py-10 gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={holidayName
                    ? { background: "linear-gradient(135deg,#fbbf24,#d97706)", boxShadow: "0 8px 24px -6px rgba(245,158,11,0.45)" }
                    : { background: "rgba(148,163,184,0.18)", border: "1px solid rgba(148,163,184,0.25)" }
                  }
                >
                  {holidayName ? (
                    <span className="text-[28px] leading-none">{holidayEmoji}</span>
                  ) : (
                    <MIcon name="no_meals" size={28} fill style={{ color: "#94a3b8" }} />
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="font-display font-bold text-[20px] text-stone-900 leading-tight">
                    {holidayName ?? "Jídelníček není k dispozici"}
                  </div>
                  {formattedClosedDate && (
                    <div className="text-[13px] text-stone-500">{formattedClosedDate}</div>
                  )}
                </div>
                {holidayDescription && (
                  <p className="text-[13px] text-stone-500 leading-relaxed max-w-sm">
                    {holidayDescription}
                  </p>
                )}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium text-stone-500 mt-1"
                  style={{ background: "rgba(255,255,255,0.58)", border: "1px solid rgba(26,18,8,0.08)" }}
                >
                  <MIcon name="info" size={13} style={{ color: "#D97706" }} />
                  <span>{holidayName ? "V tento den se objednávky nevytvářejí." : "Jakmile bude menu doplněné, objednávky se tu znovu objeví."}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                    existingNames={existingNames}
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
                  ) : isFutureDay ? (
                    <>
                      <strong>Objednávka dopředu.</strong>
                      <span className="text-stone-500"> Odešle se automaticky v den samotný v {cutoffTime}.</span>
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
              </div>
            </>
          )}
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
