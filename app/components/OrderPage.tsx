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

// ── Help modal ────────────────────────────────────────────

const HELP_STEPS = [
  { num: "①", title: "Přidej se", body: 'Klikni na „+ Přidat" u svého oddělení. Zadej jméno a příjmení — pod tím jménem se objednávka odešle do LIMA.', icon: "groups" },
  { num: "②", title: "Vyber jídlo", body: "Zvol polévku a hlavní jídlo z dnešního menu. Cena se spočítá automaticky.", icon: "restaurant_menu" },
  { num: "③", title: "Hotovo — objednávka se odešle sama", body: "V čas uzávěrky (vidíš ho v horní liště) se objednávka automaticky odešle do LIMA. Nic víc dělat nemusíš.", icon: "check_circle" },
] as const;

const HELP_ADVANCED = [
  { title: "Dvě různé polévky nebo jídla", body: 'Použij „Přidat další jídlo" — v jedné objednávce jich může být víc.', icon: "add" },
  { title: "Víc porcí stejného jídla", body: "Nastav počet porcí přímo u daného jídla.", icon: "receipt_long" },
  { title: "Přílohy a omáčky", body: "Rohlík, knedlík, kečup, tatarka nebo BBQ — přičtou se k ceně automaticky.", icon: "lunch_dining" },
  { title: "Pizza", body: "Záložka Pizza funguje samostatně s vlastním menu a uzávěrkou.", icon: "local_pizza" },
  { title: "Přepínání dnů klávesnicí", body: "Šipky ← → přepínají mezi dostupnými dny v týdnu.", icon: "keyboard" },
] as const;

function HelpModal({ onClose }: { onClose: () => void }) {
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    // iOS Safari: overflow:hidden on body doesn't prevent scroll — use position:fixed instead
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="help-modal-title">Jak objednat oběd</h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold leading-none"
            onClick={onClose}
            type="button"
          >×</button>
        </div>
        <div className="modal-sheet__body space-y-3">
          {HELP_STEPS.map((s) => (
            <div key={s.num} className="flex gap-3 p-3 rounded-2xl" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}>
              <div
                className="w-9 h-9 rounded-xl shrink-0 inline-flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
              >
                <MIcon name={s.icon} size={18} fill className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-[13px] text-stone-900 leading-snug">{s.title}</p>
                <p className="text-[12.5px] text-stone-600 leading-snug mt-0.5">{s.body}</p>
              </div>
            </div>
          ))}

          <button
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl glass-btn text-stone-600 text-[12.5px] font-semibold"
            onClick={() => setAdvanced((v) => !v)}
            type="button"
          >
            <span>Pokročilé možnosti</span>
            <MIcon name={advanced ? "expand_less" : "expand_more"} size={18} />
          </button>

          {advanced && (
            <div className="space-y-2">
              {HELP_ADVANCED.map((item) => (
                <div key={item.title} className="flex gap-3 px-3 py-2.5 rounded-2xl glass-soft">
                  <MIcon name={item.icon} size={18} fill style={{ color: "#94a3b8", flexShrink: 0, marginTop: 1 }} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[12.5px] text-stone-800 leading-snug">{item.title}</p>
                    <p className="text-[12px] text-stone-500 leading-snug mt-0.5">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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

  const dayStr = useMemo(() => {
    const today = new Date();
    return (
      today.toLocaleDateString("cs-CZ", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase()) +
      " " +
      today.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })
    );
  }, []);

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

      {/* ── Desktop info strip ── */}
      {/* min-h: the bar used to shrink by 7px whenever "Odeslat" was absent (future days,
          already sent, auto-send on) — it is the tallest child, so the row collapsed
          with it. Reserving its height keeps the header still while switching days. */}
      <div className="hidden md:flex px-5 py-2.5 min-h-[60px] border-b border-white/50 items-center gap-4 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-stone-900 shrink-0">{dayStr}</span>
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
          title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
        />
        <div className="flex items-center gap-3 flex-1 text-[12px] text-stone-500">
          {isFutureDay && !isSent && futureDayPhrase && (
            <span className="inline-flex items-center gap-1 text-stone-500 font-medium">
              <MIcon name="schedule" size={13} /> Uzávěrka {futureDayPhrase} v {cutoffTime} · odešle se automaticky
            </span>
          )}
          {!isFutureDay && !isSent && !isPastCutoff && countdown && (
            <span className={`inline-flex items-center gap-1 font-medium ${countdownMins !== null && countdownMins <= 10 ? "text-red-500" : countdownMins !== null && countdownMins <= 30 ? "text-orange-500" : "text-stone-500"}`}>
              <MIcon name="schedule" size={13} /> Uzávěrka {countdown} ({cutoffTime}){autoSendEnabled ? " · odešle se automaticky" : ""}
            </span>
          )}
          {!isFutureDay && !isSent && isPastCutoff && !isForceOpen && (
            <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
              <MIcon name="schedule" size={13} /> Po uzávěrce ({cutoffTime}){autoSendEnabled ? " · odešle se automaticky" : ""}
            </span>
          )}
          {!isFutureDay && !isSent && isForceOpen && (
            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
              <MIcon name="lock_open" size={13} /> Objednávání odemčeno{autoSendEnabled ? ` · odešle se v ${autoSendTime}` : ""}
            </span>
          )}
          {isSent && sentAt && (
            <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
              <MIcon name="check_circle" size={13} fill /> Odesláno v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {activeOrderCount > 0 && (
            <span className="text-stone-400">
              {activeOrderCount} {activeOrderCount === 1 ? "objednávka" : activeOrderCount < 5 ? "objednávky" : "objednávek"} · {totalPrice} Kč
            </span>
          )}
        </div>
        {!isSent && !isFutureDay && !noMenu && !autoSendEnabled && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="px-4 py-2.5 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
              disabled={isPending}
              onClick={() => { if (activeOrderCount === 0) { setSendError("Objednávka je prázdná — nikdo nic neobjednal."); return; } setSendError(null); setShowSendConfirm(true); }}
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
              type="button"
            >
              {isPending ? "Odesílám…" : "Odeslat"}
            </button>
          </div>
        )}
        {sendError && <span className="text-[11.5px] text-red-600">{sendError}</span>}
        <button
          aria-label="Nápověda"
          className="w-8 h-8 rounded-full glass-btn inline-flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0"
          onClick={() => setShowHelp(true)}
          type="button"
        >
          <MIcon name="info" size={16} />
        </button>
      </div>

      {/* ── Mobile info strip ── */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5 min-h-[60px] flex items-center gap-2.5">
        <MIcon name="calendar_today" size={13} style={{ color: "#D97706" }} />
        <span className="text-[12.5px] font-medium text-stone-700 truncate">{dayStr}</span>
        {activeOrderCount > 0 && (
          <span className="text-[11px] text-stone-500 shrink-0">
            {activeOrderCount} · {totalPrice} Kč
          </span>
        )}
        <span
          aria-label={sseConnected ? "Živé aktualizace aktivní" : "Připojování k živým aktualizacím…"}
          aria-live="polite"
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
          role="img"
          title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
        />
        {isFutureDay && !isSent && futureDayPhrase && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-stone-500 font-medium shrink-0">
            <MIcon name="schedule" size={12} /> {futureDayPhrase} {cutoffTime}
          </span>
        )}
        {!isFutureDay && !isSent && !isPastCutoff && countdown && (
          <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium shrink-0 ${countdownMins !== null && countdownMins <= 10 ? "text-red-500" : countdownMins !== null && countdownMins <= 30 ? "text-orange-500" : "text-stone-500"}`}>
            <MIcon name="schedule" size={12} /> {countdown}{autoSendEnabled ? " · auto" : ""}
          </span>
        )}
        {!isFutureDay && !isSent && isPastCutoff && !isForceOpen && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-orange-600 shrink-0">
            <MIcon name="schedule" size={12} /> Po uzávěrce{autoSendEnabled ? " · auto" : ""}
          </span>
        )}
        {!isFutureDay && !isSent && isForceOpen && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-green-700 font-medium shrink-0">
            <MIcon name="lock_open" size={12} /> Odemčeno{autoSendEnabled ? " · auto" : ""}
          </span>
        )}
        {isSent && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-green-700 font-semibold shrink-0">
            <MIcon name="check_circle" size={12} fill /> Odesláno
          </span>
        )}
        {pushState !== "unsupported" && pushState !== "denied" && (
          <button
            onClick={handlePushToggle}
            title={pushState === "subscribed" ? "Vypnout push notifikace" : "Zapnout upozornění 20 min před uzávěrkou"}
            className={`shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center transition ${pushState === "subscribed" ? "text-amber-600" : "text-stone-400 hover:text-amber-500"}`}
            type="button"
          >
            <MIcon name={pushState === "subscribed" ? "notifications_active" : "notifications"} size={15} fill={pushState === "subscribed"} />
          </button>
        )}
        {!isSent && !isFutureDay && !noMenu && !autoSendEnabled && (
          <button
            className="shrink-0 px-3.5 py-2.5 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-50 active:scale-[0.97] transition"
            disabled={isPending}
            onClick={() => { if (activeOrderCount === 0) { setSendError("Objednávka je prázdná — nikdo nic neobjednal."); return; } setSendError(null); setShowSendConfirm(true); }}
            style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
            type="button"
          >
            {isPending ? "Odesílám…" : "Odeslat"}
          </button>
        )}
        {isFutureDay && !isSent && !noMenu && (
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 shrink-0">
            <MIcon name="schedule" size={12} />
            Auto
          </span>
        )}
        <button
          aria-label="Nápověda"
          className="ml-auto w-9 h-9 rounded-full glass-btn inline-flex items-center justify-center text-stone-400 shrink-0"
          onClick={() => setShowHelp(true)}
          type="button"
        >
          <MIcon name="info" size={17} />
        </button>
      </div>
      {sendError && (
        <div role="alert" className="md:hidden px-4 py-2 flex items-center gap-2 text-[12px] text-red-600 border-b border-red-100/80" style={{ background: "rgba(220,38,38,0.05)" }}>
          <MIcon name="warning" size={13} style={{ flexShrink: 0 }} />
          {sendError}
        </div>
      )}

      {/* ── Scrollable main content ── */}
      <main className="flex-1 overflow-y-auto scroll-area p-4">
        <div className="flex flex-col gap-4 pb-nav md:pb-6">

          {showDayPicker && (
            <div className="relative -mx-4">
              <div className="overflow-x-auto no-scrollbar px-4">
                <div
                  className="flex p-1 rounded-2xl gap-0.5"
                  style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
                >
                  {pickerItems.map((item) => {
                    if (item.kind === "gap") {
                      const label = `zavřeno ${formatGapLabel(item.from, item.to)}`;
                      // The gap swallowed today's chip, so it inherits its two jobs:
                      // showing where you are, and getting you back. Amber fill rather
                      // than the orange gradient — this IS the current position, but
                      // the gradient means "actionable day" everywhere else in the strip.
                      const isActive = !!selectedDate && selectedDate >= item.from && selectedDate <= item.to;
                      const holdsToday = !!todayDate && todayDate >= item.from && todayDate <= item.to;
                      // Same emoji the menu screen puts on its week tabs — a closure
                      // should be recognisable at a glance from either screen. Manual
                      // one-off closed days carry no icon of their own, so they borrow
                      // the closure default rather than switching to a Material glyph:
                      // one slot, one drawing voice.
                      const mark = (
                        <span className="emoji text-[13px] leading-none">
                          {item.icon ?? DEFAULT_CLOSURE_ICON}
                        </span>
                      );

                      // Deliberately NOT a disabled button when active. `disabled`
                      // announces "unavailable" and drops the element out of the tab
                      // order — but this marker means "you are here", which is the
                      // opposite claim. Non-interactive markup states position; the
                      // button exists only when there is somewhere to go.
                      if (isActive) {
                        return (
                          <span
                            aria-current="date"
                            className="flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center gap-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap select-none"
                            key={`gap-${item.from}`}
                            style={{ background: "rgba(245,158,11,0.16)", color: "#92400e" }}
                            title="V tyto dny se v LIMA nevaří"
                          >
                            {mark}
                            {label}
                          </span>
                        );
                      }

                      if (holdsToday) {
                        return (
                          <button
                            className="flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center gap-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap text-stone-600 transition-all duration-200 hover:text-stone-800 hover:bg-white/60 active:scale-[0.96]"
                            key={`gap-${item.from}`}
                            onClick={() => goToDate(todayDate!)}
                            title="Zpět na dnešek — v tyto dny se nevaří"
                            type="button"
                          >
                            {mark}
                            {label}
                          </button>
                        );
                      }

                      return (
                        <span
                          className="flex-shrink-0 self-center px-3 inline-flex items-center gap-1.5 text-[11.5px] text-stone-500 whitespace-nowrap select-none"
                          key={`gap-${item.from}`}
                          title="V tyto dny se v LIMA nevaří"
                        >
                          {mark}
                          {label}
                        </span>
                      );
                    }
                    // Day chips are orderable days only — closed ones live in the gaps.
                    const date = item.date;
                    const isActive = date === selectedDate;
                    return (
                      <button
                        aria-current={isActive ? "date" : undefined}
                        key={date}
                        className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center rounded-xl text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.96] ${
                          isActive ? "" : "text-stone-600 hover:text-stone-800 hover:bg-white/60"
                        }`}
                        onClick={() => { if (isActive) return; goToDate(date); }}
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
              <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none" aria-hidden
                style={{ background: "linear-gradient(to right, transparent, var(--bg))" }} />
            </div>
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
                    isSent={isOrderLocked}
                    key={dept.name}
                    meals={allMeals}
                    onAddRow={handleAddRow}
                    onDeleteRow={handleDeleteRow}
                    onUpdateRow={handleUpdateRow}
                    soups={allSoups}
                  />
                ))}
              </div>

              {/* Bottom status bar */}
              <div
                className="glass rounded-2xl px-4 py-3 flex items-center gap-3 mx-auto w-fit max-w-full"
                style={
                  isSent
                    ? { borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.07)" }
                    : isCutoffLocked
                    ? { borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }
                    : {}
                }
              >
                <div
                  className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0"
                  style={{ background: isSent ? "rgba(34,197,94,0.15)" : isCutoffLocked ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)" }}
                >
                  <MIcon
                    name={isSent ? "check_circle" : isCutoffLocked ? "lock" : "lock_open"}
                    size={18}
                    fill
                    style={{ color: isSent ? "#16a34a" : isCutoffLocked ? "#D97706" : "#94a3b8" }}
                  />
                </div>
                <div className="text-[12.5px] text-stone-700 leading-snug">
                  {isSent ? (
                    <>
                      <strong className="text-green-700">Objednávka odeslána</strong>
                      {sentAt && <span> v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span>}
                      <span className="text-stone-500"> · Další úpravy nejsou možné.</span>
                    </>
                  ) : isCutoffLocked ? (
                    <>
                      <strong className="text-amber-700">Objednávky uzavřeny</strong>
                      <span className="text-stone-500"> · Uzávěrka proběhla v {cutoffTime}.</span>
                    </>
                  ) : isForceOpen ? (
                    <>
                      <strong className="text-green-700">Objednávání odemčeno</strong>
                      <span className="text-stone-500">
                        {` · Uzávěrka v ${cutoffTime} dnes už neplatí.`}
                        {autoSendEnabled ? ` Objednávka se odešle v ${autoSendTime}.` : ""}
                      </span>
                    </>
                  ) : isFutureDay ? (
                    <>
                      <strong>Objednávka dopředu.</strong>
                      <span className="text-stone-500"> Odešle se automaticky v den samotný v {cutoffTime}.</span>
                    </>
                  ) : (
                    <>
                      <strong>Uzávěrka v {cutoffTime}.</strong>
                      <span className="text-stone-500"> Objednávky se přijímají do {cutoffTime}.</span>
                    </>
                  )}
                </div>
                {isCutoffLocked && (
                  <button
                    className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-amber-700"
                    onClick={openUnlock}
                    type="button"
                  >
                    <MIcon name="lock_open" size={14} /> Odemknout
                  </button>
                )}
                {!isOrderLocked && totalPrice > 0 && (
                  <span className="font-display font-bold text-[14px] text-stone-800 shrink-0">{totalPrice} Kč</span>
                )}
              </div>

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
              <input
                autoFocus
                className="w-full px-3 py-2.5 rounded-2xl glass text-[14px] text-stone-800 outline-none focus:ring-2 focus:ring-amber-400/60 tracking-[0.3em] font-mono text-center"
                inputMode="numeric"
                maxLength={8}
                onChange={(e) => changePin(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
                placeholder="PIN"
                type="password"
                value={unlockPin}
              />
              {unlockError && (
                <p className="text-[12.5px] text-red-600 font-medium">{unlockError}</p>
              )}
            </div>
            <div className="modal-sheet__footer">
              <button
                className="v2-btn v2-btn--secondary"
                onClick={closeUnlock}
                type="button"
              >Zrušit</button>
              <button
                className="v2-btn v2-btn--primary"
                disabled={!unlockPin}
                onClick={handleUnlock}
                type="button"
              >Odemknout</button>
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
