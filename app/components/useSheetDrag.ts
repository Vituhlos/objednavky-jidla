"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tažení spodního listu (`.modal-sheet`) prstem: list jede s prstem dolů,
 * pozadí se při tom zesvětluje a po puštění se list buď zavře, nebo vrátí.
 *
 * Tři věci, na kterých dřívější pokus ztroskotal:
 *
 *  - **Vstupní animace přebíjí inline styl.** `sheetUp` běží s `both`, takže
 *    její koncový `transform` platí i po doběhnutí a má v kaskádě přednost
 *    před `style.transform`. Při začátku tažení se proto animace vypíná.
 *  - **Posluchač musí smět zrušit rolování.** Reactové `onTouchMove` je pasivní;
 *    bez `preventDefault` si gesto vezme prohlížeč (pruží obsah listu). Proto
 *    nativní posluchače s `passive: false`.
 *  - **Rolovaný obsah má přednost.** Když tah začne v obsahu, který je odrolovaný,
 *    patří rolování; list se táhne jen od horní hrany obsahu, ze záhlaví a z úchytu.
 *
 * Platí jen pro rozložení „spodní list" (pod 640 px). Vrací callback ref —
 * list se často vykresluje až po mountu (portál), takže obyčejný ref by
 * posluchače nikdy nepřipojil.
 */

/** Tah delší než tohle list po puštění zavře. */
const DISMISS_DISTANCE_PX = 120;
/** Rychlé švihnutí dolů zavře list i při kratším tahu. */
const FLICK_VELOCITY_PX_PER_MS = 0.5;
const FLICK_MIN_DISTANCE_PX = 30;
/** Dokud se prst nepohne o tolik, není jasné, jestli jde o tah, nebo klepnutí. */
const DECIDE_PX = 8;
const OVERLAY_ALPHA = 0.38;
const SETTLE_MS = 240;

type Gesture = {
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
  /** Tah začal v odrolovaném obsahu — patří rolování, ne listu. */
  blocked: boolean;
};

export function useSheetDrag<T extends HTMLElement>(onDismiss: () => void) {
  const [sheet, setSheet] = useState<T | null>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    if (!sheet) return;
    const overlay = sheet.parentElement;
    let gesture: Gesture | null = null;
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;

    const isSheetLayout = () => !window.matchMedia("(min-width: 640px)").matches;

    const startsInScrolledContent = (target: EventTarget | null): boolean => {
      let el = target instanceof Element ? target : null;
      while (el && el !== sheet) {
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 1) {
          const overflowY = getComputedStyle(el).overflowY;
          if (overflowY === "auto" || overflowY === "scroll") return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const setOffset = (offset: number) => {
      sheet.style.transform = offset > 0 ? `translate3d(0, ${offset}px, 0)` : "";
      if (!overlay) return;
      const progress = Math.min(offset / Math.max(sheet.offsetHeight, 1), 1);
      overlay.style.backgroundColor = offset > 0 ? `rgba(26,18,8,${(OVERLAY_ALPHA * (1 - progress)).toFixed(3)})` : "";
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!isSheetLayout() || e.touches.length !== 1 || dismissTimer) return;
      const touch = e.touches[0];
      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastY: touch.clientY,
        lastTime: e.timeStamp,
        velocity: 0,
        dragging: false,
        blocked: startsInScrolledContent(e.target),
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gesture;
      if (!g || g.blocked) return;
      const touch = e.touches[0];
      const dy = touch.clientY - g.startY;
      const dx = touch.clientX - g.startX;

      if (!g.dragging) {
        // Tah nahoru nebo do strany listu nepatří; nech ho prohlížeči.
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dy) >= DECIDE_PX || Math.abs(dx) >= DECIDE_PX) gesture = null;
          return;
        }
        // Zrušit hned, ne až po prahu: jakmile prohlížeč začne obsah pružit,
        // už mu gesto vzít nejde.
        if (e.cancelable) e.preventDefault();
        if (dy < DECIDE_PX) return;
        g.dragging = true;
        sheet.style.animation = "none";
        sheet.style.transition = "none";
        if (overlay) overlay.style.transition = "none";
        // Tažený list s otevřenou klávesnicí by skákal; klávesnici schovej.
        if (document.activeElement instanceof HTMLElement && sheet.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }

      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - g.lastTime;
      if (dt > 0) g.velocity = 0.7 * ((touch.clientY - g.lastY) / dt) + 0.3 * g.velocity;
      g.lastY = touch.clientY;
      g.lastTime = e.timeStamp;
      setOffset(Math.max(0, dy));
    };

    const settle = (dismiss: boolean) => {
      sheet.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(.3,.7,.4,1)`;
      if (overlay) overlay.style.transition = `background-color ${SETTLE_MS}ms ease`;
      if (!dismiss) {
        setOffset(0);
        return;
      }
      sheet.style.transform = "translate3d(0, 100%, 0)";
      if (overlay) overlay.style.backgroundColor = "rgba(26,18,8,0)";
      dismissTimer = setTimeout(() => onDismissRef.current(), SETTLE_MS - 20);
    };

    const onTouchEnd = () => {
      const g = gesture;
      gesture = null;
      if (!g?.dragging) return;
      const distance = g.lastY - g.startY;
      settle(distance > DISMISS_DISTANCE_PX || (g.velocity > FLICK_VELOCITY_PX_PER_MS && distance > FLICK_MIN_DISTANCE_PX));
    };

    const onTouchCancel = () => {
      const g = gesture;
      gesture = null;
      if (g?.dragging) settle(false);
    };

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", onTouchEnd);
    sheet.addEventListener("touchcancel", onTouchCancel);
    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", onTouchEnd);
      sheet.removeEventListener("touchcancel", onTouchCancel);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [sheet]);

  return setSheet;
}
