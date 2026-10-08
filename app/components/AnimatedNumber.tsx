"use client";

import { useState } from "react";

/**
 * Číslo, které se při změně krátce „přetočí" (vyjede zespodu). Při prvním
 * vykreslení se neanimuje — jinak by po načtení stránky poskočila všechna
 * čísla naráz.
 *
 * `tick` slouží jako klíč: nová hodnota vloží nový prvek a CSS animace se
 * spustí sama. Při `prefers-reduced-motion` ji vypíná globální pravidlo.
 */
export function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const [tick, setTick] = useState(0);
  if (shown !== value) {
    setShown(value);
    setTick((t) => t + 1);
  }
  return (
    <span className={tick > 0 ? "num-pop" : undefined} key={tick}>
      {value}{suffix}
    </span>
  );
}
