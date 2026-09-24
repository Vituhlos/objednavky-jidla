/**
 * Číselníky a typy připomínek. Bez databáze a bez zod — importuje to i klient
 * (stránka /pripominky a Nastavení), takže sem nesmí nic, co táhne `better-sqlite3`.
 */

export const FEEDBACK_CATEGORIES = [
  {
    id: "napad", emoji: "💡", label: "Nápad", short: "Nápad",
    question: "Co by se hodilo?",
    starters: ["Chybí mi…", "Hodilo by se…", "Šlo by to jednodušeji, kdyby…"],
  },
  {
    id: "chyba", emoji: "🐞", label: "Něco nefunguje", short: "Chyba",
    question: "Co zlobí?",
    starters: ["Když kliknu na…", "Nejde mi…", "Po uložení se…"],
  },
  {
    id: "jidlo", emoji: "🍽️", label: "Jídlo a objednávání", short: "Jídlo",
    question: "Co by ti objednávání usnadnilo?",
    starters: ["V jídelníčku chybí…", "Šlo by si objednat…", "U příloh…"],
  },
  {
    id: "ovladani", emoji: "🎨", label: "Vzhled a ovládání", short: "Vzhled",
    question: "Co je nepřehledné?",
    starters: ["Špatně se hledá…", "Špatně se čte…", "Zbytečně hodně klikání je u…"],
  },
  {
    id: "mobil", emoji: "📱", label: "Na mobilu", short: "Mobil",
    question: "Co na mobilu nejde?",
    starters: ["Na mobilu nejde…", "Malé tlačítko je u…", "Mám telefon…"],
  },
  {
    id: "pochvala", emoji: "🙌", label: "Pochvala", short: "Pochvala",
    question: "Co se povedlo?",
    starters: ["Líbí se mi…", "Skvělé je…", "Díky za…"],
  },
  {
    id: "jine", emoji: "💬", label: "Něco jiného", short: "Jiné",
    question: "Co máš na srdci?",
    starters: ["Napadlo mě…", "Chci říct…"],
  },
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

export const FEEDBACK_ATTACHMENT_LIMITS = {
  /** Obrázků k jedné připomínce. */
  maxFiles: 3,
  /** Jeden soubor tak, jak dorazí na server (prohlížeč ho předtím zmenšuje). */
  maxInputBytes: 10 * 1024 * 1024,
  /** Delší strana po zpracování. Screenshot 4K se zmenší, telefon zůstane čitelný. */
  maxDimension: 2000,
  /** Všechny přílohy dohromady na disku. */
  maxStoredBytes: 500 * 1024 * 1024,
} as const;

export const FEEDBACK_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export interface FeedbackAttachment {
  id: number;
  width: number;
  height: number;
  size: number;
}

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
  attachments: FeedbackAttachment[];
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
