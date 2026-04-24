import type { OrderRow, MenuItem } from "./types";

export const EXTRAS_PRICES = {
  roll: 5,
  breadDumpling: 40,
  potatoDumpling: 45,
  ketchup: 20,
  tatarka: 20,
  bbq: 20,
} as const;

export const EXTRAS_LABELS: Record<keyof typeof EXTRAS_PRICES, string> = {
  roll: "Houska",
  breadDumpling: "Houskový knedlík",
  potatoDumpling: "Bramborový knedlík",
  ketchup: "Kečup",
  tatarka: "Tatarka",
  bbq: "BBQ omáčka",
};

export const EXTRAS_ROW_FIELDS: Array<{
  field: keyof typeof EXTRAS_PRICES;
  rowKey: keyof Pick<
    OrderRow,
    | "rollCount"
    | "breadDumplingCount"
    | "potatoDumplingCount"
    | "ketchupCount"
    | "tatarkaCount"
    | "bbqCount"
  >;
  label: string;
  price: number;
}> = [
  {
    field: "breadDumpling",
    rowKey: "breadDumplingCount",
    label: "Houskový knedlík",
    price: EXTRAS_PRICES.breadDumpling,
  },
  {
    field: "potatoDumpling",
    rowKey: "potatoDumplingCount",
    label: "Bramborový knedlík",
    price: EXTRAS_PRICES.potatoDumpling,
  },
  {
    field: "ketchup",
    rowKey: "ketchupCount",
    label: "Kečup",
    price: EXTRAS_PRICES.ketchup,
  },
  {
    field: "tatarka",
    rowKey: "tatarkaCount",
    label: "Tatarka",
    price: EXTRAS_PRICES.tatarka,
  },
  {
    field: "bbq",
    rowKey: "bbqCount",
    label: "BBQ omáčka",
    price: EXTRAS_PRICES.bbq,
  },
  {
    field: "roll",
    rowKey: "rollCount",
    label: "Houska",
    price: EXTRAS_PRICES.roll,
  },
];

export function computeRowPrice(
  row: Pick<
    OrderRow,
    | "rollCount"
    | "breadDumplingCount"
    | "potatoDumplingCount"
    | "ketchupCount"
    | "tatarkaCount"
    | "bbqCount"
  >,
  soup: MenuItem | null,
  main: MenuItem | null,
  soupPrice?: number,
  mealPrice?: number
): number {
  let price = 0;
  if (soup) price += soupPrice ?? soup.price;
  if (main) price += mealPrice ?? main.price;
  price += row.rollCount * EXTRAS_PRICES.roll;
  price += row.breadDumplingCount * EXTRAS_PRICES.breadDumpling;
  price += row.potatoDumplingCount * EXTRAS_PRICES.potatoDumpling;
  price += row.ketchupCount * EXTRAS_PRICES.ketchup;
  price += row.tatarkaCount * EXTRAS_PRICES.tatarka;
  price += row.bbqCount * EXTRAS_PRICES.bbq;
  return price;
}
