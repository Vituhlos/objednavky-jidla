"use client";

import { useSyncExternalStore } from "react";
import { getPragueNow } from "@/lib/time";
import { isCutoffLifted, isCutoffPassed } from "@/lib/cutoff";
import { parseCutoffMinutes } from "./order-utils";

/**
 * Uzávěrka a odpočet do ní.
 *
 * Hodiny jsou **externí zdroj**, ne stav komponenty — proto
 * `useSyncExternalStore` a ne dvojice `useState` + `setInterval`. Ta verze
 * měla tichou chybu: počáteční hodnoty se počítaly jen při prvním renderu
 * a dál je přepisoval výhradně interval. Po přeskoku z budoucího dne na
 * dnešek (`isFutureDay` z `true` na `false`) tak záhlaví až půl minuty
 * tvrdilo „Uzávěrka za 12 min" i v pět odpoledne. Teď se všechno
 * **odvozuje** z jediné hodnoty a nemá jak zůstat pozadu.
 *
 * Zamčeno ≠ po uzávěrce: odemčení ředitelem uzávěrku promíjí, ale jen tu,
 * která už v okamžik odemčení proběhla — pravidlo je v `lib/cutoff.ts` a
 * počítá ho stejně server i tenhle hook.
 *
 * U dne v budoucnu uzávěrka neběží: objednávka se odesílá v den samotný,
 * takže dnešní čas o ní nic neříká.
 */

let listeners: (() => void)[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let snapshotMinutes = -1;
let snapshotNow: Date | null = null;

function refresh(): boolean {
  const now = getPragueNow();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes === snapshotMinutes && snapshotNow) return false;
  snapshotMinutes = minutes;
  snapshotNow = now;
  return true;
}

// Jeden interval pro všechny odběratele. `getSnapshot` musí mezi rendery
// vracet **totožnou hodnotu**, dokud nepřijde ohlášení změny — proto se
// mezivýsledek drží v modulu a nepočítá se při každém volání.
function subscribe(onChange: () => void): () => void {
  listeners.push(onChange);
  timer ??= setInterval(() => {
    if (!refresh()) return;
    for (const listener of listeners) listener();
  }, 30_000);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
    if (listeners.length === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  if (snapshotMinutes < 0) refresh();
  return snapshotMinutes;
}

// Na serveru žádný interval neběží, takže cache by zamrzla na čase prvního
// requestu — tady se počítá pokaždé znovu.
function getServerSnapshot(): number {
  const now = getPragueNow();
  return now.getHours() * 60 + now.getMinutes();
}

/** Čas odpovídající poslednímu snapshotu; mění se jen spolu s ním. */
function currentNow(): Date {
  if (typeof window === "undefined") return getPragueNow();
  if (!snapshotNow) refresh();
  return snapshotNow as Date;
}

export function useCutoff({
  cutoffTime,
  forceOpenAt,
  isFutureDay,
}: {
  cutoffTime: string;
  forceOpenAt: string;
  isFutureDay: boolean;
}) {
  const nowMinutes = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = currentNow();

  const input = { cutoffTime, forceOpenAt, now };
  const isPastCutoff = !isFutureDay && isCutoffPassed(input);
  const isForceOpen = !isFutureDay && isCutoffLifted(input);

  const cutoffMinutes = parseCutoffMinutes(cutoffTime);
  const diff = cutoffMinutes - nowMinutes;
  const countdownMins = isFutureDay || Number.isNaN(diff) || diff <= 0 ? null : diff;

  let countdown: string | null = null;
  if (countdownMins !== null) {
    if (countdownMins < 60) {
      countdown = `za ${countdownMins} min`;
    } else {
      const hours = Math.floor(countdownMins / 60);
      const mins = countdownMins % 60;
      countdown = mins > 0 ? `za ${hours} h ${mins} min` : `za ${hours} h`;
    }
  }

  return { isPastCutoff, isForceOpen, countdown, countdownMins };
}
