import { describe, expect, it } from "vitest";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_LIMITS,
  detectDevice,
  formatFeedbackTelegram,
  validateFeedbackInput,
  type FeedbackEntry,
} from "./feedback";

/**
 * Formulář připomínek je veřejný a volá ho Server Action, tedy obyčejný POST.
 * Validace na serveru je proto jediná, která platí — klientská je jen pohodlí.
 */
describe("validateFeedbackInput", () => {
  const valid = { category: "napad", message: "Chtěl bych tmavý režim." };

  it("přijme platnou připomínku, doplní prázdnou stránku a jméno zahodí — připomínky jsou anonymní", () => {
    const r = validateFeedbackInput({ ...valid, authorName: "Jan Novák" });
    expect(r).toEqual({ ok: true, data: { ...valid, page: "", context: "", appVersion: "" } });
  });

  it("odmítne neznámou kategorii", () => {
    expect(validateFeedbackInput({ ...valid, category: "admin" }).ok).toBe(false);
  });

  it("odmítne text, který je po oříznutí mezer moc krátký", () => {
    const r = validateFeedbackInput({ ...valid, message: "   ok    " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(FEEDBACK_LIMITS.messageMin));
  });

  it("odmítne příliš dlouhý text", () => {
    expect(validateFeedbackInput({ ...valid, message: "a".repeat(FEEDBACK_LIMITS.messageMax + 1) }).ok).toBe(false);
  });

  it("odmítne jiný typ než objekt s řetězci", () => {
    expect(validateFeedbackInput(null).ok).toBe(false);
    expect(validateFeedbackInput("text").ok).toBe(false);
    expect(validateFeedbackInput({ ...valid, message: 42 }).ok).toBe(false);
  });

  it("odstraní řídicí znaky a sjednotí konce řádků", () => {
    const r = validateFeedbackInput({ ...valid, message: "Řádek\u0000 jedna\r\nřádek\u0007 dva" });
    expect(r.ok && r.data.message).toBe("Řádek jedna\nřádek dva");
  });

  it("stránku ponechá jen jako cestu v rámci appky", () => {
    const page = (p: string) => {
      const r = validateFeedbackInput({ ...valid, page: p });
      return r.ok ? r.data.page : null;
    };
    expect(page("/jidelnicek")).toBe("/jidelnicek");
    expect(page("/historie/12")).toBe("/historie/12");
    expect(page("https://evil.example/")).toBe("");
    expect(page("/?pin=1234")).toBe("");
    expect(page("javascript:alert(1)")).toBe("");
  });

  it("má pro každou kategorii emoji i popisek", () => {
    for (const c of FEEDBACK_CATEGORIES) {
      expect(c.emoji.length, c.id).toBeGreaterThan(0);
      expect(c.label.length, c.id).toBeGreaterThan(0);
    }
  });
});

describe("detectDevice", () => {
  it("rozliší mobil a počítač, bez user-agentu nic", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobil");
    expect(detectDevice("Mozilla/5.0 (Linux; Android 14) Mobile")).toBe("mobil");
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("počítač");
    expect(detectDevice(null)).toBe("");
  });
});

describe("formatFeedbackTelegram", () => {
  const entry: FeedbackEntry = {
    id: 1,
    createdAt: "2026-09-24 08:00:00",
    category: "chyba",
    message: "Tlačítko <b>Uložit</b> & nic",
    page: "/jidelnicek",
    device: "mobil",
    status: "new",
    adminNote: "",
    publicReply: "",
    resolvedAt: null,
    attachments: [],
    context: "",
    appVersion: "",
    votable: false,
    voteTitle: "",
    isPublic: false,
    isProposal: false,
    hidden: false,
    up: 0,
    down: 0,
    githubIssue: null,
    githubIssueState: "",
  };

  it("escapuje vše od uživatele — jinak Telegram zprávu odmítne", () => {
    const text = formatFeedbackTelegram(entry);
    expect(text).toContain("Tlačítko &lt;b&gt;Uložit&lt;/b&gt; &amp; nic");
    expect(text).not.toContain("<script>");
  });

  it("řekne, jestli připomínku hned vidí i ostatní", () => {
    expect(formatFeedbackTelegram(entry)).toContain("jen pro správce");
    expect(formatFeedbackTelegram({ ...entry, category: "napad", isPublic: true })).toContain("vidí i ostatní");
  });

  it("dlouhý text zkrátí", () => {
    const text = formatFeedbackTelegram({ ...entry, message: "x".repeat(FEEDBACK_LIMITS.messageMax) });
    expect(text.length).toBeLessThan(1000);
    expect(text).toContain("…");
  });
});
