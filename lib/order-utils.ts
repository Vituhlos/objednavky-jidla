import type { DepartmentData, OrderRowEnriched, OrderData } from "./types";

export function hasOrderRowContent(row: OrderRowEnriched): boolean {
  return Boolean(
    row.personName ||
      row.soupItem ||
      row.soupItem2 ||
      row.mainItem ||
      row.extraMealItems.length > 0 ||
      row.rollCount > 0 ||
      row.breadDumplingCount > 0 ||
      row.potatoDumplingCount > 0 ||
      row.ketchupCount > 0 ||
      row.tatarkaCount > 0 ||
      row.bbqCount > 0
  );
}

export function getActiveRows(rows: OrderRowEnriched[]): OrderRowEnriched[] {
  return rows.filter(hasOrderRowContent);
}

export function isDepartmentActive(department: DepartmentData): boolean {
  return department.rows.some(hasOrderRowContent);
}

export function hasSubmittedOrderContent(row: OrderRowEnriched): boolean {
  return Boolean(
    row.soupItem ||
      row.soupItem2 ||
      row.mainItem ||
      row.extraMealItems.length > 0 ||
      row.rollCount > 0 ||
      row.breadDumplingCount > 0 ||
      row.potatoDumplingCount > 0 ||
      row.ketchupCount > 0 ||
      row.tatarkaCount > 0 ||
      row.bbqCount > 0
  );
}

export function getSubmittedRows(rows: OrderRowEnriched[]): OrderRowEnriched[] {
  return rows.filter(hasSubmittedOrderContent);
}

export function isDepartmentSubmitted(department: DepartmentData): boolean {
  return department.rows.some(hasSubmittedOrderContent);
}

export function joinDepartmentNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} a ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} a ${names[names.length - 1]}`;
}

// Flattens OrderData into a list of submitted rows suitable for Telegram
// personalisation: one entry per row with personName + a single-line description.
export function flattenSubmittedRows(data: OrderData): Array<{ personName: string; description: string; price: number }> {
  const out: Array<{ personName: string; description: string; price: number }> = [];
  for (const dept of data.departments) {
    for (const row of dept.rows) {
      if (!hasSubmittedOrderContent(row) || !row.personName.trim()) continue;
      const parts: string[] = [];
      if (row.mainItem) {
        const count = row.mealCount > 1 ? `${row.mealCount}× ` : "";
        parts.push(`${count}${row.mainItem.name}`);
      }
      for (const em of row.extraMealItems) {
        parts.push(`${em.count > 1 ? `${em.count}× ` : ""}${em.item.name}`);
      }
      if (row.soupItem) parts.push(`polévka ${row.soupItem.name}`);
      if (row.soupItem2) parts.push(row.soupItem2.name);
      if (row.rollCount > 0) parts.push(`houska ×${row.rollCount}`);
      if (row.breadDumplingCount > 0) parts.push(`h.knedlík ×${row.breadDumplingCount}`);
      if (row.potatoDumplingCount > 0) parts.push(`b.knedlík ×${row.potatoDumplingCount}`);
      out.push({
        personName: row.personName,
        description: parts.length > 0 ? parts.join(" + ") : "(prázdná objednávka)",
        price: row.rowPrice,
      });
    }
  }
  return out;
}
