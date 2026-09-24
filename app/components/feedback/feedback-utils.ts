import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/feedback-meta";

/** SQLite `datetime('now')` je UTC bez zóny — bez „Z“ by ho prohlížeč bral jako místní čas. */
export function parseDbDate(value: string): Date {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function formatFeedbackDate(value: string): string {
  return parseDbDate(value).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague",
  });
}

/** „1 změna“, „2 změny“, „5 změn“. */
export function pluralizeChanges(count: number): string {
  if (count === 1) return "1 změna";
  if (count >= 2 && count <= 4) return `${count} změny`;
  return `${count} změn`;
}

/**
 * Vloží začátek věty do rozepsaného textu.
 *
 * Prázdné pole dostane jen začátek; jinak se přidá na nový řádek, aby klik
 * na čip nepřepsal to, co už člověk napsal. Tři tečky se zahodí — kurzor
 * končí za mezerou a navazuje se psaním.
 */
export function insertStarter(message: string, starter: string): string {
  const phrase = `${starter.replace(/…$/, "").trimEnd()} `;
  const trimmed = message.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${phrase}` : phrase;
}

export type FeedbackDraft = { category: FeedbackCategory | null; message: string };

const CATEGORY_IDS = new Set<string>(FEEDBACK_CATEGORIES.map((c) => c.id));

/** Koncept z localStorage — cokoli poškozeného nebo cizího se zahodí. */
export function parseDraft(raw: string | null): FeedbackDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { category?: unknown; message?: unknown };
    const category = typeof data.category === "string" && CATEGORY_IDS.has(data.category)
      ? (data.category as FeedbackCategory)
      : null;
    const message = typeof data.message === "string" ? data.message : "";
    if (!category && !message.trim()) return null;
    return { category, message };
  } catch {
    return null;
  }
}
