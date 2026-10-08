import { describe, expect, it } from "vitest";
import type { DepartmentData, MenuItem, OrderRowEnriched } from "@/lib/types";
import { buildOfflineSnapshot } from "./offline-snapshot";

function item(name: string): MenuItem {
  return { id: 1, weekLabel: null, day: "Po", type: "Jídlo", code: "1", name, price: 110, allergens: "" };
}

function makeRow(id: number, overrides: Partial<OrderRowEnriched> = {}): OrderRowEnriched {
  return {
    id,
    orderId: 1,
    department: "Konstrukce",
    sortOrder: id,
    personName: "",
    soupItemId: null,
    soupItemId2: null,
    mainItemId: null,
    mealCount: 1,
    extraMeals: [],
    rollCount: 0,
    breadDumplingCount: 0,
    potatoDumplingCount: 0,
    ketchupCount: 0,
    tatarkaCount: 0,
    bbqCount: 0,
    note: "",
    soupItem: null,
    soupItem2: null,
    mainItem: null,
    extraMealItems: [],
    rowPrice: 0,
    ...overrides,
  };
}

function makeDept(label: string, rows: OrderRowEnriched[]): DepartmentData {
  return { name: label, label, emailLabel: label, accent: "blue", rows, subtotal: 0 };
}

const base = { date: "2026-10-08", dayLabel: "Čtvrtek 8. 10. 2026", sent: false, total: 250, savedAt: new Date("2026-10-08T09:18:00Z") };

describe("buildOfflineSnapshot", () => {
  it("popíše řádek textem: počet, jídla navíc a polévky", () => {
    const snap = buildOfflineSnapshot({
      ...base,
      departments: [makeDept("Dílna", [
        makeRow(1, {
          personName: " Jakub Vorel ",
          mainItem: item("Svíčková"),
          mealCount: 2,
          extraMealItems: [{ item: item("Burger"), count: 1 }],
          soupItem: item("Gulášová"),
          rowPrice: 250,
        }),
      ])],
    });

    expect(snap).toEqual({
      v: 1,
      date: "2026-10-08",
      dayLabel: "Čtvrtek 8. 10. 2026",
      savedAt: "2026-10-08T09:18:00.000Z",
      sent: false,
      total: 250,
      departments: [{ label: "Dílna", rows: [{ name: "Jakub Vorel", items: "2× Svíčková + Burger + Gulášová", price: 250 }] }],
    });
  });

  it("vynechá prázdné řádky a oddělení bez objednávek", () => {
    const snap = buildOfflineSnapshot({
      ...base,
      departments: [
        makeDept("Konstrukce", [makeRow(1)]),
        makeDept("Kanceláře", [makeRow(2), makeRow(3, { personName: "Roman", mainItem: item("Řízek"), rowPrice: 110 })]),
      ],
    });

    expect(snap.departments).toEqual([
      { label: "Kanceláře", rows: [{ name: "Roman", items: "Řízek", price: 110 }] },
    ]);
  });
});
