// Logika přehledu historie objednávek.
//
// Podmnožina toho, co má větev feat/heroui-migration — názvy i chování jsou
// shodné, ale řazení (`sortHistoryRecords`, `HistorySortDescriptor`) a
// popisky typu „3 záznamy" tady chybí, protože zdejší tabulka se neřadí
// a ty texty nemá kde zobrazit. Až se bude slučovat, přibydou spolu s nimi.

import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";

/** Oběd i pizza v jednom tvaru — liší se jen cílovým odkazem. */
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

/**
 * Skrytí prázdných konceptů a hledání v jednom průchodu.
 *
 * Hledá se v **zobrazeném** datu, ne v ISO tvaru — uživatel píše „04.08",
 * jak to vidí v tabulce. U pizzy `extraEmail` neexistuje, takže se ta část
 * podmínky nikdy netrefí a nic to nerozbije.
 */
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

/** Počet odeslaných — záměrně bez ohledu na zapnuté filtry. */
export function countSentHistoryRecords(records: HistoryRecord[]): number {
  return records.filter((record) => record.status === "sent").length;
}
