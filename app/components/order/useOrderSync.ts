"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DepartmentData } from "@/lib/types";
import { getPragueISODate } from "@/lib/time";
import { APP_REFRESH_EVENT } from "../PullToRefresh";

/** Po takhle dlouhé pauze na pozadí se stav po návratu stáhne znovu. */
const STALE_AFTER_HIDDEN_MS = 30_000;

/**
 * Živá synchronizace objednávky přes SSE.
 *
 * Server po každé změně pošle událost `change`, klient si na to stáhne
 * aktuální stav z `/api/order-refresh`. Spojení se po výpadku obnovuje
 * s exponenciálním odstupem (1 s → max 60 s).
 *
 * Tři věci, které vypadají jako zbytečná opatrnost, ale nejsou:
 *
 *  - **Refresh se ruší přes AbortController.** Když si uživatel mezitím
 *    přepne den, odpověď pro předchozí den by přepsala panely cizími daty.
 *    Kromě zrušení se ještě porovnává datum, se kterým dotaz odcházel.
 *  - **Během rozdělané akce se nerefreshuje** (`isPendingRef`). Jinak by
 *    odpověď serveru přebila optimistickou změnu, kterou uživatel právě dělá.
 *  - **Na skryté kartě se jen počítá.** Místo stahování se do titulku napíše
 *    počet změn; stáhne se to až se návratem na kartu. Šetří to spojení
 *    a hlavně to dá vědět člověku, který má appku otevřenou vzadu.
 *
 * A jedna kvůli appce z plochy telefonu, kterou systém na pozadí uspí i se
 * spojením a která nemá tlačítko pro obnovení stránky:
 *
 *  - **Návrat do appky stav dožene.** Po delší pauze se stáhne znovu, zavřené
 *    spojení se naváže hned (ne až po odstupu) a po každém obnovení spojení
 *    přijde refresh, protože události z doby výpadku jsou pryč. Když se mezitím
 *    změnil den, stránka se načte celá — jinak by ukazovala včerejší objednávku.
 *
 * Hodnoty, které se čtou uvnitř dlouhoběžících posluchačů, jdou přes refy —
 * posluchač se registruje jednou a jinak by viděl props z prvního renderu.
 */
export function useOrderSync({
  isPending,
  isFutureDay,
  selectedDate,
  todayDate,
  setDepartments,
  setOrderStatus,
  setSentAt,
}: {
  isPending: boolean;
  isFutureDay: boolean;
  selectedDate: string | undefined;
  /** Dnešek podle serveru v okamžiku vykreslení stránky. */
  todayDate: string | undefined;
  setDepartments: Dispatch<SetStateAction<DepartmentData[]>>;
  setOrderStatus: Dispatch<SetStateAction<"draft" | "sent">>;
  setSentAt: Dispatch<SetStateAction<string | null>>;
}) {
  const [sseConnected, setSseConnected] = useState(false);
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
  }, [selectedDate]);

  const tabNotifCount = useRef(0);
  const originalTitle = useRef<string>("");

  // `force`: výslovná žádost uživatele (potažení dolů). Živé události se u objednávky
  // dopředu neposlouchají, ale na požádání se má stáhnout i ta.
  const doRefresh = useCallback((force = false) => {
    if (isPendingRef.current) return;
    if (isFutureDayRef.current && !force) return;
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
  }, [setDepartments, setOrderStatus, setSentAt]);

  useEffect(() => {
    originalTitle.current = document.title;
    let hiddenAt: number | null = document.hidden ? Date.now() : null;
    const resetTitle = () => {
      if (tabNotifCount.current > 0) {
        tabNotifCount.current = 0;
        document.title = originalTitle.current;
        doRefresh();
      }
    };
    const onVisibility = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (todayDate && getPragueISODate() !== todayDate) { window.location.reload(); return; }
      if (tabNotifCount.current > 0) resetTitle();
      else if (hiddenFor >= STALE_AFTER_HIDDEN_MS) doRefresh();
    };
    window.addEventListener("focus", resetTitle);
    document.addEventListener("visibilitychange", onVisibility);
    // Potažení dolů (PullToRefresh): stav objednávky si klient drží sám.
    const onAppRefresh = () => doRefresh(true);
    window.addEventListener(APP_REFRESH_EVENT, onAppRefresh);
    return () => {
      window.removeEventListener(APP_REFRESH_EVENT, onAppRefresh);
      window.removeEventListener("focus", resetTitle);
      document.removeEventListener("visibilitychange", onVisibility);
      document.title = originalTitle.current;
    };
  }, [doRefresh, todayDate]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;
    let wasDisconnected = false;

    function connect() {
      es = new EventSource("/api/sse");
      es.addEventListener("open", () => {
        reconnectDelay = 1000;
        setSseConnected(true);
        setHasEverConnected(true);
        if (wasDisconnected) {
          wasDisconnected = false;
          if (!document.hidden) doRefresh();
        }
      });
      es.addEventListener("error", () => {
        setSseConnected(false);
        wasDisconnected = true;
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

    // Po návratu do appky nečekej na odstup (až 60 s) a spojení navaž hned.
    const reconnectNow = () => {
      if (document.hidden || es) return;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      reconnectDelay = 1000;
      connect();
    };

    connect();
    document.addEventListener("visibilitychange", reconnectNow);
    window.addEventListener("online", reconnectNow);
    return () => {
      unmounted = true;
      document.removeEventListener("visibilitychange", reconnectNow);
      window.removeEventListener("online", reconnectNow);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [doRefresh]);

  return { sseConnected, hasEverConnected, doRefresh };
}
