"use client";

import { useEffect } from "react";

/**
 * Tažení spodních listů (`.modal-sheet`) prstem — jedno místo pro všechna okna.
 *
 * List jede s prstem dolů, pozadí se při tom zesvětluje a po puštění se list
 * buď zavře, nebo vrátí. Zavření je totéž co klepnutí mimo okno: vyvolá se
 * `click` na `.modal-overlay`, takže každé okno se zavře svou vlastní cestou
 * (a okno, které se klepnutím mimo zavřít nedá, nezavře ani tah).
 *
 * Posluchače jsou na dokumentu, ne v jednotlivých oknech — dřív mělo tažení jen
 * okno objednávky a ostatní okna se chovala jinak. Nové okno s `.modal-sheet`
 * uvnitř `.modal-overlay` ho dostane samo.
 *
 * Tři věci, na kterých dřívější pokus ztroskotal:
 *
 *  - **Vstupní animace přebíjí inline styl.** `sheetUp` běží s `both`, takže
 *    její koncový `transform` platí i po doběhnutí a má v kaskádě přednost
 *    před `style.transform`. Při začátku tažení se proto animace vypíná.
 *  - **Posluchač musí smět zrušit rolování.** Bez `preventDefault` si gesto
 *    vezme prohlížeč (pruží obsah listu). Proto `passive: false`.
 *  - **Rolovaný obsah má přednost.** Když tah začne v obsahu, který je odrolovaný,
 *    patří rolování; list se táhne jen od horní hrany obsahu, ze záhlaví a z úchytu.
 *
 * Platí jen pro rozložení „spodní list" (pod 640 px).
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
  sheet: HTMLElement;
  overlay: HTMLElement | null;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
};

export default function SheetDragManager() {
  useEffect(() => {
    let gesture: Gesture | null = null;
    let settling = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };

    const isSheetLayout = () => !window.matchMedia("(min-width: 640px)").matches;

    const startsInScrolledContent = (target: Element, sheet: HTMLElement): boolean => {
      let el: Element | null = target;
      while (el && el !== sheet) {
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 1) {
          const overflowY = getComputedStyle(el).overflowY;
          if (overflowY === "auto" || overflowY === "scroll") return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const setOffset = (g: Pick<Gesture, "sheet" | "overlay">, offset: number) => {
      g.sheet.style.transform = offset > 0 ? `translate3d(0, ${offset}px, 0)` : "";
      if (!g.overlay) return;
      const progress = Math.min(offset / Math.max(g.sheet.offsetHeight, 1), 1);
      g.overlay.style.backgroundColor = offset > 0 ? `rgba(26,18,8,${(OVERLAY_ALPHA * (1 - progress)).toFixed(3)})` : "";
    };

    const onTouchStart = (e: TouchEvent) => {
      if (settling || !isSheetLayout() || e.touches.length !== 1 || !(e.target instanceof Element)) return;
      const sheet = e.target.closest<HTMLElement>(".modal-sheet");
      if (!sheet || startsInScrolledContent(e.target, sheet)) return;
      const touch = e.touches[0];
      gesture = {
        sheet,
        overlay: sheet.closest<HTMLElement>(".modal-overlay"),
        startX: touch.clientX,
        startY: touch.clientY,
        lastY: touch.clientY,
        lastTime: e.timeStamp,
        velocity: 0,
        dragging: false,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gesture;
      if (!g) return;
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
        g.sheet.style.animation = "none";
        g.sheet.style.transition = "none";
        if (g.overlay) g.overlay.style.transition = "none";
        // Tažený list s otevřenou klávesnicí by skákal; klávesnici schovej.
        if (document.activeElement instanceof HTMLElement && g.sheet.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }

      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - g.lastTime;
      if (dt > 0) g.velocity = 0.7 * ((touch.clientY - g.lastY) / dt) + 0.3 * g.velocity;
      g.lastY = touch.clientY;
      g.lastTime = e.timeStamp;
      setOffset(g, Math.max(0, dy));
    };

    const settle = (g: Gesture, dismiss: boolean) => {
      g.sheet.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(.3,.7,.4,1)`;
      if (g.overlay) g.overlay.style.transition = `background-color ${SETTLE_MS}ms ease`;
      if (!dismiss || !g.overlay) {
        setOffset(g, 0);
        return;
      }
      const overlay = g.overlay;
      settling = true;
      g.sheet.style.transform = "translate3d(0, 100%, 0)";
      overlay.style.backgroundColor = "rgba(26,18,8,0)";
      later(() => {
        overlay.click();
        // Okno, které se klepnutím mimo zavřít nedá, zůstalo v DOM — vrať ho zpět.
        later(() => {
          settling = false;
          if (g.sheet.isConnected) setOffset(g, 0);
        }, 120);
      }, SETTLE_MS - 20);
    };

    const onTouchEnd = () => {
      const g = gesture;
      gesture = null;
      if (!g?.dragging) return;
      const distance = g.lastY - g.startY;
      settle(g, distance > DISMISS_DISTANCE_PX || (g.velocity > FLICK_VELOCITY_PX_PER_MS && distance > FLICK_MIN_DISTANCE_PX));
    };

    const onTouchCancel = () => {
      const g = gesture;
      gesture = null;
      if (g?.dragging) settle(g, false);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchCancel);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
