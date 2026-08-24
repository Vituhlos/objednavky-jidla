// Čisté pomocné funkce objednávkové obrazovky.
//
// Vytaženo z OrderPage.tsx beze změny těla — jde o přesun, ne přepis.
// Umístění i názvy odpovídají větvi feat/heroui-migration, aby se obě
// verze strukturálně sbíhaly a testy platily pro obě.

import type { DepartmentData, OrderRowEnriched } from "@/lib/types";
import { computeRowPrice, type ExtrasPrices } from "@/lib/pricing";
import { hasOrderRowContent } from "@/lib/order-utils";

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDayLabel(date: string, todayDate: string): string {
  if (date === todayDate) return "Dnes";
  if (date === addDays(todayDate, 1)) return "Zítra";
  const [y, m, d] = date.split("-").map(Number);
  const obj = new Date(y, m - 1, d);
  const wd = obj.toLocaleDateString("cs-CZ", { weekday: "short" });
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d}.${m}.`;
}

// Compact label for one continuous closed stretch: "3.–7. 8." / "31. 7. – 3. 8." /
// "3. 8." — the month is printed once when both ends share it.
export function formatGapLabel(from: string, to: string): string {
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  if (from === to) return `${fd}. ${fm}.`;
  if (fm === tm) return `${fd}.–${td}. ${fm}.`;
  return `${fd}. ${fm}. – ${td}. ${tm}.`;
}

// The day picker is a timeline: orderable days are chips, closed stretches are the
// gaps between them. A gap renders as ONE quiet marker, not one item per day —
// five struck-through chips read as five choices, which is exactly what they aren't.
export type PickerItem =
  | { kind: "day"; date: string }
  | { kind: "gap"; from: string; to: string; icon: string | null };

// The emoji the operator picked for the closure, so the strip names the shutdown the
// same way the menu screen's week tabs do. null for a day toggled closed by hand —
// that has no icon to show, and inventing one would imply a closure that isn't there.
export type ClosureRange = { startDate: string; endDate: string; icon: string };

export function buildPickerItems(
  availableDates: string[],
  closedDates: string[],
  closureRanges: ClosureRange[]
): PickerItem[] {
  // Today is always in availableDates so the page has something to select. When it is
  // itself closed it still belongs to the gap, not beside it — otherwise the strip
  // contradicts itself: a struck-through "Dnes" chip next to a marker whose range
  // starts tomorrow, both describing the same shutdown. One span, one marker.
  const closed = new Set(closedDates);
  const openDays = availableDates.filter((d) => !closed.has(d));
  const gapDays = [...closed].sort();
  const items: PickerItem[] = [];
  let i = 0;

  const flushRunBefore = (limit: string | null) => {
    while (i < gapDays.length && (limit === null || gapDays[i] < limit)) {
      const from = gapDays[i];
      let to = from;
      i++;
      // Keep one marker per continuous stretch; a weekend (max 3 days apart) doesn't break it
      while (i < gapDays.length && (limit === null || gapDays[i] < limit) && daysBetween(to, gapDays[i]) <= 3) {
        to = gapDays[i];
        i++;
      }
      const icon = closureRanges.find((c) => from >= c.startDate && from <= c.endDate)?.icon ?? null;
      items.push({ kind: "gap", from, to, icon });
    }
  };

  for (const date of openDays) {
    flushRunBefore(date);
    items.push({ kind: "day", date });
  }
  flushRunBefore(null);
  return items;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000);
}

export function parseCutoffMinutes(cutoffTime: string) {
  const [h, m] = cutoffTime.split(":").map(Number);
  return h * 60 + m;
}

// Genitive — reads correctly after both "od" and "do" (od pondělí … do pátku)
const DAY_GENITIVE = ["neděle", "pondělí", "úterý", "středy", "čtvrtka", "pátku", "soboty"];

export function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}.`;
}

// The banner's headline — the one sentence a reader should leave with.
// People think in "příští týden", not in date ranges, so use the relative phrase
// whenever it's exactly true; the absolute dates sit on the line below anyway.
export function formatClosureHeadline(from: string, to: string, todayDate: string): string {
  const nextMonday = addDays(todayDate, ((8 - dayOfWeek(todayDate)) % 7) || 7);
  const nextFriday = addDays(nextMonday, 4);
  if (from <= nextMonday && to >= nextFriday) return "Příští týden se nevaří";
  if (from === to) return `${DAY_LOCATIVE[dayOfWeek(from)].replace(/^v/, "V")} ${shortDate(from)} se nevaří`;
  return `Od ${shortDate(from)} do ${shortDate(to)} se nevaří`;
}

// "v pátek 31. 7." (withPreposition) or "pátek 31. 7." for label:value pairs
export function formatDayPhrase(iso: string, withPreposition = true): string {
  const day = DAY_LOCATIVE[dayOfWeek(iso)];
  const bare = day.replace(/^ve? /, "");
  return `${withPreposition ? day : bare} ${shortDate(iso)}`;
}

const DAY_LOCATIVE = ["v neděli", "v pondělí", "v úterý", "ve středu", "ve čtvrtek", "v pátek", "v sobotu"];
export function getFutureDayPhrase(selectedDate: string, todayDate: string): string {
  if (selectedDate === addDays(todayDate, 1)) return "zítra";
  const dow = new Date(`${selectedDate}T12:00:00`).getDay();
  return DAY_LOCATIVE[dow];
}

export function recalcDepartments(departments: DepartmentData[]): DepartmentData[] {
  return departments.map((d) => ({
    ...d,
    subtotal: d.rows.filter(hasOrderRowContent).reduce((s, r) => s + r.rowPrice, 0),
  }));
}

export function patchRow(departments: DepartmentData[], rowId: number, updated: OrderRowEnriched): DepartmentData[] {
  return recalcDepartments(
    departments.map((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === rowId ? updated : r)),
    }))
  );
}
