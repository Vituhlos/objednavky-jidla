"use client";

import { useRef, useCallback } from "react";
import type { RefCallback } from "react";

// Horizontal swipe thresholds — fires either when far enough OR a fast flick.
const SWIPE_DISTANCE_PX = 60;
const SWIPE_VELOCITY_PXMS = 0.4;
const FLICK_MIN_DISTANCE_PX = 20;
// Only treat as swipe if movement is mostly horizontal (>1.5× vertical).
const HORIZONTAL_DOMINANCE = 1.5;
// Below this dx, never consider it a swipe — lets vertical scroll start naturally.
const HORIZONTAL_INTENT_PX = 8;

export function useDaySwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const onLeftRef = useRef(onSwipeLeft);
  const onRightRef = useRef(onSwipeRight);
  onLeftRef.current = onSwipeLeft;
  onRightRef.current = onSwipeRight;

  const cleanupRef = useRef<(() => void) | null>(null);

  const swipeRef: RefCallback<HTMLElement> = useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let lastX = 0;
    let lastT = 0;
    // null = not decided yet, "h" = horizontal swipe, "v" = vertical scroll (ignore)
    let direction: null | "h" | "v" = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { direction = "v"; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastX = startX;
      startT = Date.now();
      lastT = startT;
      direction = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (direction === "v") return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - startX;
      const dy = y - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Direction decision: wait until movement is at least HORIZONTAL_INTENT_PX
      // before committing — otherwise tiny noise can lock into wrong direction.
      if (direction === null) {
        if (absX < HORIZONTAL_INTENT_PX && absY < HORIZONTAL_INTENT_PX) return;
        direction = absX > absY * HORIZONTAL_DOMINANCE ? "h" : "v";
        if (direction === "v") return;
      }

      // Horizontal: block native scroll so the page doesn't jump.
      e.preventDefault();
      lastX = x;
      lastT = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (direction !== "h") { direction = null; return; }
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startX;
      const dt = Date.now() - lastT;
      // Instant velocity at release in px/ms.
      const velocity = dt > 0 ? (endX - lastX) / dt : 0;

      const far = Math.abs(dx) > SWIPE_DISTANCE_PX;
      const flick = Math.abs(dx) > FLICK_MIN_DISTANCE_PX && Math.abs(velocity) > SWIPE_VELOCITY_PXMS;

      if (far || flick) {
        if (dx < 0) onLeftRef.current(); // finger moved left → reveal next
        else onRightRef.current();       // finger moved right → reveal previous
      }
      direction = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    cleanupRef.current = () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return { swipeRef };
}
