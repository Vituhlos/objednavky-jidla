import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";

export type HistoryRecord = {
  id: number;
  date: string;
  status: "draft" | "sent";
  sentAt: string | null;
  rowCount: number;
  extraEmail?: string | null;
  href: string;
};

export function formatHistoryDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function formatHistorySentAt(iso: string | null): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toLunchHistoryRecords(orders: OrderSummary[]): HistoryRecord[] {
  return orders.map((order) => ({
    ...order,
    href: `/historie/${order.id}`,
  }));
}

export function toPizzaHistoryRecords(orders: PizzaOrderSummary[]): HistoryRecord[] {
  return orders.map((order) => ({
    ...order,
    href: `/historie/pizza/${order.id}`,
  }));
}

export function filterHistoryRecords(
  records: HistoryRecord[],
  query: string,
  hideEmpty: boolean,
): HistoryRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("cs-CZ");

  return records.filter((record) => {
    if (hideEmpty && record.status !== "sent" && record.rowCount === 0) {
      return false;
    }

    if (!normalizedQuery) return true;

    return (
      formatHistoryDate(record.date).includes(normalizedQuery) ||
      (record.extraEmail ?? "").toLocaleLowerCase("cs-CZ").includes(normalizedQuery)
    );
  });
}

export function countVisibleHistoryRecords(
  records: HistoryRecord[],
  hideEmpty: boolean,
): number {
  return filterHistoryRecords(records, "", hideEmpty).length;
}

export function countSentHistoryRecords(records: HistoryRecord[]): number {
  return records.filter((record) => record.status === "sent").length;
}

export function formatHistoryRecordCount(count: number): string {
  if (count === 1) return "1 záznam";
  if (count >= 2 && count <= 4) return `${count} záznamy`;
  return `${count} záznamů`;
}

export function formatHistoryRecordTotal(count: number): string {
  return `${count} ${count === 1 ? "záznamu" : "záznamů"}`;
}

export function formatSentLunchCount(count: number): string {
  if (count === 1) return "1 odeslaný oběd";
  if (count >= 2 && count <= 4) return `${count} odeslané obědy`;
  return `${count} odeslaných obědů`;
}

export function formatSentPizzaCount(count: number): string {
  if (count === 1) return "1 odeslaná pizza";
  if (count >= 2 && count <= 4) return `${count} odeslané pizzy`;
  return `${count} odeslaných pizz`;
}
