"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import type { RefCallback } from "react";

export function useModalSwipe(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  const sheetElRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const dismiss = useCallback(() => {
    const el = sheetElRef.current;
    if (el) {
      el.style.transition = "transform 0.24s ease-in";
      el.style.transform = "translateY(110%)";
    }
    timerRef.current = setTimeout(() => onDismissRef.current(), 240);
  }, []);

  const handlers = useSwipeable({
    onSwiping: ({ deltaY }) => {
      const el = sheetElRef.current;
      if (!el) return;
      const body = el.querySelector(".modal-sheet__body") as HTMLElement | null;
      if (body && body.scrollTop > 0) {
        el.style.transition = "none";
        el.style.transform = "";
        return;
      }
      // deltaY = initialY - currentY → záporné při tahu dolů, proto negujeme
      const drag = Math.max(0, -deltaY);
      el.style.transition = "none";
      el.style.transform = drag > 0 ? `translateY(${drag}px)` : "";
    },
    onSwipedDown: ({ absY, velocity }) => {
      if (absY > 80 || velocity > 0.5) {
        dismiss();
      } else {
        // Snap zpět s animací
        requestAnimationFrame(() => {
          const el = sheetElRef.current;
          if (!el) return;
          el.style.transition = "transform 0.3s ease-out";
          el.style.transform = "";
        });
      }
    },
    onSwiped: ({ dir }) => {
      if (dir !== "Down") {
        const el = sheetElRef.current;
        if (el) { el.style.transition = "none"; el.style.transform = ""; }
      }
    },
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: false },
    trackMouse: false,
    delta: 10,
  });

  const { ref: swipeRef, ...swipeProps } = handlers;

  const sheetRef: RefCallback<HTMLDivElement> = useCallback(
    (el) => { sheetElRef.current = el; swipeRef(el); },
    [swipeRef]
  );

  return { sheetRef, swipeProps };
}
