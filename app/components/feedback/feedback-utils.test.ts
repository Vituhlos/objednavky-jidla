import { describe, expect, it } from "vitest";
import { formatFeedbackDate, insertStarter, parseDraft, pluralizeChanges } from "./feedback-utils";

describe("insertStarter", () => {
  it("do prázdného pole vloží začátek bez tří teček a s mezerou", () => {
    expect(insertStarter("", "Chybí mi…")).toBe("Chybí mi ");
  });

  it("rozepsaný text nepřepíše, začátek přidá na nový řádek", () => {
    expect(insertStarter("První věc.  \n", "Bylo by fajn, kdyby…")).toBe("První věc.\nBylo by fajn, kdyby ");
  });
});

describe("parseDraft", () => {
  it("vrátí uložený koncept", () => {
    expect(parseDraft(JSON.stringify({ category: "chyba", message: "Nejde" }))).toEqual({ category: "chyba", message: "Nejde" });
  });

  it("neznámou kategorii zahodí, text ponechá", () => {
    expect(parseDraft(JSON.stringify({ category: "hack", message: "Text" }))).toEqual({ category: null, message: "Text" });
  });

  it("prázdný, poškozený nebo cizí obsah ignoruje", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{nejson")).toBeNull();
    expect(parseDraft(JSON.stringify({ message: "   " }))).toBeNull();
    expect(parseDraft(JSON.stringify({ category: 5, message: 5 }))).toBeNull();
  });
});

describe("pluralizeChanges", () => {
  it("skloňuje", () => {
    expect(pluralizeChanges(1)).toBe("1 změna");
    expect(pluralizeChanges(3)).toBe("3 změny");
    expect(pluralizeChanges(5)).toBe("5 změn");
    expect(pluralizeChanges(0)).toBe("0 změn");
  });
});

describe("formatFeedbackDate", () => {
  it("bere čas z SQLite jako UTC a ukáže datum v Praze", () => {
    // 23:30 UTC 31. 12. je v Praze už 1. 1.
    expect(formatFeedbackDate("2026-12-31 23:30:00")).toBe("1. 1. 2027");
  });
});
