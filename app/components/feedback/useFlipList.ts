"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Plynulé přeskládání seznamu (technika FLIP): když se změní pořadí položek,
 * každá se z původního místa přesune na nové, místo aby naráz skočila.
 *
 * Použití: `const ref = useFlipList(ids)` na <ul> (seznam i mřížka), každé <li> s `data-flip-id`.
 * Při `prefers-reduced-motion` nedělá nic.
 */
export function useFlipList<T extends HTMLElement>(order: readonly (string | number)[]) {
  const listRef = useRef<T>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const lastKey = useRef<string | null>(null);
  const key = order.join(",");

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-flip-id]"));
    // Pozice se měří po každém překreslení (rozbalený text posune ostatní),
    // animuje se jen při změně pořadí
    const reordered = lastKey.current !== null && lastKey.current !== key;
    lastKey.current = key;
    const reduce = !reordered || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, { x: number; y: number }>();

    for (const el of items) {
      const id = el.dataset.flipId!;
      // offsetLeft/Top, ne getBoundingClientRect: posun stránky mezi dvěma
      // překresleními by jinak rozhoupal úplně všechny položky. X kvůli mřížce.
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      next.set(id, pos);
      const before = positions.current.get(id);
      if (reduce || !before || (Math.abs(before.x - pos.x) < 1 && Math.abs(before.y - pos.y) < 1)) continue;
      el.animate(
        [{ transform: `translate(${before.x - pos.x}px, ${before.y - pos.y}px)` }, { transform: "translate(0, 0)" }],
        { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
    positions.current = next;
  });

  return listRef;
}
