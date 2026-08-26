// Vyhodnocení uzávěrky objednávek. Čistě funkční, bez DB a bez hodin —
// server i klient tak počítají totéž a jde to testovat bez SQLite.
//
// Pravidlo: odemčení promíjí jen tu uzávěrku, která už v okamžik odemčení
// proběhla. Když se čas uzávěrky posune až za odemčení, uzávěrka znovu platí.
//
//   uzávěrka 08:00, odemčeno v 08:05  → 08:00 ≤ 08:05, promlčeno, otevřeno
//   pak přenastaveno na 08:10         → 08:10 > 08:05, v 08:10 se zase zamkne

import { toLocalISODate } from "./time";

/** "HH:MM" na minuty od půlnoci. Vrací null u nesmyslné hodnoty. */
function minutesOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Časové razítko odemčení, jak se ukládá do nastavení. */
export function forceOpenStamp(now: Date): string {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${toLocalISODate(now)}T${hh}:${mm}`;
}

export interface CutoffInput {
  /** Nastavený čas uzávěrky, "HH:MM". */
  cutoffTime: string;
  /** Razítko odemčení z nastavení, nebo "" když se dnes neodemykalo. */
  forceOpenAt: string;
  /** Aktuální čas v pražské zóně (viz getPragueNow). */
  now: Date;
}

/** Už dnešní uzávěrka nastala? */
export function isCutoffPassed({ cutoffTime, now }: CutoffInput): boolean {
  const cutoff = minutesOfDay(cutoffTime);
  if (cutoff === null) return false;
  return now.getHours() * 60 + now.getMinutes() >= cutoff;
}

/**
 * Je současná uzávěrka promlčená dnešním odemčením? Platí jen pro uzávěrku,
 * která v okamžik odemčení už proběhla.
 */
export function isCutoffLifted({ cutoffTime, forceOpenAt, now }: CutoffInput): boolean {
  if (!forceOpenAt) return false;

  const [datePart, timePart] = forceOpenAt.split("T");
  if (datePart !== toLocalISODate(now)) return false;

  // Starší formát bez času znamenal "dnes odemčeno" bez ohledu na uzávěrku.
  if (!timePart) return true;

  const unlocked = minutesOfDay(timePart);
  const cutoff = minutesOfDay(cutoffTime);
  if (unlocked === null || cutoff === null) return true;

  return cutoff <= unlocked;
}

/** Je objednávání právě zamčené uzávěrkou? */
export function isOrderingLocked(input: CutoffInput): boolean {
  return isCutoffPassed(input) && !isCutoffLifted(input);
}

const DAY_CODE_TO_JS: Record<string, number> = { Po: 1, Út: 2, St: 3, Čt: 4, Pá: 5 };

export function isWeeklyCutoffLocked(input: {
  enabled: boolean;
  cutoffTime: string;
  cutoffDays: string;
  now: Date;
}): boolean {
  if (!input.enabled) return false;
  const allowedDays = input.cutoffDays
    .split(",")
    .map((day) => DAY_CODE_TO_JS[day.trim()])
    .filter((day): day is number => day !== undefined);
  if (!allowedDays.includes(input.now.getDay())) return false;

  const cutoff = minutesOfDay(input.cutoffTime);
  if (cutoff === null) return false;
  return input.now.getHours() * 60 + input.now.getMinutes() >= cutoff;
}
