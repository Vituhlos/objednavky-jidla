import { describe, expect, it } from "vitest";
import { getInitials, pluralizeExtras, pluralizeOrders } from "./format";

describe("getInitials", () => {
  it("uses at most two words and handles whitespace", () => {
    expect(getInitials("  Jan   Novák  ")).toBe("JN");
    expect(getInitials("Jan Karel Novák")).toBe("JK");
    expect(getInitials(" ")).toBe("?");
  });
});

describe("pluralizeOrders", () => {
  it.each([
    [0, "objednávek"],
    [1, "objednávka"],
    [2, "objednávky"],
    [4, "objednávky"],
    [5, "objednávek"],
  ])("formats %i as %s", (count, expected) => {
    expect(pluralizeOrders(count)).toBe(expected);
  });
});

describe("pluralizeExtras", () => {
  it("skloňuje podle českých pravidel", () => {
    expect(pluralizeExtras(1)).toBe("příloha");
    expect(pluralizeExtras(2)).toBe("přílohy");
    expect(pluralizeExtras(4)).toBe("přílohy");
    expect(pluralizeExtras(5)).toBe("příloh");
    expect(pluralizeExtras(0)).toBe("příloh");
  });
});

import { countWord, plural, remainingMinutes } from "./format";

describe("plural / countWord", () => {
  it("vybere tvar podle českých pravidel", () => {
    expect(plural(1, "položka", "položky", "položek")).toBe("položka");
    expect(countWord(3, "položka", "položky", "položek")).toBe("3 položky");
    expect(countWord(5, "položka", "položky", "položek")).toBe("5 položek");
    expect(countWord(0, "oběd", "obědy", "obědů")).toBe("0 obědů");
  });
});

describe("remainingMinutes", () => {
  it("shoduje sloveso s číslem", () => {
    expect(remainingMinutes(1)).toBe("zbývá 1 minuta");
    expect(remainingMinutes(3)).toBe("zbývají 3 minuty");
    expect(remainingMinutes(20)).toBe("zbývá 20 minut");
  });
});
