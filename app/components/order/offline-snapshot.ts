import type { DepartmentData, OrderRowEnriched } from "@/lib/types";
import { hasOrderRowContent } from "@/lib/order-utils";

/**
 * Poslední načtený stav dnešní objednávky pro stránku „Bez připojení".
 *
 * `public/offline.html` je statický soubor mimo React, takže si data bere
 * z localStorage. Tvar je schválně plochý a textový — offline stránka jen
 * vypisuje, nic nepočítá. Při změně tvaru zvedni `v`, starý snímek se zahodí.
 */
export const OFFLINE_SNAPSHOT_KEY = "offlineOrderSnapshot";

export type OfflineSnapshot = {
  v: 1;
  date: string;
  dayLabel: string;
  savedAt: string;
  sent: boolean;
  total: number;
  departments: { label: string; rows: { name: string; items: string; price: number }[] }[];
};

function describeRow(row: OrderRowEnriched): string {
  const meal = (count: number, item: { name: string }) =>
    `${count > 1 ? `${count}× ` : ""}${item.name}`;
  const parts: string[] = [];
  if (row.mainItem) parts.push(meal(row.mealCount || 1, row.mainItem));
  for (const e of row.extraMealItems) parts.push(meal(e.count, e.item));
  if (row.soupItem) parts.push(row.soupItem.name);
  if (row.soupItem2) parts.push(row.soupItem2.name);
  return parts.join(" + ");
}

export function buildOfflineSnapshot(input: {
  date: string;
  dayLabel: string;
  sent: boolean;
  total: number;
  departments: DepartmentData[];
  savedAt?: Date;
}): OfflineSnapshot {
  return {
    v: 1,
    date: input.date,
    dayLabel: input.dayLabel,
    savedAt: (input.savedAt ?? new Date()).toISOString(),
    sent: input.sent,
    total: input.total,
    departments: input.departments
      .map((d) => ({
        label: d.label,
        rows: d.rows.filter(hasOrderRowContent).map((r) => ({
          name: r.personName.trim() || "—",
          items: describeRow(r),
          price: r.rowPrice,
        })),
      }))
      .filter((d) => d.rows.length > 0),
  };
}

export function saveOfflineSnapshot(snapshot: OfflineSnapshot): void {
  try {
    localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Plné nebo zakázané úložiště — offline náhled prostě nebude.
  }
}
