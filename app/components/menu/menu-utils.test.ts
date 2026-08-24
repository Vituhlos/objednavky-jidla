import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/lib/types";
import {
  describeDay,
  describeWeekName,
  resolveActiveDay,
  weekDayDates,
} from "./menu-utils";

const emptyDay = { soups: [] as MenuItem[], meals: [] as MenuItem[] };

function item(name: string, overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 1,
    weekLabel: null,
    day: "Po",
    type: "Jídlo",
    code: "1",
    name,
    price: 110,
    allergens: "",
    ...overrides,
  };
}

describe("resolveActiveDay", () => {
  it("ponechá vybraný den, dokud v menu zůstává", () => {
    const menu = { Po: emptyDay, St: emptyDay };

    expect(resolveActiveDay(menu, "Po", "St")).toBe("St");
  });

  it("dá přednost dnešku, když už vybraný den není k dispozici", () => {
    const menu = { Po: emptyDay, St: emptyDay };

    expect(resolveActiveDay(menu, "St", "Pá")).toBe("St");
  });

  it("spadne na první dostupný pracovní den", () => {
    const menu = { Út: emptyDay, Čt: emptyDay };

    expect(resolveActiveDay(menu, null)).toBe("Út");
  });

  it("u prázdného menu spadne na pondělí", () => {
    expect(resolveActiveDay({}, null)).toBe("Po");
  });
});

describe("describeDay", () => {
  it("den se zástupnou položkou „Zavřeno“ je uzavřený a nic nevypisuje", () => {
    const view = describeDay({
      soups: [item("Zavřeno", { type: "Polévka" })],
      meals: [item("Zavřeno")],
    });

    expect(view.isClosed).toBe(true);
    expect(view.soups).toHaveLength(0);
    expect(view.meals).toHaveLength(0);
    expect(view.hasItems).toBe(false);
  });

  it("prázdný den není uzavřený, jen nezadaný", () => {
    expect(describeDay(emptyDay).isClosed).toBe(false);
    expect(describeDay(undefined).isClosed).toBe(false);
  });

  it("smíšený den zůstává otevřený a „Zavřeno“ z výpisu vypadne", () => {
    const view = describeDay({
      soups: [item("Zavřeno", { type: "Polévka" })],
      meals: [item("Svíčková"), item("Guláš", { id: 2 })],
    });

    expect(view.isClosed).toBe(false);
    expect(view.soups).toHaveLength(0);
    expect(view.meals.map((meal) => meal.name)).toEqual(["Svíčková", "Guláš"]);
    expect(view.hasItems).toBe(true);
  });
});

describe("weekDayDates", () => {
  it("rozpočítá pondělní datum na celý pracovní týden", () => {
    expect(weekDayDates("2026-08-24")).toEqual({ Po: 24, Út: 25, St: 26, Čt: 27, Pá: 28 });
  });

  it("přeteče přes konec měsíce", () => {
    expect(weekDayDates("2026-08-31")).toEqual({ Po: 31, Út: 1, St: 2, Čt: 3, Pá: 4 });
  });
});

describe("describeWeekName", () => {
  it("příští týden se skloní", () => {
    expect(describeWeekName("Příští týden")).toBe("příští týden");
  });

  it("ostatní týdny dostanou předložku", () => {
    expect(describeWeekName("32")).toBe("týden 32");
  });
});
