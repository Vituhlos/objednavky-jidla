"use client";

import { useRef, useCallback } from "react";
import type { RefCallback } from "react";

// Dismiss thresholds — modal closes either by distance OR by flick velocity.
const DISMISS_DISTANCE_PX = 100;
const DISMISS_VELOCITY_PXMS = 0.5;
const FLICK_MIN_DISTANCE_PX = 30;
// Beyond this drag distance, apply rubber-band resistance so it feels bounded.
const RESISTANCE_THRESHOLD_PX = 200;
const RESISTANCE_FACTOR = 0.3;

export function useModalSwipe(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const cleanupRef = useRef<(() => void) | null>(null);

  const sheetRef: RefCallback<HTMLDivElement> = useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!el) return;

    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let isDragging = false;
    let scrollLocked = false;
    let body: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const dismiss = () => {
      el.style.transition = "transform 0.2s ease-in, opacity 0.2s ease-in";
      el.style.transform = "translateY(110%)";
      el.style.opacity = "0";
      timer = setTimeout(() => onDismissRef.current(), 200);
    };

    const reset = () => {
      el.style.transition = "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease-out";
      el.style.transform = "";
      el.style.opacity = "";
    };

    // Rubber-band beyond threshold: 1px input → 0.3px output.
    const computeOffset = (dy: number) => {
      if (dy < RESISTANCE_THRESHOLD_PX) return dy;
      return RESISTANCE_THRESHOLD_PX + (dy - RESISTANCE_THRESHOLD_PX) * RESISTANCE_FACTOR;
    };

    const onTouchStart = (e: TouchEvent) => {
      body = el.querySelector(".modal-sheet__body") as HTMLElement | null;
      // If body is already scrolled, this gesture belongs to the body, not the sheet.
      scrollLocked = !!(body && body.scrollTop > 0);
      startY = e.touches[0].clientY;
      lastY = startY;
      lastT = Date.now();
      isDragging = false;
      el.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      if (scrollLocked) return;

      const y = e.touches[0].clientY;
      const dy = y - startY;

      // Only react to downward drags. Reversing upward cancels any in-progress drag.
      if (dy <= 0) {
        if (isDragging) {
          isDragging = false;
          el.style.transform = "";
          el.style.opacity = "";
        }
        return;
      }

      // If body becomes scrolled mid-gesture, hand the gesture off to body scroll.
      if (body && body.scrollTop > 0) {
        scrollLocked = true;
        if (isDragging) {
          isDragging = false;
          el.style.transform = "";
          el.style.opacity = "";
        }
        return;
      }

      e.preventDefault();
      isDragging = true;
      lastY = y;
      lastT = Date.now();

      const offset = computeOffset(dy);
      el.style.transform = `translateY(${offset}px)`;
      // Fade up to 30% as drag progresses; capped so modal stays partly visible.
      const fade = Math.min(offset / 300, 1);
      el.style.opacity = String(1 - fade * 0.3);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging) { reset(); return; }
      const endY = e.changedTouches[0].clientY;
      const dy = endY - startY;
      const dt = Date.now() - lastT;
      // Instant velocity at release in px/ms (positive = downward).
      const velocity = dt > 0 ? (endY - lastY) / dt : 0;

      const farEnough = dy > DISMISS_DISTANCE_PX;
      const flickedDown = dy > FLICK_MIN_DISTANCE_PX && velocity > DISMISS_VELOCITY_PXMS;

      if (farEnough || flickedDown) dismiss();
      else reset();

      isDragging = false;
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
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { sheetRef };
}
