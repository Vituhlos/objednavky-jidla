import { describe, expect, it } from "vitest";
import type { DepartmentData, MenuItem, Order, OrderRowEnriched } from "@/lib/types";
import {
  canReopenOrder,
  formatRowCountLabel,
  formatOrderDetailDate,
  formatOrderDetailSentAt,
  getDetailDepartments,
  getDetailRows,
  getRowExtras,
  hasDetailRowContent,
} from "./order-detail-utils";

function menuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 1,
    weekLabel: null,
    day: "Po",
    type: "Jídlo",
    code: "1",
    name: "Svíčková",
    price: 110,
    allergens: "",
    ...overrides,
  };
}

function row(overrides: Partial<OrderRowEnriched> = {}): OrderRowEnriched {
  return {
    id: 1,
    orderId: 10,
    department: "Konstrukce",
    sortOrder: 0,
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

function department(overrides: Partial<DepartmentData> = {}): DepartmentData {
  return {
    name: "Konstrukce",
    label: "Konstrukce",
    emailLabel: "Konstrukce",
    accent: "blue",
    rows: [],
    subtotal: 0,
    ...overrides,
  };
}

const sentOrder: Order = {
  id: 10,
  date: "2026-08-04",
  status: "sent",
  extraEmail: null,
  sentAt: "2026-08-04T06:30:00.000Z",
};

describe("formatOrderDetailDate", () => {
  it("prefixes the Czech weekday and pads the day and month", () => {
    expect(formatOrderDetailDate("2026-08-04")).toBe("Út 04.08.2026");
  });
});

describe("formatOrderDetailSentAt", () => {
  it("falls back to a dash without a timestamp", () => {
    expect(formatOrderDetailSentAt(null)).toBe("–");
  });

  it("renders the timestamp in Prague time", () => {
    expect(formatOrderDetailSentAt("2026-08-04T06:30:00.000Z")).toContain("8:30");
  });
});

describe("hasDetailRowContent", () => {
  it("keeps rows with a name, soup, main course or rolls", () => {
    expect(hasDetailRowContent(row({ personName: "Jan Novák" }))).toBe(true);
    expect(hasDetailRowContent(row({ soupItem: menuItem({ type: "Polévka" }) }))).toBe(true);
    expect(hasDetailRowContent(row({ mainItem: menuItem() }))).toBe(true);
    expect(hasDetailRowContent(row({ rollCount: 2 }))).toBe(true);
  });

  it("drops fully empty rows", () => {
    expect(hasDetailRowContent(row())).toBe(false);
  });
});

describe("getDetailRows and getDetailDepartments", () => {
  it("returns only rows with content", () => {
    const rows = [row({ id: 1, personName: "Jan" }), row({ id: 2 })];

    expect(getDetailRows(department({ rows })).map((item) => item.id)).toEqual([1]);
  });

  it("hides departments whose rows are all empty", () => {
    const filled = department({ name: "Dilna", rows: [row({ personName: "Petr" })] });
    const empty = department({ name: "Kancelare", rows: [row()] });

    expect(getDetailDepartments([filled, empty]).map((item) => item.name)).toEqual(["Dilna"]);
  });
});

describe("getRowExtras", () => {
  it("lists only non-zero side dishes in a stable order", () => {
    expect(
      getRowExtras(row({ rollCount: 1, ketchupCount: 2, bbqCount: 3 })),
    ).toEqual(["Houska ×1", "Kečup ×2", "BBQ ×3"]);
  });

  it("returns nothing without side dishes", () => {
    expect(getRowExtras(row())).toEqual([]);
  });
});

describe("canReopenOrder", () => {
  it("allows reopening a sent order only on its own Prague day", () => {
    expect(canReopenOrder(sentOrder, "2026-08-04")).toBe(true);
    expect(canReopenOrder(sentOrder, "2026-08-05")).toBe(false);
    expect(canReopenOrder({ ...sentOrder, status: "draft" }, "2026-08-04")).toBe(false);
  });
});

describe("formatRowCountLabel", () => {
  it("pluralizes orders in Czech", () => {
    expect(formatRowCountLabel(1)).toBe("1 objednávka");
    expect(formatRowCountLabel(3)).toBe("3 objednávky");
    expect(formatRowCountLabel(7)).toBe("7 objednávek");
  });
});
