"use client";

import { useState, useTransition, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getHolidayEmoji } from "@/lib/holidays";
import type { OrderData, OrderRowEnriched, Department, DepartmentData, MealEntry } from "@/lib/types";
import { computeRowPrice, EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { usePushNotifications } from "./order/usePushNotifications";
import { useRowDeletion } from "./order/useRowDeletion";
import { useDayNavigation } from "./order/useDayNavigation";
import { useOrderSync } from "./order/useOrderSync";
import { useCutoff } from "./order/useCutoff";
import { useCutoffUnlock } from "./order/useCutoffUnlock";
import { DayPicker } from "./order/DayPicker";
import { DayStatusBar } from "./order/DayStatusBar";
import { HelpModal } from "./order/HelpModal";
import { OrderHeader } from "./order/OrderHeader";
import {
  addDays,
  buildPickerItems,
  dayOfWeek,
  daysBetween,
  formatClosureHeadline,
  formatDayPhrase,
  formatGapLabel,
  getDayLabel,
  getFutureDayPhrase,
  patchRow,
  recalcDepartments,
  shortDate,
  type ClosureRange,
  type PickerItem,
} from "./order/order-utils";
import type { ClosureContext } from "@/lib/menu";
import { DEFAULT_CLOSURE_ICON } from "@/lib/closure-icons";
import { DepartmentPanel } from "./DepartmentPanel";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import ClosureCard from "./ClosureCard";
import {
  actionAddRow,
  actionUpdateRow,
  actionDeleteRow,
  actionSendOrder,
  actionReopenOrder,
  actionUnlockCutoff,
  actionDismissAutoSendError,
} from "@/app/actions";

// ── Component ─────────────────────────────────────────────

export default function OrderPage({
  initialData,
  canEdit = true,
  canManage = true,
  orderableNames = null,
  cutoffTime = "08:00",
  menuEmpty = false,
  defaultSoupPrice = 30,
  defaultMealPrice = 110,
  extrasPrices = EXTRAS_PRICES_DEFAULT,
  availableDates,
  closedDates,
  closureRanges,
  activeClosure,
  upcomingClosure,
  selectedDate,
  todayDate,
  holidayName,
  holidayDescription,
  autoSendEnabled = false,
  autoSendTime = "08:00",
  autoSendError,
  autoSendErrorTs,
  forceOpenAt = "",
}: {
  initialData: OrderData;
  /** Může přihlášený zapisovat? Nepřihlášený čte, ale nemění (R1). */
  canEdit?: boolean;
  /** Správcovské úkony — odeslání objednávky, otevření dne. */
  canManage?: boolean;
  /**
   * Jména, za která smí přihlášený objednávat.
   *
   * `null` znamená volný text — správce zapisuje kohokoli, protože opravuje
   * i cizí objednávky. Pole znamená výběr: server porovnává přesnou shodu,
   * takže psané jméno by rozbil chybějící háček.
   */
  orderableNames?: string[] | null;
  cutoffTime?: string;
  menuEmpty?: boolean;
  defaultSoupPrice?: number;
  defaultMealPrice?: number;
  extrasPrices?: ExtrasPrices;
  availableDates?: string[];
  closedDates?: string[];
  closureRanges?: ClosureRange[];
  activeClosure?: ClosureContext | null;
  upcomingClosure?: { startDate: string; endDate: string; label: string; note: string; icon: string } | null;
  selectedDate?: string;
  todayDate?: string;
  holidayName?: string | null;
  holidayDescription?: string | null;
  autoSendEnabled?: boolean;
  autoSendTime?: string;
  autoSendError?: string;
  autoSendErrorTs?: string;
  forceOpenAt?: string;
}) {
  const router = useRouter();
  const isFutureDay = !!(selectedDate && todayDate && selectedDate > todayDate);

  const [departments, setDepartments] = useState(initialData.departments);
  const departmentsRef = useRef(initialData.departments);
  useEffect(() => { departmentsRef.current = departments; }, [departments]);

  const [orderStatus, setOrderStatus] = useState(initialData.order.status);
  const orderId = initialData.order.id;
  const orderIdRef = useRef(orderId);
  const [sentAt, setSentAt] = useState(initialData.order.sentAt);
  const [isPending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const justSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const {
    pickerItems,
    showDayPicker,
    daySwitchPending,
    goToDate,
    lastOrderableBeforeClosure,
    reopensAfterClosure,
  } = useDayNavigation({
    availableDates,
    closedDates,
    closureRanges,
    selectedDate,
    todayDate,
    upcomingClosure,
    startTransition,
  });

  const {
    pendingDelete,
    handleDeleteRow,
    handleUndoDelete,
    flushPendingDelete,
    clearPendingDelete,
  } = useRowDeletion({ departmentsRef, setDepartments });

  const {
    forceOpenAt: forceOpenValue,
    showUnlockModal,
    unlockPin,
    unlockError,
    isUnlocking,
    openUnlock,
    closeUnlock,
    changePin,
    handleUnlock,
  } = useCutoffUnlock(forceOpenAt);

  // Sync state when selected date changes — component isn't remounted, only gets new props
  const prevOrderIdRef = useRef(initialData.order.id);
  useEffect(() => {
    if (prevOrderIdRef.current === initialData.order.id) return;
    prevOrderIdRef.current = initialData.order.id;
    orderIdRef.current = initialData.order.id;
    setDepartments(initialData.departments);
    departmentsRef.current = initialData.departments;
    setOrderStatus(initialData.order.status);
    setSentAt(initialData.order.sentAt);
    setJustSent(false);
    setSendError(null);
    if (justSentTimer.current) { clearTimeout(justSentTimer.current); justSentTimer.current = null; }
    flushPendingDelete();
    clearPendingDelete();
  }, [clearPendingDelete, flushPendingDelete, initialData.departments, initialData.order.id, initialData.order.sentAt, initialData.order.status]);

  const isSent = orderStatus === "sent";
  // ── Live cutoff check ─────────────────────────────────────
  const { isPastCutoff, isForceOpen, countdown, countdownMins } = useCutoff({
    cutoffTime,
    forceOpenAt: forceOpenValue,
    isFutureDay,
  });

  const isCutoffLocked = isPastCutoff && !isForceOpen && !isFutureDay;
  const isOrderLocked = isSent || isCutoffLocked;

  const { pushState, handlePushToggle, getPushEndpoint } = usePushNotifications();

  // ── Real-time sync via SSE ────────────────────────────────
  const { sseConnected, hasEverConnected, doRefresh } = useOrderSync({
    isPending,
    isFutureDay,
    selectedDate,
    setDepartments,
    setOrderStatus,
    setSentAt,
  });

  const handleAddRow = useCallback(
    async (department: Department): Promise<number> => {
      try {
        const pushEndpoint = await getPushEndpoint();
        const newRow = await actionAddRow(orderId, department, pushEndpoint);
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
    [getPushEndpoint, orderId]
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
          const pushEndpoint = await getPushEndpoint();
          const updated = await actionUpdateRow(rowId, updates, pushEndpoint);
          setDepartments((prev) => patchRow(prev, rowId, updated));
        } catch {
          setSendError("Nepodařilo se uložit změny. Zkuste to znovu.");
          doRefresh();
        }
      });
    },
    [defaultMealPrice, defaultSoupPrice, extrasPrices, getPushEndpoint, initialData.todayMenu, doRefresh]
  );

  const handleReopen = useCallback(() => {
    startTransition(async () => {
      await actionReopenOrder(orderId);
      setOrderStatus("draft");
      setSentAt(null);
    });
  }, [orderId]);

  const handleSend = () => {
    if (isSent) return;
    setSendError(null);
    const sentForOrderId = orderId;
    startTransition(async () => {
      try {
        await actionSendOrder(orderId);
        if (orderIdRef.current !== sentForOrderId) return;
        setOrderStatus("sent");
        setSentAt(new Date().toISOString());
        setJustSent(true);
        if (justSentTimer.current) clearTimeout(justSentTimer.current);
        justSentTimer.current = setTimeout(() => setJustSent(false), 2800);
      } catch (error) {
        if (orderIdRef.current !== sentForOrderId) return;
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

  // ⚠️ Datum **vybraného** dne, ne dneška. Dřív se počítalo z `new Date()`,
  // takže při přepnutí na zítřek zůstalo v záhlaví dnešní datum — záložka
  // tvrdila jedno, nadpis druhé a člověk upravoval jiný den, než si myslel.
  const dayStr = useMemo(() => {
    // Poledne, ne půlnoc: o den se tak nezavadí ani při přechodu na letní čas.
    const day = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    return (
      // `\w` je jen ASCII, takže „čtvrtek“ a „úterý“ zůstávaly s malým písmenem.
      day.toLocaleDateString("cs-CZ", { weekday: "long" }).replace(/^./u, (c) => c.toLocaleUpperCase("cs-CZ")) +
      " " +
      day.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })
    );
  }, [selectedDate]);

  const futureDayPhrase = isFutureDay && selectedDate && todayDate
    ? getFutureDayPhrase(selectedDate, todayDate)
    : null;

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
      flushPendingDelete();
    };
  }, [flushPendingDelete]);

  const showOfflineBanner = hasEverConnected && !sseConnected;

  return (
    <div className="k-shell">

      {/* ── Auto-send failure banner ── */}
      {autoSendError && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ background: "rgba(220,38,38,0.08)", borderColor: "rgba(220,38,38,0.18)" }}>
          <MIcon name="error" size={16} fill style={{ color: "#dc2626", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <span className="text-[12.5px] font-semibold text-red-700">Auto-send selhal</span>
            {autoSendErrorTs && (
              <span className="text-[11.5px] text-red-500 ml-2">
                {new Date(autoSendErrorTs).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <p className="text-[11.5px] text-red-600 mt-0.5 truncate">{autoSendError}</p>
          </div>
          <button
            type="button"
            onClick={() => actionDismissAutoSendError()}
            className="shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-full glass-btn text-red-600"
          >
            Zavřít
          </button>
        </div>
      )}

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

      {/* ── Urgency countdown banner (< 30 min) ── */}
      {!isSent && !isPastCutoff && countdownMins !== null && countdownMins <= 30 && (
        <div
          aria-live="polite"
          role="status"
          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-[12.5px] font-semibold"
          style={countdownMins <= 10 ? {
            background: "rgba(220,38,38,0.09)",
            borderBottom: "1px solid rgba(220,38,38,0.18)",
            color: "#b91c1c",
          } : {
            background: "rgba(234,88,12,0.08)",
            borderBottom: "1px solid rgba(234,88,12,0.16)",
            color: "#c2410c",
          }}
        >
          <MIcon name="timer" size={15} className="shrink-0" />
          <span>
            {countdownMins <= 10
              ? `Zbývá jen ${countdownMins} min — objednávka se brzy uzavře!`
              : `Uzávěrka za ${countdownMins} min (${cutoffTime}) — nezapomeň objednat.`}
          </span>
        </div>
      )}

      <OrderHeader
        activeOrderCount={activeOrderCount}
        canManage={canManage}
        autoSendEnabled={autoSendEnabled}
        autoSendTime={autoSendTime}
        countdown={countdown}
        countdownMins={countdownMins}
        cutoffTime={cutoffTime}
        dayStr={dayStr}
        futureDayPhrase={futureDayPhrase}
        isForceOpen={isForceOpen}
        isFutureDay={isFutureDay}
        isPastCutoff={isPastCutoff}
        isPending={isPending}
        isSent={isSent}
        noMenu={noMenu}
        onEmptyOrder={() => setSendError("Objednávka je prázdná — nikdo nic neobjednal.")}
        onHelp={() => setShowHelp(true)}
        onPushToggle={handlePushToggle}
        onSend={() => { setSendError(null); setShowSendConfirm(true); }}
        pushState={pushState}
        sendError={sendError}
        sentAt={sentAt}
        sseConnected={sseConnected}
        totalPrice={totalPrice}
      />

      {/* ── Scrollable main content ── */}
      <main className="flex-1 overflow-y-auto scroll-area p-4">
        <div className="flex flex-col gap-4 pb-nav md:pb-6">

          {showDayPicker && (
            <DayPicker
              onSelect={goToDate}
              pickerItems={pickerItems}
              selectedDate={selectedDate}
              todayDate={todayDate}
            />
          )}


          {noMenu ? (
            activeClosure ? (
              /* A closure outranks a state holiday here even when both land on the
                 same day: "Dovolená do 7. 8." answers the question the reader
                 actually has, "Státní svátek" only answers today's. Same card as
                 the menu screen — one closure, one visual, both pages. */
              <ClosureCard closure={activeClosure} />
            ) : (
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
                      <span className="emoji text-[28px] leading-none">{holidayEmoji}</span>
                    ) : (
                      <MIcon name="event_busy" size={28} fill style={{ color: "#94a3b8" }} />
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
                    <span>
                      {holidayName
                        ? "V tento den se objednávky nevytvářejí."
                        : "Jakmile bude menu doplněné, objednávky se tu znovu objeví."}
                    </span>
                  </div>
                </div>
              </div>
            )
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
              <div className={`grid md:grid-cols-3 gap-4 transition-opacity duration-150 ${daySwitchPending ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                {departments.map((dept) => (
                  <DepartmentPanel
                    data={dept}
                    defaultMealPrice={defaultMealPrice}
                    defaultSoupPrice={defaultSoupPrice}
                    existingNames={existingNames}
                    extrasPrices={extrasPrices}
                    isSent={isOrderLocked || !canEdit}
                    lockNote={
                      !canEdit && !isOrderLocked ? (
                        <>
                          Objednávat můžete{" "}
                          <a className="underline font-semibold" href="/ucet/prihlaseni">
                            po přihlášení
                          </a>
                        </>
                      ) : undefined
                    }
                    key={dept.name}
                    meals={allMeals}
                    onAddRow={handleAddRow}
                    orderableNames={orderableNames}
                    onDeleteRow={handleDeleteRow}
                    onUpdateRow={handleUpdateRow}
                    soups={allSoups}
                  />
                ))}
              </div>

              {/* Bottom status bar */}
              <DayStatusBar
                autoSendEnabled={autoSendEnabled}
                autoSendTime={autoSendTime}
                cutoffTime={cutoffTime}
                futureDayPhrase={futureDayPhrase}
                isCutoffLocked={isCutoffLocked}
                isForceOpen={isForceOpen}
                isFutureDay={isFutureDay}
                isOrderLocked={isOrderLocked}
                isSent={isSent}
                onUnlock={openUnlock}
                sentAt={sentAt}
                totalPrice={totalPrice}
              />

              {upcomingClosure && (
                <div
                  /* Amber, not red: red means "something broke" everywhere else in
                     this app. A planned shutdown is "notice and plan", same class as
                     the cutoff bar. Sizing matches the status bar above it. */
                  className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3.5 mx-auto w-fit max-w-full"
                  style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.34)" }}
                >
                  <div
                    className="w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0"
                    style={{ background: "rgba(245,158,11,0.16)" }}
                  >
                    <span className="emoji text-[18px] leading-none">{upcomingClosure.icon}</span>
                  </div>
                  {/* Type scale 16 / 12 / 10.5+14 — three distinct roles instead of
                      four near-identical lines. The two dates are the only thing that
                      demands action, so they're the largest thing after the headline. */}
                  <div className="min-w-0">
                    <div className="font-display font-bold text-[16px] text-stone-900 leading-tight">
                      {formatClosureHeadline(upcomingClosure.startDate, upcomingClosure.endDate, todayDate!)}
                    </div>
                    <div className="text-[12px] text-stone-500 leading-snug mt-0.5 tabular-nums">
                      {upcomingClosure.label || "Dovolená"}
                      {" · "}
                      {formatGapLabel(upcomingClosure.startDate, upcomingClosure.endDate)}
                    </div>

                    {(lastOrderableBeforeClosure || reopensAfterClosure) && (
                      <div
                        className="flex flex-wrap gap-x-7 gap-y-2 mt-3 pt-3"
                        style={{ borderTop: "1px solid rgba(245,158,11,0.22)" }}
                      >
                        {lastOrderableBeforeClosure && (
                          <div>
                            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-400 leading-none">
                              Poslední oběd
                            </div>
                            <div className="text-[14px] font-semibold text-stone-800 leading-tight mt-1 tabular-nums">
                              {formatDayPhrase(lastOrderableBeforeClosure, false)}
                            </div>
                          </div>
                        )}
                        {reopensAfterClosure && (
                          <div>
                            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-400 leading-none">
                              Vaří se zase od
                            </div>
                            <div className="text-[14px] font-semibold text-stone-800 leading-tight mt-1 tabular-nums">
                              {formatDayPhrase(reopensAfterClosure, false)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {upcomingClosure.note && (
                      <div className="text-[12px] text-stone-500 leading-snug mt-2.5">{upcomingClosure.note}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showUnlockModal && (
        <div className="modal-overlay" onClick={closeUnlock}>
          <div
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <div className="modal-sheet__header">
              <h3 className="modal-sheet__title" id="unlock-modal-title">Odemknout objednávky</h3>
              <button
                aria-label="Zavřít"
                className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold leading-none"
                onClick={closeUnlock}
                type="button"
              >×</button>
            </div>
            <div className="modal-sheet__body space-y-3">
              <p className="text-[13px] text-stone-600">
                Uzávěrka proběhla v <strong>{cutoffTime}</strong>. Zadejte administrátorský PIN pro otevření objednávek. Pokud se čas uzávěrky posune dál, začne zase platit.
              </p>
              <label className="modal-label" htmlFor="unlock-pin">Správcovský PIN</label>
              <input
                aria-invalid={unlockError ? true : undefined}
                autoComplete="current-password"
                autoFocus
                className="w-full px-3 py-2.5 rounded-2xl glass text-[14px] text-stone-800 outline-none focus:ring-2 focus:ring-amber-400/60 text-center"
                disabled={isUnlocking}
                id="unlock-pin"
                maxLength={128}
                onChange={(e) => changePin(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
                type="password"
                value={unlockPin}
              />
              {unlockError && (
                <p className="text-[12.5px] text-red-600 font-medium" role="alert">{unlockError}</p>
              )}
            </div>
            <div className="modal-sheet__footer">
              <button
                className="v2-btn v2-btn--secondary"
                disabled={isUnlocking}
                onClick={closeUnlock}
                type="button"
              >Zrušit</button>
              <button
                className="v2-btn v2-btn--primary"
                disabled={isUnlocking || !unlockPin}
                onClick={handleUnlock}
                type="button"
              >{isUnlocking ? "Ověřuji…" : "Odemknout"}</button>
            </div>
          </div>
        </div>
      )}
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
  );
}
