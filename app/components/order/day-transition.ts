/**
 * Přepnutí dne jako React View Transition: starý obsah odjede, nový přijede.
 *
 * Obal `<ViewTransition update={…}>` kolem obsahu dne dostane třídu animace
 * (`day-slide-*` v globals.css) podle směru posunu.
 *
 * - Jídelníček přepíná den místním stavem: přechodu přidá typ (`DAY_TRANSITION`)
 *   a obal si třídu vybere přes `DAY_SLIDE`.
 * - Objednávky přepínají den navigací. Typ předaný do `router.push` se cestou
 *   občas ztratil (Next 16.4), proto si OrderPage třídu určuje sama z toho,
 *   jestli se vykresluje jiný den, než je na obrazovce.
 */
export const DAY_SLIDE_CLASS = { next: "day-slide-next", prev: "day-slide-prev" } as const;

export const DAY_TRANSITION = { next: "day-next", prev: "day-prev" } as const;

export const DAY_SLIDE = {
  [DAY_TRANSITION.next]: DAY_SLIDE_CLASS.next,
  [DAY_TRANSITION.prev]: DAY_SLIDE_CLASS.prev,
  default: "none",
} as const;
