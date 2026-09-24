import { z } from "zod";
import { getDb } from "./db";
import { escapeHtml } from "./telegram";

import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_LIMITS,
  FEEDBACK_STATUSES,
  getCategoryMeta,
  getStatusMeta,
  type FeedbackCategory,
  type FeedbackDevice,
  type FeedbackEntry,
  type FeedbackStatus,
  type PublicFeedbackReply,
} from "./feedback-meta";

export * from "./feedback-meta";

/**
 * Připomínky k aplikaci od lidí, kteří si objednávají.
 *
 * Posílat je smí kdokoli (appka nemá účty), číst a spravovat jen ten, kdo zná
 * PIN z Nastavení. Proto se tu neukládá nic, co by šlo použít proti autorovi:
 * žádná IP adresa ani celý user-agent — jen hrubý typ zařízení, který pomáhá
 * u hlášení chyb. Jméno je dobrovolné.
 */

const categoryIds = FEEDBACK_CATEGORIES.map((c) => c.id) as [FeedbackCategory, ...FeedbackCategory[]];
const statusIds = FEEDBACK_STATUSES.map((s) => s.id) as [FeedbackStatus, ...FeedbackStatus[]];

// Řídicí znaky kromě tabulátoru a konce řádku — do DB ani do Telegramu nepatří.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, "").replace(/\r\n?/g, "\n").trim();
}

// Jen cesta v rámci appky, třeba "/jidelnicek". Cokoli jiného (cizí URL,
// query string s daty) se zahodí, ne odmítne — je to jen pomocný údaj.
const PAGE_PATTERN = /^\/[a-z0-9/_-]*$/i;

export const feedbackInputSchema = z.object({
  category: z.enum(categoryIds),
  message: z
    .string()
    .transform(cleanText)
    .pipe(
      z.string()
        .min(FEEDBACK_LIMITS.messageMin, `Napiš aspoň pár slov (min. ${FEEDBACK_LIMITS.messageMin} znaků).`)
        .max(FEEDBACK_LIMITS.messageMax, `Na připomínku je to moc dlouhé, max. ${FEEDBACK_LIMITS.messageMax} znaků.`),
    ),
  authorName: z
    .string()
    .optional()
    .default("")
    .transform(cleanText)
    .pipe(z.string().max(FEEDBACK_LIMITS.nameMax, `Jméno je moc dlouhé, max. ${FEEDBACK_LIMITS.nameMax} znaků.`)),
  page: z
    .string()
    .optional()
    .default("")
    .transform((v) => {
      const p = v.trim();
      return p.length <= FEEDBACK_LIMITS.pageMax && PAGE_PATTERN.test(p) ? p : "";
    }),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const feedbackUpdateSchema = z.object({
  status: z.enum(statusIds).optional(),
  adminNote: z.string().transform(cleanText).pipe(z.string().max(FEEDBACK_LIMITS.adminNoteMax)).optional(),
  publicReply: z.string().transform(cleanText).pipe(z.string().max(FEEDBACK_LIMITS.publicReplyMax)).optional(),
});

export type FeedbackUpdate = z.infer<typeof feedbackUpdateSchema>;

export type FeedbackValidation =
  | { ok: true; data: FeedbackInput }
  | { ok: false; error: string };

export function validateFeedbackInput(raw: unknown): FeedbackValidation {
  const parsed = feedbackInputSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? "Neplatná připomínka." };
}

/** Hrubý typ zařízení z user-agentu. Víc se z něj záměrně neukládá. */
export function detectDevice(userAgent: string | null | undefined): FeedbackDevice {
  if (!userAgent) return "";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "mobil" : "počítač";
}

type DbRow = {
  id: number;
  created_at: string;
  category: string;
  message: string;
  author_name: string;
  page: string;
  device: string;
  status: string;
  admin_note: string;
  public_reply: string;
  resolved_at: string | null;
};

function toEntry(r: DbRow): FeedbackEntry {
  return {
    id: r.id,
    createdAt: r.created_at,
    category: getCategoryMeta(r.category).id,
    message: r.message,
    authorName: r.author_name,
    page: r.page,
    device: (r.device === "mobil" || r.device === "počítač" ? r.device : "") as FeedbackDevice,
    status: getStatusMeta(r.status).id,
    adminNote: r.admin_note,
    publicReply: r.public_reply,
    resolvedAt: r.resolved_at,
  };
}

export function addFeedback(input: FeedbackInput, device: FeedbackDevice): FeedbackEntry {
  const db = getDb();
  const r = db
    .prepare(
      "INSERT INTO feedback (category, message, author_name, page, device) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.category, input.message, input.authorName, input.page, device);
  return getFeedbackById(Number(r.lastInsertRowid))!;
}

export function getFeedbackById(id: number): FeedbackEntry | null {
  const row = getDb().prepare("SELECT * FROM feedback WHERE id = ?").get(id) as DbRow | undefined;
  return row ? toEntry(row) : null;
}

export function getFeedbackList(): FeedbackEntry[] {
  const rows = getDb()
    .prepare("SELECT * FROM feedback ORDER BY created_at DESC, id DESC")
    .all() as DbRow[];
  return rows.map(toEntry);
}

export function countNewFeedback(): number {
  const { cnt } = getDb()
    .prepare("SELECT COUNT(*) AS cnt FROM feedback WHERE status = 'new'")
    .get() as { cnt: number };
  return cnt;
}

export function updateFeedback(id: number, updates: FeedbackUpdate): FeedbackEntry | null {
  const current = getFeedbackById(id);
  if (!current) return null;

  const status = updates.status ?? current.status;
  const adminNote = updates.adminNote ?? current.adminNote;
  const publicReply = updates.publicReply ?? current.publicReply;
  // Datum vyřízení drží první přechod do „Hotovo“, ať seznam změn neskáče
  // při každé opravě překlepu v odpovědi. Návrat z „Hotovo“ ho maže.
  const resolvedAt =
    status === "done" ? current.resolvedAt ?? new Date().toISOString().replace("T", " ").slice(0, 19) : null;

  getDb()
    .prepare(
      "UPDATE feedback SET status = ?, admin_note = ?, public_reply = ?, resolved_at = ? WHERE id = ?",
    )
    .run(status, adminNote, publicReply, resolvedAt, id);
  return getFeedbackById(id);
}

export function deleteFeedback(id: number): boolean {
  return getDb().prepare("DELETE FROM feedback WHERE id = ?").run(id).changes > 0;
}

/** Veřejný seznam „co jsme upravili“ — hotové připomínky s odpovědí správce. */
export function getPublicFeedbackReplies(limit = 20): PublicFeedbackReply[] {
  const rows = getDb()
    .prepare(
      `SELECT id, category, public_reply, resolved_at FROM feedback
       WHERE status = 'done' AND public_reply != '' AND resolved_at IS NOT NULL
       ORDER BY resolved_at DESC, id DESC LIMIT ?`,
    )
    .all(limit) as { id: number; category: string; public_reply: string; resolved_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    category: getCategoryMeta(r.category).id,
    publicReply: r.public_reply,
    resolvedAt: r.resolved_at,
  }));
}

const TELEGRAM_PREVIEW_MAX = 600;

/** Zpráva pro Telegram. Vše od uživatele se escapuje — zpráva jde s parse_mode HTML. */
export function formatFeedbackTelegram(entry: FeedbackEntry): string {
  const cat = getCategoryMeta(entry.category);
  const text = entry.message.length > TELEGRAM_PREVIEW_MAX
    ? `${entry.message.slice(0, TELEGRAM_PREVIEW_MAX)}…`
    : entry.message;
  const author = entry.authorName ? escapeHtml(entry.authorName) : "<i>anonymně</i>";
  const where = [
    entry.page ? `📍 ${escapeHtml(entry.page)}` : "",
    entry.device ? `${entry.device === "mobil" ? "📱" : "💻"} ${entry.device}` : "",
  ].filter(Boolean).join(" · ");

  return [
    `💬 <b>Nová připomínka</b>`,
    `${cat.emoji} ${escapeHtml(cat.label)} · ${author}`,
    "",
    escapeHtml(text),
    ...(where ? ["", where] : []),
    "",
    `<i>Spravovat: Nastavení → Připomínky</i>`,
  ].join("\n");
}
