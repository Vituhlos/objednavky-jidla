"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DepartmentData } from "@/lib/types";

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
 * Hodnoty, které se čtou uvnitř dlouhoběžících posluchačů, jdou přes refy —
 * posluchač se registruje jednou a jinak by viděl props z prvního renderu.
 */
export function useOrderSync({
  isPending,
  isFutureDay,
  selectedDate,
  setDepartments,
  setOrderStatus,
  setSentAt,
}: {
  isPending: boolean;
  isFutureDay: boolean;
  selectedDate: string | undefined;
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
  }, [setDepartments, setOrderStatus, setSentAt]);

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

  return { sseConnected, hasEverConnected, doRefresh };
}
