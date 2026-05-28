"use client";

import { useState, useTransition, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getHolidayEmoji } from "@/lib/holidays";
import type { OrderData, OrderRowEnriched, Department, DepartmentData, MealEntry, MenuItem } from "@/lib/types";
import type { DeptSuggestion } from "@/lib/orders";
import { computeRowPrice, EXTRAS_PRICES_DEFAULT, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";
import { DepartmentPanel } from "./DepartmentPanel";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import PageHeader from "./PageHeader";
import { useModalSwipe } from "@/app/hooks/useModalSwipe";
import { useDaySwipe } from "@/app/hooks/useDaySwipe";
import {
  actionAddRow,
  actionUpdateRow,
  actionDeleteRow,
  actionSendOrder,
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
  const { sheetRef } = useModalSwipe(onClose);

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
        ref={sheetRef}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-sheet__drag-handle" aria-hidden />
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

function getDayTabParts(date: string, todayDate: string): { dow: string; num: string } {
  const [y, m, d] = date.split("-").map(Number);
  const obj = new Date(y, m - 1, d);
  const wdShort = obj.toLocaleDateString("cs-CZ", { weekday: "short" }).replace(".", "");
  const wdLong = obj.toLocaleDateString("cs-CZ", { weekday: "long" });
  let dow: string;
  if (date === todayDate) dow = "Dnes";
  else if (date === addDays(todayDate, 1)) dow = "Zítra";
  else dow = wdLong.charAt(0).toUpperCase() + wdLong.slice(1);
  // Zkrátit pro mobil
  if (dow !== "Dnes" && dow !== "Zítra" && dow.length > 7) {
    dow = wdShort.charAt(0).toUpperCase() + wdShort.slice(1);
  }
  return { dow, num: `${d}. ${m}.` };
}

function getPragueNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
}

function parseCutoffMinutes(cutoffTime: string) {
  const [h, m] = cutoffTime.split(":").map(Number);
  return h * 60 + m;
}

const DAY_LOCATIVE = ["v neděli", "v pondělí", "v úterý", "ve středu", "ve čtvrtek", "v pátek", "v sobotu"];
function getFutureDayPhrase(selectedDate: string, todayDate: string): string {
  if (selectedDate === addDays(todayDate, 1)) return "zítra";
  const dow = new Date(`${selectedDate}T12:00:00`).getDay();
  return DAY_LOCATIVE[dow];
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

// ── Menu preview card ─────────────────────────────────────

function MenuPreviewCard({
  soups, meals, defaultSoupPrice, defaultMealPrice,
}: {
  soups: MenuItem[];
  meals: MenuItem[];
  defaultSoupPrice: number;
  defaultMealPrice: number;
}) {
  const STORAGE_KEY = "kantyna_menu_preview_open";
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
    if (stored !== null) {
      setOpen(stored === "1");
    } else {
      // Default: open on desktop, collapsed on mobile (≤640px)
      const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
      setOpen(!isMobile);
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  if (soups.length === 0 && meals.length === 0) return null;

  // Cena rozsah
  const allPrices = [
    ...soups.map((s) => s.price || defaultSoupPrice),
    ...meals.map((m) => m.price || defaultMealPrice),
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceLabel = minPrice === maxPrice ? `${minPrice} Kč` : `${minPrice}–${maxPrice} Kč`;
  const subtitle = `${soups.length} ${soups.length === 1 ? "polévka" : soups.length < 5 ? "polévky" : "polévek"} · ${meals.length} ${meals.length === 1 ? "jídlo" : meals.length < 5 ? "jídla" : "jídel"} · ${priceLabel}`;

  return (
    <div className="glass-card overflow-hidden" style={{ borderRadius: 18 }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open ?? false}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-white/60 ${open ? "border-b border-white/30" : ""}`}
        style={{ background: "rgba(254,243,199,0.4)" }}
      >
        <div
          className="w-8 h-8 rounded-xl inline-flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(234,88,12,0.4)" }}
        >
          <MIcon name="menu_book" size={16} fill className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[14px] text-stone-900 leading-none">Dnešní menu</div>
          <div className="text-[11.5px] text-stone-500 mt-0.5">{subtitle}</div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-700 shrink-0">
          {open ? "Sbalit" : "Zobrazit"}
          <span
            className="inline-flex transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
            aria-hidden
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </span>
      </button>

      {open && (
        <div className="menu-preview__body px-4 py-3">
          <div>
            <div className="section-eyebrow mb-2">Polévky · {defaultSoupPrice} Kč</div>
            <div className="space-y-1.5">
              {soups.length === 0 ? (
                <div className="text-[12px] text-stone-400">—</div>
              ) : soups.map((s) => (
                <div key={s.id} className="flex items-baseline gap-2 text-[12.5px] text-stone-700 leading-snug">
                  {s.code && <span className="code-chip shrink-0">{s.code}</span>}
                  <span className="min-w-0 break-words">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-2 gap-2">
              <span className="section-eyebrow">Hlavní jídla · {defaultMealPrice} Kč</span>
              <a href="/jidelnicek" className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap">
                Celý jídelníček →
              </a>
            </div>
            <div className="menu-preview__meals">
              {meals.length === 0 ? (
                <div className="text-[12px] text-stone-400">—</div>
              ) : meals.map((m) => (
                <div key={m.id} className="flex items-baseline gap-1.5 text-[12px] text-stone-700 leading-snug">
                  {m.code && <span className="code-chip shrink-0">{m.code}</span>}
                  <span className="min-w-0 break-words">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
  selectedDate,
  todayDate,
  holidayName,
  holidayDescription,
  autoSendEnabled = false,
  autoSendError,
  autoSendErrorTs,
  suggestions = {},
  prefillMain = null,
  prefillSoup = null,
  isLoggedIn = true,
  currentUserId = null,
  isAdmin = false,
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
  autoSendEnabled?: boolean;
  autoSendError?: string;
  autoSendErrorTs?: string;
  suggestions?: Record<string, DeptSuggestion[]>;
  prefillMain?: number | null;
  prefillSoup?: number | null;
  isLoggedIn?: boolean;
  currentUserId?: number | null;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const isFutureDay = !!(selectedDate && todayDate && selectedDate > todayDate);
  const showDayPicker = !!(availableDates && availableDates.length > 1 && todayDate);

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
  const [daySwitchPending, setDaySwitchPending] = useState(false);

  type PendingDelete = { rowId: number; rowData: OrderRowEnriched; deptName: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill z jídelníčku (?prefill_main=ID / ?prefill_soup=ID)
  const [prefill, setPrefill] = useState<{ mainItemId: number | null; soupItemId: number | null }>(() => ({
    mainItemId: prefillMain,
    soupItemId: prefillSoup,
  }));
  const prefillItem = useMemo(() => {
    if (prefill.mainItemId) {
      return initialData.todayMenu.meals.find((m) => m.id === prefill.mainItemId) ?? null;
    }
    if (prefill.soupItemId) {
      return initialData.todayMenu.soups.find((s) => s.id === prefill.soupItemId) ?? null;
    }
    return null;
  }, [prefill, initialData.todayMenu]);
  // Po načtení vyčistit URL param (state už drží hodnotu)
  useEffect(() => {
    if (prefillMain !== null || prefillSoup !== null) {
      router.replace("/", { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const consumePrefill = useCallback(() => {
    const consumed = { mainItemId: prefill.mainItemId, soupItemId: prefill.soupItemId };
    setPrefill({ mainItemId: null, soupItemId: null });
    return consumed;
  }, [prefill]);

  // Sync state when selected date changes — component isn't remounted, only gets new props
  const prevOrderIdRef = useRef(initialData.order.id);
  if (prevOrderIdRef.current !== initialData.order.id) {
    prevOrderIdRef.current = initialData.order.id;
    orderIdRef.current = initialData.order.id;
    setDepartments(initialData.departments);
    departmentsRef.current = initialData.departments;
    setOrderStatus(initialData.order.status);
    setSentAt(initialData.order.sentAt);
    setJustSent(false);
    setSendError(null);
    if (justSentTimer.current) { clearTimeout(justSentTimer.current); justSentTimer.current = null; }
    if (pendingDeleteTimer.current) {
      clearTimeout(pendingDeleteTimer.current);
      pendingDeleteTimer.current = null;
      if (pendingDeleteRef.current) {
        actionDeleteRow(pendingDeleteRef.current.rowId).catch(() => {});
        pendingDeleteRef.current = null;
      }
    }
    setPendingDelete(null);
  }

  const isSent = orderStatus === "sent";

  // ── Live cutoff check ─────────────────────────────────────
  const checkCutoff = useCallback(() => {
    if (isFutureDay) return false;
    const now = getPragueNow();
    return now.getHours() * 60 + now.getMinutes() >= parseCutoffMinutes(cutoffTime);
  }, [cutoffTime, isFutureDay]);

  const [isPastCutoff, setIsPastCutoff] = useState(checkCutoff);

  useEffect(() => {
    const id = setInterval(() => setIsPastCutoff(checkCutoff()), 30_000);
    return () => clearInterval(id);
  }, [checkCutoff]);

  // ── Real-time sync via SSE ────────────────────────────────
  const [sseConnected, setSseConnected] = useState(false);

  // ── Push notifikace ───────────────────────────────────────
  const [pushState, setPushState] = useState<"unsupported" | "denied" | "subscribed" | "unsubscribed">("unsubscribed");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setPushState("denied"); return; }
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setPushState(existing ? "subscribed" : "unsubscribed");
    });
  }, []);

  const handlePushToggle = useCallback(async () => {
    if (pushState === "unsupported" || pushState === "denied") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushState === "subscribed") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        setPushState("unsubscribed");
        return;
      }
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) { await sub.unsubscribe(); return; }
      setPushState("subscribed");
    } catch {
      // Uživatel odmítl oprávnění nebo selhal server — nic nezměníme
      if (Notification.permission === "denied") setPushState("denied");
    }
  }, [pushState]);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const isPendingRef = useRef(isPending);
  useEffect(() => { isPendingRef.current = isPending; }, [isPending]);
  const isFutureDayRef = useRef(isFutureDay);
  useEffect(() => { isFutureDayRef.current = isFutureDay; }, [isFutureDay]);
  const selectedDateRef = useRef(selectedDate);
  const refreshAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    // Cancel any stale refresh for the previous date
    refreshAbortRef.current?.abort();
    selectedDateRef.current = selectedDate;
    setDaySwitchPending(false);
  }, [selectedDate]);

  const goToDate = useCallback((delta: 1 | -1) => {
    if (!availableDates || !showDayPicker) return;
    const idx = availableDates.indexOf(selectedDate ?? "");
    const next = idx + delta;
    if (next < 0 || next >= availableDates.length) return;
    setDaySwitchPending(true);
    startTransition(() => { router.push(`/?date=${availableDates[next]}`); });
  }, [availableDates, showDayPicker, selectedDate, router]);

  const { swipeRef: daySwipeRef } = useDaySwipe(
    useCallback(() => goToDate(1), [goToDate]),
    useCallback(() => goToDate(-1), [goToDate]),
  );

  useEffect(() => {
    if (!availableDates || !showDayPicker) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const idx = availableDates.indexOf(selectedDate ?? "");
      const next = e.key === "ArrowLeft" ? idx - 1 : idx + 1;
      if (next >= 0 && next < availableDates.length) {
        e.preventDefault();
        setDaySwitchPending(true);
        startTransition(() => { router.push(`/?date=${availableDates[next]}`); });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [availableDates, selectedDate, showDayPicker, startTransition, router]);

  const tabNotifCount = useRef(0);
  const originalTitle = useRef<string>("");

  const doRefresh = useCallback(() => {
    if (isPendingRef.current) return;
    if (isFutureDayRef.current) return;
    // Cancel any in-flight refresh for a previous date
    refreshAbortRef.current?.abort();
    const ac = new AbortController();
    refreshAbortRef.current = ac;
    const requestedDate = selectedDateRef.current;
    const params = new URLSearchParams();
    if (requestedDate) params.set("date", requestedDate);
    const refreshUrl = params.size > 0 ? `/api/order-refresh?${params.toString()}` : "/api/order-refresh";
    fetch(refreshUrl, { signal: ac.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { departments: DepartmentData[]; totalPrice: number; status: string; sentAt: string | null } | null) => {
        if (!data) return;
        // Discard response if the user navigated to a different day while this was in flight
        if (requestedDate !== selectedDateRef.current) return;
        setDepartments(data.departments);
        setOrderStatus(data.status as "draft" | "sent");
        if (data.sentAt) setSentAt(data.sentAt);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    originalTitle.current = document.title;
    const resetTitle = () => {
      if (tabNotifCount.current > 0) {
        tabNotifCount.current = 0;
        document.title = originalTitle.current;
        doRefresh();
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
  }, [doRefresh]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    function connect() {
      es = new EventSource("/api/sse");
      es.addEventListener("open", () => {
        reconnectDelay = 1000;
        setSseConnected(true);
        setHasEverConnected(true);
      });
      es.addEventListener("error", () => {
        setSseConnected(false);
        es?.close();
        es = null;
        if (unmounted) return;
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
          connect();
        }, reconnectDelay);
      });
      es.addEventListener("change", () => {
        setSseConnected(true);
        if (document.hidden) {
          tabNotifCount.current += 1;
          document.title = `(${tabNotifCount.current}) Změna v objednávce`;
          return;
        }
        doRefresh();
      });
    }

    connect();
    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [doRefresh]);

  const getPushEndpoint = useCallback(async (): Promise<string | undefined> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return undefined;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub?.endpoint ?? undefined;
  }, []);

  const handleAddRow = useCallback(
    async (department: Department): Promise<number> => {
      try {
        const pushEndpoint = await getPushEndpoint();
        const newRow = await actionAddRow(orderId, department, pushEndpoint);
        // Konzumuj prefill — předvyplň main/soup pokud existuje
        const consumed = consumePrefill();
        let enriched: OrderRowEnriched = newRow;
        if (consumed.mainItemId || consumed.soupItemId) {
          const mainItem = consumed.mainItemId
            ? initialData.todayMenu.meals.find((m) => m.id === consumed.mainItemId) ?? null
            : null;
          const soupItem = consumed.soupItemId
            ? initialData.todayMenu.soups.find((s) => s.id === consumed.soupItemId) ?? null
            : null;
          enriched = {
            ...newRow,
            mainItemId: consumed.mainItemId,
            soupItemId: consumed.soupItemId,
            mainItem,
            soupItem,
            rowPrice: computeRowPrice(
              newRow,
              soupItem, null, mainItem, [], defaultSoupPrice, defaultMealPrice, extrasPrices,
            ),
          };
          // Persist on server
          startTransition(async () => {
            try {
              await actionUpdateRow(newRow.id, {
                mainItemId: consumed.mainItemId ?? null,
                soupItemId: consumed.soupItemId ?? null,
              }, pushEndpoint);
            } catch {}
          });
        }
        setDepartments((prev) =>
          recalcDepartments(
            prev.map((d) =>
              d.name === department ? { ...d, rows: [...d.rows, enriched] } : d
            )
          )
        );
        return newRow.id;
      } catch {
        setSendError("Nepodařilo se přidat řádek. Zkuste to znovu.");
        throw new Error("add failed");
      }
    },
    [orderId, getPushEndpoint, consumePrefill, initialData.todayMenu, defaultSoupPrice, defaultMealPrice, extrasPrices]
  );

  const handleAddRowWithName = useCallback(
    async (department: Department, personName: string): Promise<number> => {
      try {
        const pushEndpoint = await getPushEndpoint();
        const newRow = await actionAddRow(orderId, department, pushEndpoint);
        const enriched = { ...newRow, personName };
        setDepartments((prev) =>
          recalcDepartments(
            prev.map((d) =>
              d.name === department ? { ...d, rows: [...d.rows, enriched] } : d
            )
          )
        );
        // Persist name on server too (fire-and-forget via update)
        startTransition(async () => {
          try { await actionUpdateRow(newRow.id, { personName }, pushEndpoint); } catch {}
        });
        return newRow.id;
      } catch {
        setSendError("Nepodařilo se přidat řádek. Zkuste to znovu.");
        throw new Error("add failed");
      }
    },
    [orderId, getPushEndpoint]
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

  const getCountdownInfo = useCallback((): { label: string; mins: number } | null => {
    if (isFutureDay) return null;
    const now = getPragueNow();
    const diff = parseCutoffMinutes(cutoffTime) - (now.getHours() * 60 + now.getMinutes());
    if (diff <= 0) return null;
    if (diff < 60) return { label: `za ${diff} min`, mins: diff };
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return { label: mins > 0 ? `za ${hours} h ${mins} min` : `za ${hours} h`, mins: diff };
  }, [cutoffTime, isFutureDay]);
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
      if (pendingDeleteTimer.current) {
        clearTimeout(pendingDeleteTimer.current);
        pendingDeleteTimer.current = null;
        if (pendingDeleteRef.current) {
          actionDeleteRow(pendingDeleteRef.current.rowId).catch(() => {});
          pendingDeleteRef.current = null;
        }
      }
    };
  }, []);

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

      <PageHeader
        title={dayStr}
        leading={
          <span
            aria-label={sseConnected ? "Živé aktualizace aktivní" : "Připojování k živým aktualizacím…"}
            aria-live="polite"
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
            role="img"
            title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
          />
        }
        meta={
          <span className="inline-flex items-center gap-2 md:gap-3 flex-wrap">
            {isSent && sentAt ? (
              <span className="status-pill status-pill--sent">
                <MIcon name="check_circle" size={12} fill />
                <span className="hidden md:inline">Odesláno v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="md:hidden">Odesláno</span>
              </span>
            ) : isFutureDay && futureDayPhrase ? (
              <span className="status-pill status-pill--auto">
                <MIcon name="schedule" size={12} />
                <span className="hidden md:inline">Uzávěrka {futureDayPhrase} v {cutoffTime} · auto</span>
                <span className="md:hidden">{futureDayPhrase} {cutoffTime}</span>
              </span>
            ) : !isFutureDay && !isPastCutoff && countdown ? (
              <span className={`status-pill ${countdownMins !== null && countdownMins <= 10 ? "status-pill--past" : "status-pill--auto"}`}>
                <MIcon name="schedule" size={12} />
                <span className="hidden md:inline">Uzávěrka {countdown} ({cutoffTime}){autoSendEnabled ? " · auto" : ""}</span>
                <span className="md:hidden">{countdown}{autoSendEnabled ? " · auto" : ""}</span>
              </span>
            ) : !isFutureDay && isPastCutoff ? (
              <span className="status-pill status-pill--past">
                <MIcon name="schedule" size={12} />
                <span className="hidden md:inline">Po uzávěrce ({cutoffTime}){autoSendEnabled ? " · auto" : ""}</span>
                <span className="md:hidden">Po uzávěrce{autoSendEnabled ? " · auto" : ""}</span>
              </span>
            ) : null}
            {activeOrderCount > 0 && (
              <span className="text-stone-600 text-[11.5px]">
                <span className="hidden md:inline">{activeOrderCount} {activeOrderCount === 1 ? "objednávka" : activeOrderCount < 5 ? "objednávky" : "objednávek"} · {totalPrice} Kč</span>
                <span className="md:hidden">{activeOrderCount} · {totalPrice} Kč</span>
              </span>
            )}
            {sendError && <span className="hidden md:inline text-red-600">{sendError}</span>}
          </span>
        }
        actions={
          <>
            {pushState !== "unsupported" && pushState !== "denied" && (
              <button
                onClick={handlePushToggle}
                title={pushState === "subscribed" ? "Vypnout push notifikace" : "Zapnout upozornění 20 min před uzávěrkou"}
                className={`md:hidden shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center transition ${pushState === "subscribed" ? "text-amber-600" : "text-stone-400 hover:text-amber-500"}`}
                type="button"
              >
                <MIcon name={pushState === "subscribed" ? "notifications_active" : "notifications"} size={15} fill={pushState === "subscribed"} />
              </button>
            )}
            {!isSent && !isFutureDay && !noMenu && !autoSendEnabled && (
              <button
                className="shrink-0 rounded-full font-semibold text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition text-[12.5px] px-3.5 md:px-4 py-2 md:py-2.5"
                disabled={isPending}
                onClick={() => { if (activeOrderCount === 0) { setSendError("Objednávka je prázdná — nikdo nic neobjednal."); return; } setSendError(null); setShowSendConfirm(true); }}
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
                type="button"
              >
                {isPending ? "Odesílám…" : "Odeslat"}
              </button>
            )}
            {isFutureDay && !isSent && !noMenu && (
              <span className="md:hidden inline-flex items-center gap-1 text-[11px] text-stone-500 shrink-0">
                <MIcon name="schedule" size={12} /> Auto
              </span>
            )}
            <button
              aria-label="Nápověda"
              className="rounded-full glass-btn inline-flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0 w-8 h-8"
              onClick={() => setShowHelp(true)}
              type="button"
            >
              <MIcon name="info" size={16} />
            </button>
          </>
        }
      />
      {sendError && (
        <div role="alert" className="md:hidden px-4 py-2 flex items-center gap-2 text-[12px] text-red-600 border-b border-red-100/80" style={{ background: "rgba(220,38,38,0.05)" }}>
          <MIcon name="warning" size={13} style={{ flexShrink: 0 }} />
          {sendError}
        </div>
      )}

      {/* ── Scrollable main content ── */}
      <div className="flex-1 overflow-y-auto scroll-area p-4" ref={daySwipeRef as React.RefCallback<HTMLDivElement>}>
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 pb-nav lg:pb-6">

          {showDayPicker && (() => {
            const currentIdx = availableDates!.indexOf(selectedDate ?? "");
            const goToDayIdx = (delta: -1 | 1) => {
              const next = Math.min(availableDates!.length - 1, Math.max(0, currentIdx + delta));
              if (next === currentIdx) return;
              setDaySwitchPending(true);
              startTransition(() => { router.push(`/?date=${availableDates![next]}`); });
            };
            return (
              <>
                {/* Desktop / tablet: 2-line pill tabs */}
                <div className="hidden sm:block">
                  <div className="overflow-x-auto no-scrollbar" style={{ scrollSnapType: "x mandatory" }}>
                    <div className="day-tabs" style={{ width: "max-content" }}>
                      {availableDates!.map((date) => {
                        const isActive = date === selectedDate;
                        const { dow, num } = getDayTabParts(date, todayDate!);
                        return (
                          <button
                            key={date}
                            className={`day-tab${isActive ? " active" : ""}`}
                            onClick={() => { if (isActive) return; setDaySwitchPending(true); startTransition(() => { router.push(`/?date=${date}`); }); }}
                            style={{ scrollSnapAlign: "start" }}
                            type="button"
                          >
                            <span className="dow">{dow}</span>
                            <span className="num">{num}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* Mobile: compact ←  day-label  → + dot indicators */}
                <div className="sm:hidden flex items-center gap-3">
                  <button
                    aria-label="Předchozí den"
                    className="w-9 h-9 rounded-full glass-btn inline-flex items-center justify-center text-stone-600 shrink-0 disabled:opacity-30 active:scale-95 transition"
                    disabled={currentIdx <= 0}
                    onClick={() => goToDayIdx(-1)}
                    type="button"
                  >
                    <MIcon name="chevron_left" size={17} />
                  </button>
                  <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <span className="font-display font-bold text-[15px] text-stone-900 leading-none inline-flex items-center gap-1.5">
                      {(() => {
                        const { dow, num } = getDayTabParts(selectedDate ?? availableDates![0], todayDate!);
                        return <><span>{dow} {num}</span></>;
                      })()}
                    </span>
                    <div className="flex items-center gap-1.5" role="tablist" aria-label="Dostupné dny">
                      {availableDates!.map((date) => {
                        const isActive = date === selectedDate;
                        const isToday = date === todayDate;
                        return (
                          <button
                            key={date}
                            aria-label={getDayTabParts(date, todayDate!).dow + " " + getDayTabParts(date, todayDate!).num}
                            aria-selected={isActive}
                            role="tab"
                            onClick={() => { if (isActive) return; setDaySwitchPending(true); startTransition(() => { router.push(`/?date=${date}`); }); }}
                            type="button"
                            className="transition-all duration-200 rounded-full"
                            style={{
                              width: isActive ? "20px" : "7px",
                              height: "7px",
                              background: isActive
                                ? "linear-gradient(135deg,#F59E0B,#EA580C)"
                                : isToday
                                  ? "rgba(245,158,11,0.45)"
                                  : "rgba(26,18,8,0.18)",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <button
                    aria-label="Další den"
                    className="w-9 h-9 rounded-full glass-btn inline-flex items-center justify-center text-stone-600 shrink-0 disabled:opacity-30 active:scale-95 transition"
                    disabled={currentIdx >= availableDates!.length - 1}
                    onClick={() => goToDayIdx(1)}
                    type="button"
                  >
                    <MIcon name="chevron_right" size={17} />
                  </button>
                </div>
              </>
            );
          })()}

          {noMenu ? (
            /* ── Closed / no-menu banner ── */
            <div className="glass-card rounded-3xl overflow-hidden" style={{ borderColor: holidayName ? "rgba(245,158,11,0.22)" : "rgba(26,18,8,0.08)" }}>
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
                <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 text-[12.5px]"
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

              {/* Prefill banner (sekce 6.6) */}
              {prefillItem && (
                <div
                  className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 text-[12.5px]"
                  style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(254,243,199,0.5)" }}
                  role="status"
                >
                  <div
                    className="w-8 h-8 rounded-xl inline-flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
                  >
                    <MIcon name="add_shopping_cart" size={15} fill className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 leading-snug">
                    <div>
                      <strong className="text-stone-900">Vybráno: {prefillItem.name}</strong>
                    </div>
                    <div className="text-stone-600">Klikni na <strong>+ Přidat</strong> u svého oddělení — jídlo se předvyplní.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrefill({ mainItemId: null, soupItemId: null })}
                    className="shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center text-stone-500 hover:bg-white/60 transition"
                    aria-label="Zrušit výběr"
                  >
                    <MIcon name="close" size={14} />
                  </button>
                </div>
              )}

              {/* Menu preview (sekce 5.1) */}
              {!menuEmpty && (
                <MenuPreviewCard
                  soups={allSoups}
                  meals={allMeals}
                  defaultSoupPrice={defaultSoupPrice}
                  defaultMealPrice={defaultMealPrice}
                />
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
                    isLoggedIn={isLoggedIn}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    isSent={isSent}
                    key={dept.name}
                    meals={allMeals}
                    onAddRow={handleAddRow}
                    onAddRowWithName={handleAddRowWithName}
                    onDeleteRow={handleDeleteRow}
                    onUpdateRow={handleUpdateRow}
                    soups={allSoups}
                    suggestions={suggestions[dept.name] ?? []}
                  />
                ))}
              </div>

              {/* Bottom status bar */}
              <div
                className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3"
                style={isSent ? { borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.07)" } : {}}
              >
                <div
                  className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0"
                  style={{ background: isSent ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.12)" }}
                >
                  <MIcon name={isSent ? "check_circle" : "schedule"} size={18} fill style={{ color: isSent ? "#16a34a" : "#D97706" }} />
                </div>
                <div className="flex-1 text-[12.5px] text-stone-700 leading-snug min-w-0">
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
                  ) : autoSendEnabled ? (
                    <>
                      <strong>Uzávěrka v {cutoffTime}.</strong>
                      <span className="text-stone-500"> Objednávka se odešle automaticky — nemusíš nic dělat.</span>
                    </>
                  ) : (
                    <>
                      <strong>Uzávěrka v {cutoffTime}.</strong>
                      <span className="text-stone-500"> Objednávku lze odeslat i po uzávěrce.</span>
                    </>
                  )}
                </div>
                {!isSent && totalPrice > 0 && (
                  <div className="shrink-0 flex flex-col items-end leading-none">
                    <span className="text-[11.5px] text-stone-500">Celkem</span>
                    <span className="font-display font-extrabold text-[18px] text-stone-900 leading-none mt-0.5">
                      {totalPrice}
                      <span className="text-[12px] font-semibold text-stone-500 ml-1">Kč</span>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
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
