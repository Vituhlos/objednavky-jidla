import { describe, expect, it } from "vitest";
import {
  countSentHistoryRecords,
  countVisibleHistoryRecords,
  filterHistoryRecords,
  formatHistoryDate,
  formatHistorySentAt,
  toLunchHistoryRecords,
  toPizzaHistoryRecords,
  type HistoryRecord,
} from "./history-utils";

const records: HistoryRecord[] = [
  {
    id: 1,
    date: "2026-08-04",
    status: "sent",
    sentAt: "2026-08-04T08:30:00.000Z",
    rowCount: 3,
    extraEmail: "Kuchyne@Example.cz",
    href: "/historie/1",
  },
  {
    id: 2,
    date: "2026-08-05",
    status: "draft",
    sentAt: null,
    rowCount: 0,
    extraEmail: null,
    href: "/historie/2",
  },
  {
    id: 3,
    date: "2026-08-06",
    status: "draft",
    sentAt: null,
    rowCount: 2,
    extraEmail: null,
    href: "/historie/3",
  },
];

describe("history helpers", () => {
  it("keeps the existing Czech date and sent-time presentation", () => {
    expect(formatHistoryDate("2026-08-04")).toBe("04.08.2026");
    expect(formatHistorySentAt(null)).toBe("–");
    expect(formatHistorySentAt("2026-08-04T08:30:00.000Z")).toContain("4. 8. 2026");
  });

  it("hides only empty drafts when the filter is enabled", () => {
    expect(filterHistoryRecords(records, "", true).map((record) => record.id)).toEqual([1, 3]);
    expect(filterHistoryRecords(records, "", false)).toHaveLength(3);
  });

  it("searches formatted dates and lunch extra e-mail case-insensitively", () => {
    expect(filterHistoryRecords(records, "04.08.2026", false).map((record) => record.id)).toEqual([1]);
    expect(filterHistoryRecords(records, "kuchyne@example.cz", false).map((record) => record.id)).toEqual([1]);
  });

  it("counts sent records independently of active filters", () => {
    expect(countSentHistoryRecords(records)).toBe(1);
  });

  it("counts what the empty-draft filter leaves visible", () => {
    expect(countVisibleHistoryRecords(records, true)).toBe(2);
    expect(countVisibleHistoryRecords(records, false)).toBe(3);
  });

  it("routes lunch and pizza records to their own detail pages", () => {
    const lunch = { id: 1, date: "2026-08-04", status: "sent" as const, sentAt: null, extraEmail: null, rowCount: 3 };
    const pizza = { id: 1, date: "2026-08-04", status: "sent" as const, sentAt: null, rowCount: 3 };

    expect(toLunchHistoryRecords([lunch]).at(0)?.href).toBe("/historie/1");
    expect(toPizzaHistoryRecords([pizza]).at(0)?.href).toBe("/historie/pizza/1");
  });
});
