export const PIZZA_BOX_FEE = 20;
export const PIZZA_DELIVERY: Record<number, number> = { 1: 80, 2: 60, 3: 50 };

export interface PizzaTotals {
  baseTotal: number;
  boxTotal: number;
  freeCount: number;
  discountAmount: number;
  deliveryFee: number;
  finalTotal: number;
  pricePerPizza: number;
  personCount: number;
  pricePerPerson: number;
}

export function computePizzaTotals(
  rows: Array<{ pizzaItem: { price: number } | null; count: number }>
): PizzaTotals {
  const active = rows.filter((r) => r.pizzaItem !== null);
  const totalCount = active.reduce((s, r) => s + r.count, 0);
  const personCount = active.length;

  if (totalCount === 0) {
    return { baseTotal: 0, boxTotal: 0, freeCount: 0, discountAmount: 0, deliveryFee: 0, finalTotal: 0, pricePerPizza: 0, personCount: 0, pricePerPerson: 0 };
  }

  const baseTotal = active.reduce((s, r) => s + r.pizzaItem!.price * r.count, 0);
  const boxTotal = totalCount * PIZZA_BOX_FEE;

  const allPricesWithBox: number[] = [];
  for (const r of active) {
    for (let i = 0; i < r.count; i++) {
      allPricesWithBox.push(r.pizzaItem!.price + PIZZA_BOX_FEE);
    }
  }
  // Descending — nejdražší zdarma = maximální úspora
  allPricesWithBox.sort((a, b) => b - a);

  const freeCount = Math.floor(totalCount / 3); // 2+1 zdarma
  const discountAmount = allPricesWithBox.slice(0, freeCount).reduce((s, p) => s + p, 0);
  const deliveryFee = totalCount >= 4 ? 0 : (PIZZA_DELIVERY[totalCount] ?? 0);
  const finalTotal = baseTotal + boxTotal - discountAmount + deliveryFee;
  const pricePerPizza = Math.ceil(finalTotal / totalCount);
  const pricePerPerson = personCount > 0 ? Math.ceil(finalTotal / personCount) : 0;

  return { baseTotal, boxTotal, freeCount, discountAmount, deliveryFee, finalTotal, pricePerPizza, personCount, pricePerPerson };
}
