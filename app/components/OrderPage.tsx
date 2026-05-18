"use client";

import React, { useState, useTransition, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  actionReopenOrder,
  actionClearOrder,
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

// ── Helpers ───────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}


function getPragueNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
}

function getDateParts(date: string, todayDate: string): { label: string; dateShort: string } {
  const [, m, d] = date.split("-").map(Number);
  const dateShort = `${d}.${m}.`;
  if (date === todayDate) return { label: "Dnes", dateShort };
  if (date === addDays(todayDate, 1)) return { label: "Zítra", dateShort };
  const obj = new Date(`${date}T12:00:00`);
  const wd = obj.toLocaleDateString("cs-CZ", { weekday: "short" });
  return { label: wd.charAt(0).toUpperCase() + wd.slice(1, 2), dateShort };
}

const MONTHS_CZ = ["ledna","února","března","dubna","května","června","července","srpna","září","října","listopadu","prosince"];

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
  currentUserId,
  isAdmin = false,
  currentUserName,
  defaultDepartment,
  autoSendEnabled = false,
  autoSendTime = "08:00",
  autoSendError,
  autoSendErrorTs,
  apiBase = "",
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
  currentUserId?: number;
  isAdmin?: boolean;
  currentUserName?: string;
  defaultDepartment?: string | null;
  autoSendEnabled?: boolean;
  autoSendTime?: string;
  autoSendError?: string;
  autoSendErrorTs?: string;
  apiBase?: string;
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
  const [justSent, setJustSent] = useState(false);
  const justSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [daySwitchPending, setDaySwitchPending] = useState(false);

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
        startTransition(() => { router.push(`${apiBase}?date=${availableDates[next]}`); });
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
    const refreshUrl = params.size > 0 ? `${apiBase}/api/order-refresh?${params.toString()}` : `${apiBase}/api/order-refresh`;
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
      es = new EventSource(`${apiBase}/api/sse`);
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
          router.refresh();
        }
      });
    },
    [defaultMealPrice, defaultSoupPrice, extrasPrices, getPushEndpoint, initialData.todayMenu, router]
  );

  const handleClear = useCallback(() => {
    startTransition(async () => {
      try {
        await actionClearOrder(orderId);
        setDepartments((prev) =>
          recalcDepartments(prev.map((d) => ({ ...d, rows: [] })))
        );
        setClearConfirm(false);
      } catch (e) {
        setSendError(e instanceof Error ? e.message : "Nepodařilo se smazat objednávku.");
      }
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

const dateLong = useMemo(() => {
    const d = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    return d.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })
      .replace(/^\w/, (c) => c.toUpperCase());
  }, [selectedDate]);

  const weekRangeLabel = useMemo(() => {
    if (!availableDates || availableDates.length === 0) return "";
    const first = new Date(`${availableDates[0]}T12:00:00`);
    const last = new Date(`${availableDates[availableDates.length - 1]}T12:00:00`);
    const d1 = first.getDate(), d2 = last.getDate();
    const m1 = first.getMonth(), m2 = last.getMonth();
    const y = first.getFullYear();
    if (m1 === m2) return `Týden ${d1}.–${d2}. ${MONTHS_CZ[m1]} ${y}`;
    return `Týden ${d1}. ${MONTHS_CZ[m1]}–${d2}. ${MONTHS_CZ[m2]} ${y}`;
  }, [availableDates]);

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
      if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
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

      {/* ── Fixed toasts ── */}
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
      {!isSent && !isPastCutoff && !isFutureDay && countdownMins !== null && countdownMins <= 30 && (
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

      {/* ── Day picker ── */}
      {showDayPicker && (
        <div className="px-6 pt-5 pb-3 shrink-0 flex items-center gap-3">
          <div
            className="inline-flex items-center gap-0.5 p-1 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 14px -8px rgba(26,18,8,0.08)",
            }}
          >
            {availableDates!.map((date) => {
              const isActive = date === selectedDate;
              const { label, dateShort } = getDateParts(date, todayDate!);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => { setDaySwitchPending(true); startTransition(() => { router.push(`${apiBase}?date=${date}`); }); }}
                  className={`inline-flex items-baseline gap-2 px-4 py-1.5 rounded-xl text-[12.5px] font-semibold font-display transition ${isActive ? "text-white" : "text-slate-600 hover:text-slate-900"}`}
                  style={isActive ? {
                    background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                    boxShadow: "0 6px 14px -6px rgba(234,88,12,0.5), 0 1px 0 rgba(255,255,255,0.35) inset",
                  } : {}}
                >
                  <span>{label}</span>
                  <span className={`text-[10.5px] tabular-nums ${isActive ? "text-white/80" : "text-slate-400"}`}>{dateShort}</span>
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <div className="text-[11.5px] text-slate-500">{weekRangeLabel}</div>
        </div>
      )}

      {/* ── Status bar ── */}
      <div className={`px-6 shrink-0 flex items-end justify-between gap-4 ${showDayPicker ? "pb-4" : "pt-5 pb-4"}`}>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-slate-400 font-bold mb-1">
            {isFutureDay ? "Plánovaná objednávka" : "Dnešní objednávka"}
          </div>
          <div className="font-display font-extrabold text-[22px] text-slate-900 leading-none">{dateLong}</div>
        </div>
        <div className="text-right">
          {isSent ? (
            <>
              <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold mb-1 inline-flex items-center gap-1.5 justify-end" style={{ color: "#047857" }}>
                <MIcon name="check_circle" size={12} fill />
                Odesláno{sentAt && ` v ${new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`}
              </div>
              <div className="font-display font-extrabold text-[18px] text-slate-900 tabular-nums">
                {activeOrderCount} jídel ·{" "}
                <span style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {totalPrice.toLocaleString("cs-CZ")} Kč
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold mb-1 inline-flex items-center gap-1.5 justify-end text-amber-700">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
                  title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
                />
                {isFutureDay
                  ? `Uzávěrka ${futureDayPhrase ?? ""} v ${cutoffTime}`
                  : `Otevřená · uzávěrka ${cutoffTime}`}
              </div>
              <div className="font-display font-bold text-[14.5px] text-slate-700 tabular-nums">
                {activeOrderCount} jídel · {totalPrice.toLocaleString("cs-CZ")} Kč
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-5">
        {noMenu ? (
          <div className="glass rounded-3xl overflow-hidden mt-2" style={{ borderColor: holidayName ? "rgba(245,158,11,0.22)" : "rgba(26,18,8,0.08)" }}>
            <div className="flex flex-col items-center text-center px-6 py-10 gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={holidayName
                  ? { background: "linear-gradient(135deg,#fbbf24,#d97706)", boxShadow: "0 8px 24px -6px rgba(245,158,11,0.45)" }
                  : { background: "rgba(148,163,184,0.18)", border: "1px solid rgba(148,163,184,0.25)" }
                }
              >
                {holidayName
                  ? <span className="text-[28px] leading-none">{holidayEmoji}</span>
                  : <MIcon name="no_meals" size={28} fill style={{ color: "#94a3b8" }} />
                }
              </div>
              <div>
                <div className="font-display font-bold text-[20px] text-stone-900 leading-tight">
                  {holidayName ?? "Jídelníček není k dispozici"}
                </div>
                {formattedClosedDate && <div className="text-[13px] text-stone-500 mt-0.5">{formattedClosedDate}</div>}
              </div>
              {holidayDescription && (
                <p className="text-[13px] text-stone-500 leading-relaxed max-w-sm">{holidayDescription}</p>
              )}
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium text-stone-500"
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
              <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 text-[12.5px] mb-4"
                style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.07)" }}>
                <MIcon name="warning" size={16} style={{ color: "#D97706" }} />
                <span className="text-stone-700">
                  <strong>Jídelníček není naplněný.</strong>{" "}
                  Přejděte do{" "}
                  <Link href={`${apiBase}/jidelnicek`} className="underline text-stone-700 hover:text-stone-900">Jídelníčku</Link>
                  {" "}a importujte PDF nebo přidejte položky ručně.
                </span>
              </div>
            )}

            {/* 3-col dept grid */}
            <div className={`grid grid-cols-3 gap-4 items-start transition-opacity duration-150 ${daySwitchPending ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
              {departments.map((dept) => (
                <DepartmentPanel
                  key={`${dept.name}-${selectedDate ?? ""}`}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  data={dept}
                  defaultMealPrice={defaultMealPrice}
                  defaultSoupPrice={defaultSoupPrice}
                  existingNames={existingNames}
                  extrasPrices={extrasPrices}
                  isAdmin={isAdmin}
                  isDefault={!!defaultDepartment && dept.name === defaultDepartment}
                  isSent={isSent}
                  meals={allMeals}
                  onAddRow={handleAddRow}
                  onDeleteRow={handleDeleteRow}
                  onUpdateRow={handleUpdateRow}
                  soups={allSoups}
                />
              ))}
            </div>

            {/* Green sent banner */}
            {isSent && (
              <div
                className="mt-4 rounded-2xl px-5 py-4 flex items-center gap-4"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.10))",
                  border: "1px solid rgba(16,185,129,0.32)",
                  boxShadow: "0 8px 24px -10px rgba(16,185,129,0.25), 0 1px 0 rgba(255,255,255,0.55) inset",
                }}
              >
                <div className="w-11 h-11 rounded-xl inline-flex items-center justify-center shrink-0"
                  style={{ background: "rgba(16,185,129,0.20)" }}>
                  <MIcon name="check_circle" size={24} fill style={{ color: "#047857" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[15px] leading-tight" style={{ color: "#065f46" }}>
                    Objednávka odeslána{sentAt && ` v ${new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`} · Další úpravy nejsou možné.
                  </div>
                  <div className="text-[12px] mt-1" style={{ color: "rgba(6,95,70,0.72)" }}>
                    Kuchyně dostane výpis. Výdej od 11:30 do 13:00.
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleReopen}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold font-display px-3 py-1.5 rounded-xl shrink-0 disabled:opacity-55"
                    style={{ background: "rgba(255,255,255,0.78)", border: "1px solid rgba(16,185,129,0.25)", color: "#065f46" }}
                  >
                    <MIcon name="lock_open" size={14} /> Znovu otevřít
                  </button>
                )}
              </div>
            )}

            {/* Admin send / info bar */}
            {!isSent && !noMenu && (isFutureDay || isAdmin) && (
              <div
                className="mt-4 rounded-2xl px-5 py-3.5 flex items-center gap-3"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  boxShadow: "0 8px 22px -12px rgba(26,18,8,0.10), 0 1px 0 rgba(255,255,255,0.85) inset",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13.5px] text-slate-900">
                    {isFutureDay ? "Objednávka dopředu" : autoSendEnabled ? "Automatické odesílání" : "Připraveno k odeslání"}
                  </div>
                  <div className="text-[11.5px] text-slate-500 mt-0.5">
                    {isFutureDay
                      ? `Odešle se automaticky ${futureDayPhrase ?? ""} v ${cutoffTime}`
                      : autoSendEnabled
                        ? `Odešle se automaticky v ${autoSendTime}`
                        : `${activeOrderCount} ${activeOrderCount === 1 ? "objednávka" : activeOrderCount < 5 ? "objednávky" : "objednávek"} · uzávěrka v ${cutoffTime}${countdown ? ` (zbývá ${countdown})` : ""}`
                    }
                  </div>
                </div>
                {!isFutureDay && !autoSendEnabled && isAdmin && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => { if (activeOrderCount === 0) { setSendError("Objednávka je prázdná — nikdo nic neobjednal."); return; } setSendError(null); setShowSendConfirm(true); }}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-4 py-2 rounded-xl text-white shrink-0 disabled:opacity-55"
                    style={{
                      background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                      boxShadow: "0 8px 22px -8px rgba(234,88,12,0.5), 0 1px 0 rgba(255,255,255,0.4) inset",
                    }}
                  >
                    <MIcon name="send" size={15} fill />
                    {isPending ? "Odesílám…" : "Odeslat objednávku"}
                  </button>
                )}
              </div>
            )}

            {sendError && (
              <div role="alert" className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-rose-800"
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)" }}>
                <MIcon name="error" size={14} style={{ color: "#dc2626" }} />
                {sendError}
              </div>
            )}

            {isAdmin && !isSent && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setClearConfirm(true)}
                  className="text-[11.5px] font-medium px-3 py-1.5 rounded-full glass-btn text-slate-500"
                >
                  Smazat objednávku
                </button>
              </div>
            )}
          </>
        )}
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
      {clearConfirm && (
        <ConfirmModal
          confirmLabel="Smazat"
          confirmVariant="danger"
          isPending={isPending}
          message="Celá objednávka bude vymazána. Tuto akci nelze vrátit."
          onClose={() => setClearConfirm(false)}
          onConfirm={handleClear}
          title="Smazat objednávku"
        />
      )}
    </div>
  );
}
