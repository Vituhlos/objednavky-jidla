import { describe, expect, it } from "vitest";
import type { Closure } from "@/lib/closures";
import {
  formatClosureRange,
  formatTimestamp,
  getNextAutoSend,
  getSettingsUpdates,
  validateClosureRange,
} from "./settings-utils";

const closure: Closure = {
  id: 1,
  startDate: "2026-08-10",
  endDate: "2026-08-14",
  label: "Dovolená",
  note: "",
  icon: "🏖️",
};

describe("getNextAutoSend", () => {
  it("describes today's send when the configured time is still ahead", () => {
    const mondayMorning = new Date(2026, 7, 3, 9, 0);
    expect(getNextAutoSend("true", "10:30", "Po,St", mondayMorning)).toBe("Dnes v 10:30");
  });

  it("moves to the next enabled day after today's time passed", () => {
    const mondayAfternoon = new Date(2026, 7, 3, 15, 0);
    expect(getNextAutoSend("true", "10:30", "Po,Út", mondayAfternoon)).toBe("Zítra v 10:30");
  });

  it("keeps the existing disabled and incomplete labels", () => {
    expect(getNextAutoSend("false", "10:30", "Po")).toBe("Vypnuto");
    expect(getNextAutoSend("true", "", "Po")).toBe("Nenastaveno");
  });
});

describe("closure helpers", () => {
  it("formats one day, one-year ranges and cross-year ranges", () => {
    expect(formatClosureRange("2026-08-03", "2026-08-03")).toBe("3. 8. 2026");
    expect(formatClosureRange("2026-08-03", "2026-08-07")).toBe("3. 8. – 7. 8. 2026");
    expect(formatClosureRange("2026-12-30", "2027-01-02")).toBe("30. 12. 2026 – 2. 1. 2027");
  });

  it("rejects reversed and overlapping ranges and warns about past ranges", () => {
    expect(validateClosureRange("2026-08-15", "2026-08-14", [], "2026-08-01").error).toContain("dřív");
    expect(validateClosureRange("2026-08-12", "2026-08-15", [closure], "2026-08-01").error).toContain("Dovolená");
    expect(validateClosureRange("2026-07-01", "2026-07-02", [], "2026-08-01").warning).toContain("minulosti");
  });
});

describe("formatTimestamp", () => {
  it("keeps empty and invalid values readable", () => {
    expect(formatTimestamp("")).toBe("—");
    expect(formatTimestamp("není datum")).toBe("není datum");
  });
});

describe("getSettingsUpdates", () => {
  it("maps values, checkboxes, selected days and an optional PIN", () => {
    const data = new FormData();
    data.set("smtpHost", "smtp.example.test");
    data.set("smtpSecure", "on");
    data.set("autoSendDay_Po", "on");
    data.set("autoSendDay_St", "on");
    data.set("imapCheckDay_Út", "on");
    data.set("pizzaCutoffDay_Pá", "on");
    data.set("newPin", " 1234 ");

    const updates = getSettingsUpdates(data);

    expect(updates.smtpHost).toBe("smtp.example.test");
    expect(updates.smtpSecure).toBe("true");
    expect(updates.imapEnabled).toBe("false");
    expect(updates.autoSendDays).toBe("Po,St");
    expect(updates.imapCheckDays).toBe("Út");
    expect(updates.pizzaCutoffDays).toBe("Pá");
    expect(updates.settingsPin).toBe("1234");
  });

  it("does not overwrite the PIN when the field is blank", () => {
    const updates = getSettingsUpdates(new FormData());
    expect(updates).not.toHaveProperty("settingsPin");
  });
});
