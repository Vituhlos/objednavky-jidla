import type { DepartmentData, Order, OrderRowEnriched } from "@/lib/types";

const DAYS_CS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

export function formatOrderDetailDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = DAYS_CS[new Date(year, month - 1, day).getDay()];

  return `${weekday} ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

export function formatOrderDetailSentAt(iso: string | null): string {
  if (!iso) return "–";

  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Mirrors the row visibility rule the legacy read-only detail used. It is
 * deliberately narrower than `hasOrderRowContent()` from `lib/order-utils`;
 * see `docs/MIGRATION-HANDOFF.md` for the open follow-up.
 */
export function hasDetailRowContent(row: OrderRowEnriched): boolean {
  return Boolean(row.personName || row.soupItem || row.mainItem || row.rollCount > 0);
}

export function getDetailRows(department: DepartmentData): OrderRowEnriched[] {
  return department.rows.filter(hasDetailRowContent);
}

export function getDetailDepartments(departments: DepartmentData[]): DepartmentData[] {
  return departments.filter((department) => department.rows.some(hasDetailRowContent));
}

export function getRowExtras(row: OrderRowEnriched): string[] {
  const extras: string[] = [];

  if (row.rollCount > 0) extras.push(`Houska ×${row.rollCount}`);
  if (row.breadDumplingCount > 0) extras.push(`H. kned. ×${row.breadDumplingCount}`);
  if (row.potatoDumplingCount > 0) extras.push(`B. kned. ×${row.potatoDumplingCount}`);
  if (row.ketchupCount > 0) extras.push(`Kečup ×${row.ketchupCount}`);
  if (row.tatarkaCount > 0) extras.push(`Tatarka ×${row.tatarkaCount}`);
  if (row.bbqCount > 0) extras.push(`BBQ ×${row.bbqCount}`);

  return extras;
}

export function canReopenOrder(order: Order, todayISO: string): boolean {
  return order.status === "sent" && order.date === todayISO;
}

export function formatRowCountLabel(rowCount: number): string {
  if (rowCount === 1) return "1 objednávka";
  if (rowCount >= 2 && rowCount <= 4) return `${rowCount} objednávky`;

  return `${rowCount} objednávek`;
}
