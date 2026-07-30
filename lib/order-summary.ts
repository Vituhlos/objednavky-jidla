import type { OrderData, OrderRowEnriched } from "./types";
import { hasOrderRowContent } from "./order-utils";
import { escapeHtml } from "./telegram";

// One place that knows how to describe an order.
//
// Before this existed every channel counted for itself — the bot showed one soup and
// one meal per person, /souhrn showed no soup at all, and the four "objednávka
// odeslána" messages reported three different numbers in two different units. Second
// soups, extra meals, portion counts and side dishes existed in the model but reached
// almost none of them. New fields now only have to be added here.

export interface OrderTotals {
  people: number;
  meals: number;   // portions, including extra meals
  soups: number;
  sides: number;
  price: number;
}

export function summarizeOrder(data: OrderData): OrderTotals {
  const rows = data.departments.flatMap((d) => d.rows).filter(hasOrderRowContent);
  let meals = 0;
  let soups = 0;
  let sides = 0;
  for (const row of rows) {
    if (row.mainItem) meals += row.mealCount || 1;
    meals += row.extraMealItems.reduce((sum, e) => sum + e.count, 0);
    if (row.soupItem) soups += 1;
    if (row.soupItem2) soups += 1;
    sides +=
      row.rollCount + row.breadDumplingCount + row.potatoDumplingCount +
      row.ketchupCount + row.tatarkaCount + row.bbqCount;
  }
  return {
    people: rows.filter((r) => r.personName).length,
    meals,
    soups,
    sides,
    price: data.totalPrice,
  };
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

// "6 osob · 7 jídel · 3 polévky · 1 160 Kč" — the same line everywhere, so the number
// can't disagree between a manual send and an automatic one.
export function formatOrderTotals(data: OrderData): string {
  const t = summarizeOrder(data);
  const parts = [`👥 ${t.people} ${plural(t.people, "osoba", "osoby", "osob")}`];
  if (t.meals > 0) parts.push(`🍽 ${t.meals} ${plural(t.meals, "jídlo", "jídla", "jídel")}`);
  if (t.soups > 0) parts.push(`🍲 ${t.soups} ${plural(t.soups, "polévka", "polévky", "polévek")}`);
  if (t.sides > 0) parts.push(`🥖 ${t.sides} ${plural(t.sides, "příloha", "přílohy", "příloh")}`);
  parts.push(`💰 ${t.price} Kč`);
  return parts.join("  ·  ");
}

// Everything one person ordered, HTML-escaped and ready for a Telegram message.
// Portions show as "2× Svíčková"; a second soup and extra meals are no longer dropped.
export function describeRowItems(row: OrderRowEnriched): string[] {
  const parts: string[] = [];
  if (row.soupItem) parts.push(`🍲 ${escapeHtml(row.soupItem.name)}`);
  if (row.soupItem2) parts.push(`🍲 ${escapeHtml(row.soupItem2.name)}`);
  if (row.mainItem) {
    const count = row.mealCount > 1 ? `${row.mealCount}× ` : "";
    parts.push(`<i>${count}${escapeHtml(row.mainItem.name)}</i>`);
  }
  for (const extra of row.extraMealItems) {
    const count = extra.count > 1 ? `${extra.count}× ` : "";
    parts.push(`<i>${count}${escapeHtml(extra.item.name)}</i>`);
  }

  const sides: string[] = [];
  const addSide = (count: number, label: string) => { if (count > 0) sides.push(`${count}× ${label}`); };
  addSide(row.rollCount, "rohlík");
  addSide(row.breadDumplingCount, "hous. knedlík");
  addSide(row.potatoDumplingCount, "bram. knedlík");
  addSide(row.ketchupCount, "kečup");
  addSide(row.tatarkaCount, "tatarka");
  addSide(row.bbqCount, "BBQ");
  if (sides.length > 0) parts.push(`🥖 ${sides.join(", ")}`);

  return parts;
}

// Compact codes for the /souhrn table: soup codes + meal codes, e.g. "A / 2,3"
export function describeRowCodes(row: OrderRowEnriched): string {
  const soups = [row.soupItem, row.soupItem2].filter(Boolean).map((i) => i!.code);
  const meals = [
    ...(row.mainItem ? [row.mainItem.code] : []),
    ...row.extraMealItems.map((e) => e.item.code),
  ];
  if (soups.length === 0 && meals.length === 0) return "—";
  return `${soups.join(",") || "—"} / ${meals.join(",") || "—"}`;
}
