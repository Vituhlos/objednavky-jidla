"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Přejetí prstem do strany přepne den — doleva na další, doprava na předchozí.
 *
 * Záměrně jen rozpoznání gesta po puštění, obsah se s prstem netáhne: stránka
 * se po přepnutí načítá ze serveru, takže by nebylo co pod prstem ukazovat.
 * Směr přechodu si řeší volající.
 *
 * Gesto se nebere, když začne:
 *  - u levého nebo pravého okraje displeje (tam má iOS návrat zpět),
 *  - ve vodorovně rolovaném prvku (pás dnů) nebo v otevřeném okně,
 *  - na poli, kde tah znamená výběr textu.
 */

const EDGE_PX = 24;
const MIN_DISTANCE_PX = 70;
const MAX_DURATION_MS = 600;
/** Vodorovný pohyb musí být výrazně větší než svislý, jinak jde o rolování. */
const HORIZONTAL_RATIO = 2.2;

export function useDaySwipe(
  ref: RefObject<HTMLElement | null>,
  { enabled, onPrev, onNext }: { enabled: boolean; onPrev: () => void; onNext: () => void },
) {
  const handlers = useRef({ onPrev, onNext });
  useEffect(() => { handlers.current = { onPrev, onNext }; });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number; time: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1 || !(e.target instanceof Element)) return;
      const touch = e.touches[0];
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return;
      if (e.target.closest(".overflow-x-auto, .modal-overlay, input, textarea, select")) return;
      start = { x: touch.clientX, y: touch.clientY, time: e.timeStamp };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      if (e.timeStamp - s.time > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < HORIZONTAL_RATIO * Math.abs(dy)) return;
      if (dx < 0) handlers.current.onNext();
      else handlers.current.onPrev();
    };

    const onTouchCancel = () => { start = null; };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [ref, enabled]);
}
