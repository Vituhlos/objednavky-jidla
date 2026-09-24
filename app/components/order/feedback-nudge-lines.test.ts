import { describe, expect, it } from "vitest";
import { NUDGE_LINES, pickNextLine } from "./feedback-nudge-lines";

describe("pickNextLine", () => {
  it("nikdy nevybere stejnou větu dvakrát po sobě", () => {
    for (let last = 0; last < 30; last++) {
      for (const r of [0, 0.2, 0.5, 0.999999]) {
        expect(pickNextLine(30, last, () => r)).not.toBe(last);
      }
    }
  });

  it("umí vybrat každou větu", () => {
    const seen = new Set<number>();
    for (let k = 0; k < 29; k++) seen.add(pickNextLine(30, 5, () => k / 29));
    expect(seen.size).toBe(29);
    expect(seen.has(5)).toBe(false);
  });

  it("bez minulé věty nebo s neplatnou vybere cokoli v rozsahu", () => {
    expect(pickNextLine(30, null, () => 0.999999)).toBe(29);
    expect(pickNextLine(30, 99, () => 0)).toBe(0);
    expect(pickNextLine(1, 0)).toBe(0);
  });
});

describe("NUDGE_LINES", () => {
  it("má 30 neprázdných vět bez duplicit", () => {
    expect(NUDGE_LINES).toHaveLength(30);
    expect(new Set(NUDGE_LINES.map((l) => l.lead)).size).toBe(30);
    for (const l of NUDGE_LINES) {
      expect(l.lead.trim()).not.toBe("");
      expect(l.rest.trim()).not.toBe("");
    }
  });
});
