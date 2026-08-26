import { describe, expect, it } from "vitest";
import { isWeeklyCutoffLocked } from "./cutoff";

describe("týdenní uzávěrka", () => {
  const friday = new Date(2026, 7, 28, 10, 0);

  it("zamkne přesně v nastavený čas v povolený den", () => {
    expect(
      isWeeklyCutoffLocked({
        enabled: true,
        cutoffTime: "10:00",
        cutoffDays: "Pá",
        now: friday,
      })
    ).toBe(true);
  });

  it("před časem, mimo povolený den a při vypnutí zůstane otevřená", () => {
    expect(
      isWeeklyCutoffLocked({
        enabled: true,
        cutoffTime: "10:01",
        cutoffDays: "Pá",
        now: friday,
      })
    ).toBe(false);
    expect(
      isWeeklyCutoffLocked({
        enabled: true,
        cutoffTime: "09:00",
        cutoffDays: "Po,Út",
        now: friday,
      })
    ).toBe(false);
    expect(
      isWeeklyCutoffLocked({
        enabled: false,
        cutoffTime: "09:00",
        cutoffDays: "Pá",
        now: friday,
      })
    ).toBe(false);
  });

  it("neplatný čas fail-safe neuzamkne provoz", () => {
    expect(
      isWeeklyCutoffLocked({
        enabled: true,
        cutoffTime: "25:99",
        cutoffDays: "Pá",
        now: friday,
      })
    ).toBe(false);
  });
});
