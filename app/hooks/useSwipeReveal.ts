"use client";

import { useCallback, useRef } from "react";
import type { RefCallback } from "react";

const COMMIT_FRACTION = 0.5;
const FLICK_VELOCITY_PXMS = 0.4;
const FLICK_MIN_DISTANCE_PX = 20;
const HORIZONTAL_DOMINANCE = 1.5;
const HORIZONTAL_INTENT_PX = 8;
const EASING = "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), clip-path 0.22s cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Swipe-to-reveal hook. Manipulates DOM directly (no React state during drag).
 *
 * Mount shape required inside `containerRef`:
 *   <div ref={containerRef}>
 *     <div data-swipe-reveal>...</div>       <- the action panel (positioned right)
 *     <div data-swipe-content>...</div>      <- the row content (slides left)
 *   </div>
 *
 * `swipedRef.current` is true after a swipe gesture commits — check it in
 * onClick to suppress synthesized clicks. Reset on next touchstart.
 */
export function useSwipeReveal(revealWidth: number) {
  const swipedRef = useRef(false);
  const revealedRef = useRef(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const apply = useCallback((el: HTMLElement, offset: number, animate: boolean) => {
    const content = el.querySelector(":scope > [data-swipe-content]") as HTMLElement | null;
    const reveal = el.querySelector(":scope > [data-swipe-reveal]") as HTMLElement | null;
    if (!content || !reveal) return;
    content.style.transition = animate ? EASING : "none";
    reveal.style.transition = animate ? EASING : "none";
    content.style.transform = `translateX(${-offset}px)`;
    reveal.style.clipPath = `inset(0 0 0 ${Math.max(0, revealWidth - offset)}px)`;
  }, [revealWidth]);

  const close = useCallback(() => {
    if (!elementRef.current) return;
    apply(elementRef.current, 0, true);
    revealedRef.current = false;
    swipedRef.current = false;
  }, [apply]);

  const containerRef: RefCallback<HTMLElement> = useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    elementRef.current = el;
    if (!el) return;

    // Initial state: closed.
    apply(el, 0, false);

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let baseReveal = 0;
    let direction: null | "h" | "v" = null;
    let isDragging = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { direction = "v"; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastX = startX;
      lastT = Date.now();
      baseReveal = revealedRef.current ? revealWidth : 0;
      direction = null;
      isDragging = false;
      swipedRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (direction === "v") return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - startX;
      const dy = y - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (direction === null) {
        if (absX < HORIZONTAL_INTENT_PX && absY < HORIZONTAL_INTENT_PX) return;
        direction = absX > absY * HORIZONTAL_DOMINANCE ? "h" : "v";
        if (direction === "v") return;
      }

      e.preventDefault();
      isDragging = true;
      lastX = x;
      lastT = Date.now();

      // baseReveal − dx: dragging left (dx<0) increases reveal; right closes.
      const newReveal = Math.min(revealWidth, Math.max(0, baseReveal - dx));
      apply(el, newReveal, false);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging) { direction = null; return; }
      direction = null;
      swipedRef.current = true;

      const endX = e.changedTouches[0].clientX;
      const dt = Date.now() - lastT;
      const velocity = dt > 0 ? (endX - lastX) / dt : 0;
      const totalDx = endX - startX;
      const currentReveal = Math.min(revealWidth, Math.max(0, baseReveal - totalDx));

      const fastLeft = velocity < -FLICK_VELOCITY_PXMS && Math.abs(endX - lastX) > FLICK_MIN_DISTANCE_PX;
      const fastRight = velocity > FLICK_VELOCITY_PXMS && Math.abs(endX - lastX) > FLICK_MIN_DISTANCE_PX;

      let target: number;
      if (fastLeft) target = revealWidth;
      else if (fastRight) target = 0;
      else target = currentReveal >= revealWidth * COMMIT_FRACTION ? revealWidth : 0;

      apply(el, target, true);
      revealedRef.current = target === revealWidth;
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
  }, [revealWidth, apply]);

  return { containerRef, swipedRef, revealedRef, close };
}
