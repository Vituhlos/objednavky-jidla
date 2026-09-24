/**
 * Číselníky a typy připomínek. Bez databáze a bez zod — importuje to i klient
 * (stránka /pripominky a Nastavení), takže sem nesmí nic, co táhne `better-sqlite3`.
 */

export const FEEDBACK_CATEGORIES = [
  { id: "napad",    emoji: "💡", label: "Nápad na vylepšení" },
  { id: "chyba",    emoji: "🐞", label: "Něco nefunguje" },
  { id: "jidlo",    emoji: "🍽️", label: "Jídlo a objednávání" },
  { id: "ovladani", emoji: "🎨", label: "Vzhled a ovládání" },
  { id: "mobil",    emoji: "📱", label: "Na mobilu" },
  { id: "pochvala", emoji: "🙌", label: "Pochvala" },
  { id: "jine",     emoji: "💬", label: "Jiné" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["id"];

export const FEEDBACK_STATUSES = [
  { id: "new",      label: "Nová" },
  { id: "read",     label: "Přečteno" },
  { id: "planned",  label: "V plánu" },
  { id: "done",     label: "Hotovo" },
  { id: "rejected", label: "Zamítnuto" },
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]["id"];

export type FeedbackDevice = "mobil" | "počítač" | "";

export const FEEDBACK_LIMITS = {
  messageMin: 5,
  messageMax: 2000,
  nameMax: 80,
  pageMax: 100,
  adminNoteMax: 2000,
  publicReplyMax: 500,
} as const;

export interface FeedbackEntry {
  id: number;
  createdAt: string;
  category: FeedbackCategory;
  message: string;
  authorName: string;
  page: string;
  device: FeedbackDevice;
  status: FeedbackStatus;
  adminNote: string;
  publicReply: string;
  resolvedAt: string | null;
}

/** Co z připomínky smí vidět kdokoli: jen odpověď správce, nikdy původní text ani autor. */
export interface PublicFeedbackReply {
  id: number;
  category: FeedbackCategory;
  publicReply: string;
  resolvedAt: string;
}

export function getCategoryMeta(id: string) {
  return FEEDBACK_CATEGORIES.find((c) => c.id === id) ?? FEEDBACK_CATEGORIES[FEEDBACK_CATEGORIES.length - 1];
}

export function getStatusMeta(id: string) {
  return FEEDBACK_STATUSES.find((s) => s.id === id) ?? FEEDBACK_STATUSES[0];
}
