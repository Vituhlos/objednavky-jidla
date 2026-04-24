import type { DepartmentData, OrderRowEnriched } from "./types";

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
