import type { OrderRow, MenuItem } from "./types";

export const EXTRAS_PRICES_DEFAULT = {
  roll: 5,
  breadDumpling: 40,
  potatoDumpling: 45,
  ketchup: 20,
  tatarka: 20,
  bbq: 20,
} as const;

export type ExtrasPrices = { roll: number; breadDumpling: number; potatoDumpling: number; ketchup: number; tatarka: number; bbq: number };

/** @deprecated use EXTRAS_PRICES_DEFAULT */
export const EXTRAS_PRICES = EXTRAS_PRICES_DEFAULT;

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
    | "mealCount"
    | "mealCount2"
    | "rollCount"
    | "breadDumplingCount"
    | "potatoDumplingCount"
    | "ketchupCount"
    | "tatarkaCount"
    | "bbqCount"
  >,
  soup: MenuItem | null,
  main: MenuItem | null,
  main2: MenuItem | null,
  soupPrice?: number,
  mealPrice?: number,
  ep?: Partial<ExtrasPrices>
): number {
  const d = EXTRAS_PRICES_DEFAULT;
  let price = 0;
  if (soup) price += soupPrice ?? soup.price;
  if (main) price += (mealPrice ?? main.price) * (row.mealCount || 1);
  if (main2) price += (mealPrice ?? main2.price) * (row.mealCount2 || 1);
  price += row.rollCount * (ep?.roll ?? d.roll);
  price += row.breadDumplingCount * (ep?.breadDumpling ?? d.breadDumpling);
  price += row.potatoDumplingCount * (ep?.potatoDumpling ?? d.potatoDumpling);
  price += row.ketchupCount * (ep?.ketchup ?? d.ketchup);
  price += row.tatarkaCount * (ep?.tatarka ?? d.tatarka);
  price += row.bbqCount * (ep?.bbq ?? d.bbq);
  return price;
}
