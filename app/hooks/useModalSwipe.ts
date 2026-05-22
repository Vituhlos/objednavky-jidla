"use client";

import { useRef, useCallback } from "react";
import type { RefCallback } from "react";

export function useModalSwipe(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const cleanupRef = useRef<(() => void) | null>(null);

  const sheetRef: RefCallback<HTMLDivElement> = useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!el) return;

    let startY = 0;
    let isDragging = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const dismiss = () => {
      el.style.transition = "transform 0.24s ease-in";
      el.style.transform = "translateY(110%)";
      timer = setTimeout(() => onDismissRef.current(), 240);
    };

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isDragging = false;
      el.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { isDragging = false; return; }

      const body = el.querySelector(".modal-sheet__body") as HTMLElement | null;
      if (body && body.scrollTop > 0) { isDragging = false; return; }

      e.preventDefault();
      isDragging = true;
      el.style.transform = `translateY(${dy}px)`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging) { el.style.transition = ""; el.style.transform = ""; return; }
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 80) {
        dismiss();
      } else {
        el.style.transition = "transform 0.3s ease-out";
        el.style.transform = "";
      }
      isDragging = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    cleanupRef.current = () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { sheetRef };
}
