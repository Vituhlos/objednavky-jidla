import { describe, expect, it } from "vitest";
import type { DepartmentData, OrderRowEnriched } from "@/lib/types";
import {
  addDays,
  buildPickerItems,
  daysBetween,
  dayOfWeek,
  formatClosureHeadline,
  formatDayPhrase,
  formatGapLabel,
  getDayLabel,
  getFutureDayPhrase,
  parseCutoffMinutes,
  patchRow,
  recalcDepartments,
  shortDate,
} from "./order-utils";

// Reference dates, all verified against the calendar:
// 2026-08-03 Mon · 08-05 Wed · 08-07 Fri · 08-08 Sat · 08-09 Sun · 08-10 Mon · 08-14 Fri

describe("addDays", () => {
  it("rolls over the end of a month", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("rolls over the end of a year", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("walks backwards", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("keeps two-digit padding", () => {
    expect(addDays("2026-01-05", 0)).toBe("2026-01-05");
  });

  it("survives the spring DST switch", () => {
    // 2026-03-29 is a 23-hour day in Prague — plain ms arithmetic would land a day short
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });
});

describe("daysBetween", () => {
  it("counts across a month boundary", () => {
    expect(daysBetween("2026-07-31", "2026-08-03")).toBe(3);
  });

  it("counts across the spring DST switch", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("is zero for the same day and negative backwards", () => {
    expect(daysBetween("2026-08-03", "2026-08-03")).toBe(0);
    expect(daysBetween("2026-08-05", "2026-08-03")).toBe(-2);
  });
});

describe("dayOfWeek / shortDate", () => {
  it("returns Sunday as 0 and Monday as 1", () => {
    expect(dayOfWeek("2026-08-09")).toBe(0);
    expect(dayOfWeek("2026-08-10")).toBe(1);
  });

  it("drops leading zeros from the date", () => {
    expect(shortDate("2026-08-03")).toBe("3. 8.");
  });
});

describe("getDayLabel", () => {
  it("names today and tomorrow instead of dating them", () => {
    expect(getDayLabel("2026-08-05", "2026-08-05")).toBe("Dnes");
    expect(getDayLabel("2026-08-06", "2026-08-05")).toBe("Zítra");
  });

  it("falls back to a capitalised weekday plus date", () => {
    expect(getDayLabel("2026-08-10", "2026-08-05")).toBe("Po 10.8.");
  });
});

describe("parseCutoffMinutes", () => {
  it("converts HH:MM into minutes since midnight", () => {
    expect(parseCutoffMinutes("08:00")).toBe(480);
    expect(parseCutoffMinutes("08:30")).toBe(510);
    expect(parseCutoffMinutes("00:00")).toBe(0);
  });
});

describe("formatGapLabel", () => {
  it("prints a single closed day", () => {
    expect(formatGapLabel("2026-08-03", "2026-08-03")).toBe("3. 8.");
  });

  it("prints the month once when both ends share it", () => {
    expect(formatGapLabel("2026-08-03", "2026-08-07")).toBe("3.–7. 8.");
  });

  it("prints both months when the stretch crosses one", () => {
    expect(formatGapLabel("2026-07-31", "2026-08-03")).toBe("31. 7. – 3. 8.");
  });
});

describe("buildPickerItems", () => {
  it("renders every open day as its own chip", () => {
    const items = buildPickerItems(["2026-08-05", "2026-08-06", "2026-08-07"], [], []);

    expect(items).toEqual([
      { kind: "day", date: "2026-08-05" },
      { kind: "day", date: "2026-08-06" },
      { kind: "day", date: "2026-08-07" },
    ]);
  });

  it("keeps a closure spanning a weekend as one marker", () => {
    // Fri 07 and Mon 10 are 3 days apart — the weekend must not split the stretch
    const items = buildPickerItems(
      ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", "2026-08-11"],
      ["2026-08-07", "2026-08-10"],
      []
    );

    expect(items).toEqual([
      { kind: "day", date: "2026-08-05" },
      { kind: "day", date: "2026-08-06" },
      { kind: "gap", from: "2026-08-07", to: "2026-08-10", icon: null },
      { kind: "day", date: "2026-08-11" },
    ]);
  });

  it("splits two closures more than three days apart", () => {
    const items = buildPickerItems(
      ["2026-08-05", "2026-08-11", "2026-08-12"],
      ["2026-08-05", "2026-08-11"],
      []
    );

    expect(items).toEqual([
      { kind: "gap", from: "2026-08-05", to: "2026-08-05", icon: null },
      { kind: "gap", from: "2026-08-11", to: "2026-08-11", icon: null },
      { kind: "day", date: "2026-08-12" },
    ]);
  });

  it("puts a closed today inside the gap rather than beside it", () => {
    // The strip must not show a struck-through "Dnes" chip next to a marker
    // whose range starts tomorrow — both would describe the same shutdown.
    const items = buildPickerItems(
      ["2026-08-07", "2026-08-10", "2026-08-11"],
      ["2026-08-07", "2026-08-10"],
      []
    );

    expect(items).toEqual([
      { kind: "gap", from: "2026-08-07", to: "2026-08-10", icon: null },
      { kind: "day", date: "2026-08-11" },
    ]);
  });

  it("takes the icon from the closure covering the start of the stretch", () => {
    const items = buildPickerItems(
      ["2026-08-05", "2026-08-06"],
      ["2026-08-05"],
      [{ startDate: "2026-08-04", endDate: "2026-08-06", icon: "🏖️" }]
    );

    expect(items[0]).toEqual({ kind: "gap", from: "2026-08-05", to: "2026-08-05", icon: "🏖️" });
  });

  it("leaves the icon null for a day toggled closed by hand", () => {
    const items = buildPickerItems(
      ["2026-08-05", "2026-08-06"],
      ["2026-08-05"],
      [{ startDate: "2026-09-01", endDate: "2026-09-05", icon: "🎄" }]
    );

    expect(items[0]).toMatchObject({ kind: "gap", icon: null });
  });
});

describe("formatClosureHeadline", () => {
  it("uses the relative phrase when the closure covers all of next week", () => {
    // today Wed 08-05 → next week is Mon 08-10 through Fri 08-14
    expect(formatClosureHeadline("2026-08-10", "2026-08-14", "2026-08-05")).toBe("Příští týden se nevaří");
  });

  it("counts next week from the following Monday when today is a Monday", () => {
    // the `|| 7` guard — without it "next Monday" would resolve to today
    expect(formatClosureHeadline("2026-08-10", "2026-08-14", "2026-08-03")).toBe("Příští týden se nevaří");
    expect(formatClosureHeadline("2026-08-03", "2026-08-07", "2026-08-03")).not.toBe("Příští týden se nevaří");
  });

  it("counts next week as starting tomorrow when today is a Sunday", () => {
    expect(formatClosureHeadline("2026-08-10", "2026-08-14", "2026-08-09")).toBe("Příští týden se nevaří");
  });

  it("capitalises the preposition for a single closed day", () => {
    expect(formatClosureHeadline("2026-08-05", "2026-08-05", "2026-08-03")).toBe("Ve středu 5. 8. se nevaří");
  });

  it("falls back to an explicit range", () => {
    expect(formatClosureHeadline("2026-08-05", "2026-08-07", "2026-08-03")).toBe("Od 5. 8. do 7. 8. se nevaří");
  });
});

describe("formatDayPhrase", () => {
  it("keeps the preposition by default", () => {
    expect(formatDayPhrase("2026-08-05")).toBe("ve středu 5. 8.");
    expect(formatDayPhrase("2026-08-07")).toBe("v pátek 7. 8.");
  });

  it("strips both one- and two-letter prepositions when asked", () => {
    expect(formatDayPhrase("2026-08-05", false)).toBe("středu 5. 8.");
    expect(formatDayPhrase("2026-08-07", false)).toBe("pátek 7. 8.");
  });
});

describe("getFutureDayPhrase", () => {
  it("says tomorrow rather than naming the weekday", () => {
    expect(getFutureDayPhrase("2026-08-10", "2026-08-09")).toBe("zítra");
  });

  it("names the weekday for anything further out", () => {
    expect(getFutureDayPhrase("2026-08-10", "2026-08-05")).toBe("v pondělí");
    expect(getFutureDayPhrase("2026-08-05", "2026-08-03")).toBe("ve středu");
  });
});

// ── Přepočet oddělení ─────────────────────────────────────

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

function makeDept(name: string, rows: OrderRowEnriched[], subtotal = 0): DepartmentData {
  return { name, label: name, emailLabel: name, accent: "blue", rows, subtotal };
}

describe("recalcDepartments", () => {
  it("sums only rows that carry content", () => {
    // an empty row still holds a stale rowPrice; it must not reach the subtotal
    const dept = makeDept("Konstrukce", [
      makeRow(1, { personName: "Novák", rowPrice: 140 }),
      makeRow(2, { rowPrice: 999 }),
    ]);

    expect(recalcDepartments([dept])[0].subtotal).toBe(140);
  });

  it("returns zero for a department with no content", () => {
    expect(recalcDepartments([makeDept("Dílna", [makeRow(1)], 500)])[0].subtotal).toBe(0);
  });

  it("does not mutate the input", () => {
    const dept = makeDept("Konstrukce", [makeRow(1, { personName: "Novák", rowPrice: 140 })], 0);

    recalcDepartments([dept]);

    expect(dept.subtotal).toBe(0);
  });
});

describe("patchRow", () => {
  it("replaces the matching row and recomputes its department", () => {
    const departments = [
      makeDept("Konstrukce", [makeRow(1, { personName: "Novák", rowPrice: 140 }), makeRow(2)], 140),
      makeDept("Dílna", [makeRow(3, { personName: "Svoboda", rowPrice: 110 })], 110),
    ];

    const result = patchRow(departments, 1, makeRow(1, { personName: "Novák", rowPrice: 200 }));

    expect(result[0].rows[0].rowPrice).toBe(200);
    expect(result[0].subtotal).toBe(200);
    expect(result[1].subtotal).toBe(110);
  });

  it("leaves everything alone when no row matches", () => {
    const departments = [makeDept("Konstrukce", [makeRow(1, { personName: "Novák", rowPrice: 140 })], 140)];

    const result = patchRow(departments, 99, makeRow(99, { rowPrice: 500 }));

    expect(result[0].rows).toHaveLength(1);
    expect(result[0].subtotal).toBe(140);
  });
});
