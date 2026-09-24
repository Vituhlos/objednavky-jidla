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
  contextMax: 300,
  /** Kolik vlastních připomínek si prohlížeč pamatuje. */
  ownMax: 50,
  messageMin: 5,
  messageMax: 2000,
  nameMax: 80,
  pageMax: 100,
  adminNoteMax: 2000,
  publicReplyMax: 500,
  voteTitleMax: 120,
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
  page: string;
  device: FeedbackDevice;
  status: FeedbackStatus;
  adminNote: string;
  publicReply: string;
  resolvedAt: string | null;
  attachments: FeedbackAttachment[];
  context: string;
  appVersion: string;
  votable: boolean;
  voteTitle: string;
  /** Kategorie se ukazuje v „Připomínkách ostatních“ (bez ohledu na skrytí). */
  isPublic: boolean;
  /** Návrh, který napsal správce sám (jde rovnou do „Co chystáme“). */
  isProposal: boolean;
  /** Správce ji z veřejného seznamu skryl. */
  hidden: boolean;
  up: number;
  down: number;
  /** Číslo úkolu na GitHubu, nebo null, dokud žádný nevznikl. */
  githubIssue: number | null;
  githubIssueState: "open" | "closed" | "";
}

/**
 * Připomínka tak, jak ji vidí její autor přes tajný kód: vlastní text, stav
 * a odpověď správce. Interní poznámka ani nic o ostatních sem nepatří.
 */
export interface OwnFeedback {
  id: number;
  createdAt: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  reply: string;
  attachmentCount: number;
}

/**
 * Stavy, ve kterých autor může svou připomínku stáhnout. Hotová a zamítnutá
 * nese odpověď správce a patří do historie — tu jde jen skrýt z vlastního seznamu.
 */
export const WITHDRAWABLE_STATUSES: readonly FeedbackStatus[] = ["new", "read", "planned"];

/** Po kolika dnech od vyřízení (Hotovo, Zamítnuto) se mažou screenshoty. */
export const FEEDBACK_ATTACHMENT_RETENTION_DAYS = 90;

/** Položka „Změnili jsme díky vám“: jen odpověď správce, ne původní text. */
export interface PublicFeedbackReply {
  id: number;
  category: FeedbackCategory;
  publicReply: string;
  resolvedAt: string;
  votes: number;
}

/** Připomínka zveřejněná k hlasování — jen shrnutí od správce, nikdy text autora. */
/**
 * Kategorie, jejichž připomínky se hned ukážou ostatním v „Připomínkách
 * ostatních“ (bez jména) a jde o nich hlasovat. Chyba se opravuje, ne hlasuje;
 * Jídlo bývá stížnost na kuchyň nebo konkrétní lidi; Pochvala patří správci.
 */
export const PUBLIC_CATEGORIES: readonly FeedbackCategory[] = ["napad", "ovladani", "mobil", "jine"];

export function isPublicCategory(category: string): boolean {
  return (PUBLIC_CATEGORIES as readonly string[]).includes(category);
}

/** Připomínka v „Připomínkách ostatních“ — jen text, kategorie, stav, datum a hlasy. */
export interface PublicFeedbackItem {
  id: number;
  category: FeedbackCategory;
  status: FeedbackStatus;
  text: string;
  createdAt: string;
  up: number;
  down: number;
}

/** Položka v „Co chystáme“: návrh správce, nebo připomínka, kterou dal k hlasování (pod svým názvem). */
export interface VotableFeedback {
  id: number;
  category: FeedbackCategory;
  status: FeedbackStatus;
  summary: string;
  up: number;
  down: number;
}

export type VoteValue = -1 | 0 | 1;

/** „1 hlas“, „2 hlasy“, „5 hlasů“. */
export function pluralizeVotes(count: number): string {
  if (count === 1) return "1 hlas";
  if (count >= 2 && count <= 4) return `${count} hlasy`;
  return `${count} hlasů`;
}

export const VOTER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function getCategoryMeta(id: string) {
  return FEEDBACK_CATEGORIES.find((c) => c.id === id) ?? FEEDBACK_CATEGORIES[FEEDBACK_CATEGORIES.length - 1];
}

export function getStatusMeta(id: string) {
  return FEEDBACK_STATUSES.find((s) => s.id === id) ?? FEEDBACK_STATUSES[0];
}
