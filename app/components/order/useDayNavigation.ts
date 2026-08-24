"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildPickerItems, type ClosureRange } from "./order-utils";

type UpcomingClosure = { startDate: string; endDate: string; label: string; note: string; icon: string } | null;

/**
 * Přepínání dnů v týdnu — pásek nahoře, šipky na klávesnici a odvozené údaje
 * o nadcházející uzavírce.
 *
 * `pendingDate` drží den, na který se právě naviguje, aby panely mohly během
 * přechodu zešednout. Přepnutí jde přes URL (`?date=`), takže se dá poslat
 * odkazem a funguje tlačítko Zpět v prohlížeči.
 */
export function useDayNavigation({
  availableDates,
  closedDates,
  closureRanges,
  selectedDate,
  todayDate,
  upcomingClosure,
  startTransition,
}: {
  availableDates: string[] | undefined;
  closedDates: string[] | undefined;
  closureRanges: ClosureRange[] | undefined;
  selectedDate: string | undefined;
  todayDate: string | undefined;
  // v OrderPage je to nepovinný prop, takže i undefined
  upcomingClosure: UpcomingClosure | undefined;
  startTransition: React.TransitionStartFunction;
}) {
  const router = useRouter();
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const pickerItems = useMemo(
    () => buildPickerItems(availableDates ?? [], closedDates ?? [], closureRanges ?? []),
    [availableDates, closedDates, closureRanges]
  );
  const showDayPicker = !!(pickerItems.length > 1 && todayDate);
  const daySwitchPending = pendingDate !== null && pendingDate !== selectedDate;

  const goToDate = useCallback((date: string) => {
    setPendingDate(date);
    startTransition(() => { router.push(`/?date=${date}`); });
  }, [router, startTransition]);

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
        goToDate(availableDates[next]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [availableDates, selectedDate, showDayPicker, goToDate]);

  // Last day people can still order before the closure starts — the actionable part
  // of the heads-up ("objednej si, než zavřou").
  const lastOrderableBeforeClosure = useMemo(() => {
    if (!upcomingClosure) return null;
    const before = (availableDates ?? []).filter((d) => d < upcomingClosure.startDate);
    return before.length > 0 ? before[before.length - 1] : null;
  }, [availableDates, upcomingClosure]);

  // First day people can order again — only shown when a menu for it already exists,
  // otherwise we'd be promising a date nobody has confirmed.
  const reopensAfterClosure = useMemo(() => {
    if (!upcomingClosure) return null;
    return (availableDates ?? []).find((d) => d > upcomingClosure.endDate) ?? null;
  }, [availableDates, upcomingClosure]);

  return {
    pickerItems,
    showDayPicker,
    daySwitchPending,
    goToDate,
    lastOrderableBeforeClosure,
    reopensAfterClosure,
  };
}
