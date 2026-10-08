"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Klouzavá pilulka pro přepínače (dny, týdny): výběr mezi položkami přejede,
 * místo aby přeskočil.
 *
 * Pilulka je **potomek vybrané položky**, ne samostatný prvek pod položkami.
 * První verze ji měla zvlášť a spoléhala na `z-index`; Safari na iOS ale vrstvy
 * s transformací řadí po svém, takže pilulka jednou zakryla popisek a jindy se
 * nevykreslila. Takhle je výběr správně i bez animace — klouzání je jen přechod
 * navíc: pilulka už stojí na novém místě a na okamžik se opticky vrátí na staré
 * (technika FLIP přes Web Animations).
 *
 * Použití: ref dát na obal položek; každá položka má `data-pill-key`, vybraná
 * v sobě vykreslí `<span data-pill className="day-pill" />` a má `isolation`
 * (třída `isolate`), aby pilulka se `z-index: -1` zůstala nad jejím pozadím.
 *
 * Při `prefers-reduced-motion` se nic neanimuje.
 */
export function useSlidingPill<T extends HTMLElement>(
  activeKey: string | null | undefined,
  {
    scroller,
    watch,
  }: {
    /** Vodorovně rolovaný obal — vybraná položka se do něj doroluje. */
    scroller?: RefObject<HTMLElement | null>;
    /** Cokoli, po čí změně je potřeba polohu přeměřit (seznam položek). */
    watch?: unknown;
  } = {},
) {
  const trackRef = useRef<T>(null);
  /** Kde pilulka stála naposledy, v souřadnicích obalu — odtud vyjíždí animace. */
  const lastSpot = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const item = track && activeKey
      ? Array.from(track.querySelectorAll<HTMLElement>("[data-pill-key]")).find((el) => el.dataset.pillKey === activeKey)
      : null;
    if (!item) {
      lastSpot.current = null;
      return;
    }
    const spot = { left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight };
    const previous = lastSpot.current;
    lastSpot.current = spot;

    const scrollEl = scroller?.current;
    if (scrollEl && scrollEl.scrollWidth > scrollEl.clientWidth) {
      const target = spot.left - (scrollEl.clientWidth - spot.width) / 2;
      scrollEl.scrollTo({ left: Math.max(0, target), behavior: previous ? "smooth" : "auto" });
    }

    const pill = item.querySelector<HTMLElement>("[data-pill]");
    if (!pill || !previous || spot.width === 0 || spot.height === 0) return;
    if (previous.left === spot.left && previous.top === spot.top && previous.width === spot.width) return;
    if (typeof pill.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pill.animate(
      [
        {
          transform: `translate(${previous.left - spot.left}px, ${previous.top - spot.top}px) scale(${previous.width / spot.width}, ${previous.height / spot.height})`,
        },
        { transform: "none" },
      ],
      { duration: 340, easing: "cubic-bezier(.22,1.15,.36,1)" },
    );
  }, [activeKey, scroller, watch]);

  return trackRef;
}
