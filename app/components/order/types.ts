import type { MealEntry } from "@/lib/types";

/** Pole řádku, která smí editace měnit. Sdílené s `OrderPage`, aby se tvar
 *  nemusel psát na dvou místech a nemohl se rozejít. */
export type RowUpdates = Partial<{
  personName: string;
  soupItemId: number | null;
  soupItemId2: number | null;
  mainItemId: number | null;
  mealCount: number;
  extraMeals: MealEntry[];
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
  ketchupCount: number;
  tatarkaCount: number;
  bbqCount: number;
  note: string;
}>;
