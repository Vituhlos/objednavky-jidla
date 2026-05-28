"use client";

import { useRef, useCallback } from "react";
import type { RefCallback } from "react";

const DISMISS_DISTANCE_PX = 100; // fallback if we can't measure
const DISMISS_VELOCITY_PXMS = 0.5;
const FLICK_MIN_DISTANCE_PX = 30;
const RESISTANCE_THRESHOLD_PX = 200;
const RESISTANCE_FACTOR = 0.3;
const BASE_ALPHA = 0.38;

function armPostDismissClickShield() {
  // iOS Safari/PWA sometimes dispatches a synthetic click after touch-driven dismiss
  // (often after the overlay unmounts), causing an unintended click on underlying UI.
  // We temporarily swallow the next click in the capture phase.
  const win = window as unknown as { __kantyna_swipe_block_until?: number };
  const until = Date.now() + 700;
  win.__kantyna_swipe_block_until = until;

  const handler = (e: MouseEvent) => {
    if (Date.now() > until) {
      document.removeEventListener("click", handler, true);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    // stopImmediatePropagation isn't on Event type in TS DOM lib for all event kinds
    // but exists on Event instances in browsers.
    // stopImmediatePropagation isn't in all TS DOM typings for MouseEvent, but exists in browsers.
    // We avoid importing types/linters here; best-effort only.
    (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
    document.removeEventListener("click", handler, true);
  };

  document.addEventListener("click", handler, { capture: true });
  setTimeout(() => document.removeEventListener("click", handler, true), 900);
}

export function useModalSwipe(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const cleanupRef = useRef<(() => void) | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  const sheetRef: RefCallback<HTMLDivElement> = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el;
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!el) return;

    // Find the overlay parent once on mount so we can fade it separately.
    const overlay = el.closest(".modal-overlay") as HTMLElement | null;

    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let isDragging = false;
    let scrollLocked = false;
    let body: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dynamicDismissPx = DISMISS_DISTANCE_PX;

    // Try to scale dismiss distance to the actual sheet height.
    // Keeps "feel" consistent between small and large sheets.
    try {
      const h = el.getBoundingClientRect().height;
      if (Number.isFinite(h) && h > 0) {
        dynamicDismissPx = Math.max(100, Math.min(160, Math.round(h * 0.22)));
      }
    } catch {}

    const dismiss = () => {
      let called = false;
      const callDismiss = () => {
        if (called) return;
        called = true;
        if (timer) { clearTimeout(timer); timer = null; }
        onDismissRef.current();
      };

      el.style.transition = "transform 220ms cubic-bezier(0.32,0.72,0,1)";
      el.style.transform = "translateY(110%)";

      if (overlay) {
        overlay.style.transition = "background 220ms ease";
        overlay.style.background = "rgba(26,18,8,0)";
      }

      el.addEventListener("transitionend", callDismiss, { once: true });
      timer = setTimeout(callDismiss, 300);
    };

    const reset = () => {
      // Slight spring/bounce feel: overshoot a tiny bit then settle.
      // Keep it subtle so it doesn't feel "janky" on low-end devices.
      el.style.transition = "transform 260ms cubic-bezier(0.32,0.72,0,1)";
      el.style.transform = "translateY(0)";

      if (overlay) {
        overlay.style.transition = `background 300ms ease`;
        overlay.style.background = `rgba(26,18,8,${BASE_ALPHA})`;
      }
    };

    // Rubber-band: 1px input → 0.3px output beyond the threshold.
    const computeOffset = (dy: number) => {
      if (dy < RESISTANCE_THRESHOLD_PX) return dy;
      return RESISTANCE_THRESHOLD_PX + (dy - RESISTANCE_THRESHOLD_PX) * RESISTANCE_FACTOR;
    };

    const onTouchStart = (e: TouchEvent) => {
      // CSS animations (sheetUp/scaleIn) animate `transform` and will override inline
      // transforms while active. Disable animation for the drag gesture.
      el.style.animation = "none";
      el.style.willChange = "transform";

      body = el.querySelector(".modal-sheet__body") as HTMLElement | null;
      scrollLocked = !!(body && body.scrollTop > 0);
      startY = e.touches[0].clientY;
      lastY = startY;
      lastT = Date.now();
      isDragging = false;
      el.style.transition = "none";
      if (overlay) overlay.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      // If scroll was locked but the body scroll reaches top mid-gesture,
      // allow handoff into sheet drag (more iOS-like).
      if (scrollLocked) {
        const y = e.touches[0].clientY;
        const dy = y - startY;
        if (dy > 0 && body && body.scrollTop <= 0) {
          scrollLocked = false;
          // reset baseline so the handoff doesn't "jump"
          startY = y;
          lastY = y;
          lastT = Date.now();
        } else {
          return;
        }
      }

      const y = e.touches[0].clientY;
      const dy = y - startY;

      if (dy <= 0) {
        if (isDragging) {
          isDragging = false;
          el.style.transform = "";
          if (overlay) overlay.style.background = `rgba(26,18,8,${BASE_ALPHA})`;
        }
        return;
      }

      if (body && body.scrollTop > 0) {
        scrollLocked = true;
        if (isDragging) {
          isDragging = false;
          el.style.transform = "";
          if (overlay) overlay.style.background = `rgba(26,18,8,${BASE_ALPHA})`;
        }
        return;
      }

      e.preventDefault();
      isDragging = true;
      lastY = y;
      lastT = Date.now();

      const offset = computeOffset(dy);
      // Sheet stays fully opaque — only translateY follows the finger.
      el.style.transform = `translateY(${offset}px)`;

      // Overlay background fades proportionally (sheet visible → fully transparent).
      const progress = Math.min(offset / 320, 1);
      const alpha = BASE_ALPHA * (1 - progress);
      if (overlay) overlay.style.background = `rgba(26,18,8,${alpha.toFixed(3)})`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      // Prevent "ghost click" after a drag-dismiss: on iOS Safari/PWA a touch gesture
      // can synthesize a click on the element underneath once the overlay unmounts.
      // We only block it when a drag actually happened.
      if (isDragging) {
        try { e.preventDefault(); } catch {}
        try { e.stopPropagation(); } catch {}
      }
      if (!isDragging) { reset(); return; }
      const endY = e.changedTouches[0].clientY;
      const dy = endY - startY;
      const dt = Date.now() - lastT;
      const velocity = dt > 0 ? (endY - lastY) / dt : 0;

      const farEnough = dy > dynamicDismissPx;
      const flickedDown = dy > FLICK_MIN_DISTANCE_PX && velocity > DISMISS_VELOCITY_PXMS;

      if (farEnough || flickedDown) {
        armPostDismissClickShield();
        dismiss();
      }
      else reset();

      isDragging = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });

    cleanupRef.current = () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { sheetRef, sheetElRef: elRef };
}
