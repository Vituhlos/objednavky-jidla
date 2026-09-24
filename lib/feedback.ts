import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { getDb } from "./db";
import { escapeHtml } from "./telegram";
import { deleteAttachmentFiles, getAttachmentsByFeedback, storeAttachments, type ProcessedImage } from "./feedback-attachments";

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
  type OwnFeedback,
  type PublicFeedbackReply,
  type VotableFeedback,
  FEEDBACK_ATTACHMENT_RETENTION_DAYS,
  VOTER_TOKEN_PATTERN,
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
        .min(FEEDBACK_LIMITS.messageMin, `Napiš aspoň pár slov (nejméně ${FEEDBACK_LIMITS.messageMin} znaků).`)
        .max(FEEDBACK_LIMITS.messageMax, `Text je příliš dlouhý, může mít nejvýš ${FEEDBACK_LIMITS.messageMax} znaků.`),
    ),
  authorName: z
    .string()
    .optional()
    .default("")
    .transform(cleanText)
    .pipe(z.string().max(FEEDBACK_LIMITS.nameMax, `Jméno je příliš dlouhé, může mít nejvýš ${FEEDBACK_LIMITS.nameMax} znaků.`)),
  page: z
    .string()
    .optional()
    .default("")
    .transform((v) => {
      const p = v.trim();
      return p.length <= FEEDBACK_LIMITS.pageMax && PAGE_PATTERN.test(p) ? p : "";
    }),
  // Technický údaj z chybové stránky. Jen pomocný — příliš dlouhý se ořízne, ne odmítne.
  context: z
    .string()
    .optional()
    .default("")
    .transform((v) => cleanText(v).replace(/\s+/g, " ").slice(0, FEEDBACK_LIMITS.contextMax)),
  // Verze, kterou má autor načtenou. Cokoli jiného než číslo verze se zahodí.
  appVersion: z
    .string()
    .optional()
    .default("")
    .transform((v) => (/^[0-9A-Za-z.+-]{1,40}$/.test(v.trim()) ? v.trim() : "")),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const feedbackUpdateSchema = z.object({
  status: z.enum(statusIds).optional(),
  adminNote: z.string().transform(cleanText).pipe(z.string().max(FEEDBACK_LIMITS.adminNoteMax)).optional(),
  publicReply: z.string().transform(cleanText).pipe(z.string().max(FEEDBACK_LIMITS.publicReplyMax)).optional(),
  votable: z.boolean().optional(),
  voteTitle: z.string().transform((v) => cleanText(v).replace(/\s+/g, " ")).pipe(z.string().max(FEEDBACK_LIMITS.voteTitleMax)).optional(),
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
  context: string;
  app_version: string;
  votable: number;
  vote_title: string;
  votes: number;
};

function toEntry(r: DbRow, attachments: Map<number, FeedbackEntry["attachments"]>): FeedbackEntry {
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
    attachments: attachments.get(r.id) ?? [],
    context: r.context ?? "",
    appVersion: r.app_version ?? "",
    votable: r.votable === 1,
    voteTitle: r.vote_title ?? "",
    votes: r.votes ?? 0,
  };
}

function hashSecret(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Založí připomínku a vrátí ji spolu s tajným kódem pro autora.
 *
 * Kód se ukládá jen jako SHA-256 — kdo získá databázi nebo zálohu, stav cizích
 * připomínek přes „Moje připomínky“ číst nemůže. Samotný kód dostane jen autor
 * v odpovědi a zůstane v jeho prohlížeči.
 */
export function addFeedback(
  input: FeedbackInput,
  device: FeedbackDevice,
  images: ProcessedImage[] = [],
): { entry: FeedbackEntry; token: string } {
  const db = getDb();
  const token = randomBytes(24).toString("base64url");
  // Připomínka i přílohy vzniknou spolu, nebo vůbec — bez sirotků v DB ani na disku
  const id = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO feedback (category, message, author_name, page, device, context, app_version, secret_hash, status_changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(input.category, input.message, input.authorName, input.page, device,
        input.context, input.appVersion, hashSecret(token));
    const feedbackId = Number(r.lastInsertRowid);
    storeAttachments(feedbackId, images);
    return feedbackId;
  })();
  return { entry: getFeedbackById(id)!, token };
}

export const ownFeedbackRequestSchema = z.object({
  items: z
    .array(z.object({ id: z.number().int().positive(), token: z.string().min(16).max(64) }))
    .max(FEEDBACK_LIMITS.ownMax),
});

/**
 * Připomínky, ke kterým má volající tajný kód. Neplatné páry se tiše vynechají —
 * klient podle toho pozná smazané připomínky a zapomene je.
 */
export function getOwnFeedback(items: { id: number; token: string }[]): OwnFeedback[] {
  if (items.length === 0) return [];
  const db = getDb();
  const find = db.prepare(
    `SELECT id, created_at, category, message, status, public_reply, secret_hash,
            (SELECT COUNT(*) FROM feedback_attachments a WHERE a.feedback_id = feedback.id) AS attachment_count
     FROM feedback WHERE id = ?`,
  );
  const result: OwnFeedback[] = [];
  for (const { id, token } of items) {
    const row = find.get(id) as {
      id: number; created_at: string; category: string; message: string; status: string;
      public_reply: string; secret_hash: string; attachment_count: number;
    } | undefined;
    if (!row || !row.secret_hash) continue;
    const expected = Buffer.from(row.secret_hash, "hex");
    const actual = Buffer.from(hashSecret(token), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) continue;
    result.push({
      id: row.id,
      createdAt: row.created_at,
      category: getCategoryMeta(row.category).id,
      message: row.message,
      status: getStatusMeta(row.status).id,
      reply: row.public_reply,
      attachmentCount: row.attachment_count,
    });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

export function getFeedbackById(id: number): FeedbackEntry | null {
  const row = getDb().prepare(`SELECT *, (SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id = feedback.id) AS votes
       FROM feedback WHERE id = ?`).get(id) as DbRow | undefined;
  return row ? toEntry(row, getAttachmentsByFeedback()) : null;
}

export function getFeedbackList(): FeedbackEntry[] {
  const rows = getDb()
    .prepare(`SELECT *, (SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id = feedback.id) AS votes
       FROM feedback ORDER BY created_at DESC, id DESC`)
    .all() as DbRow[];
  const attachments = getAttachmentsByFeedback();
  return rows.map((r) => toEntry(r, attachments));
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
  // Název jde ven všem — i mimo validaci ve Server Action ho uklidit
  const voteTitle = cleanText(updates.voteTitle ?? current.voteTitle).replace(/\s+/g, " ").slice(0, FEEDBACK_LIMITS.voteTitleMax);
  // Bez názvu se hlasovat nedá — vymazáním názvu se hlasování samo vypne
  const votable = (updates.votable ?? current.votable) && voteTitle !== "";
  // Datum vyřízení drží první přechod do „Hotovo“, ať seznam změn neskáče
  // při každé opravě překlepu v odpovědi. Návrat z „Hotovo“ ho maže.
  const resolvedAt =
    status === "done" ? current.resolvedAt ?? new Date().toISOString().replace("T", " ").slice(0, 19) : null;

  getDb()
    .prepare(
      `UPDATE feedback SET status = ?, admin_note = ?, public_reply = ?, resolved_at = ?, votable = ?, vote_title = ?,
         status_changed_at = CASE WHEN status = ? THEN status_changed_at ELSE datetime('now') END
       WHERE id = ?`,
    )
    .run(status, adminNote, publicReply, resolvedAt, votable ? 1 : 0, voteTitle, status, id);
  return getFeedbackById(id);
}

export function deleteFeedback(id: number): boolean {
  deleteAttachmentFiles(id);
  return getDb().prepare("DELETE FROM feedback WHERE id = ?").run(id).changes > 0;
}

/**
 * Smaže screenshoty připomínek, které jsou vyřízené (Hotovo, Zamítnuto) déle
 * než `days` dní. Text připomínky zůstává — mizí jen cizí obrazovky, které už
 * k ničemu nejsou. Volá se jednou denně ze scheduleru. Vrací počet smazaných.
 */
export function cleanupOldAttachments(days = FEEDBACK_ATTACHMENT_RETENTION_DAYS): number {
  const db = getDb();
  const ids = (db
    .prepare(
      `SELECT DISTINCT f.id FROM feedback f
       JOIN feedback_attachments a ON a.feedback_id = f.id
       WHERE f.status IN ('done', 'rejected')
         AND f.status_changed_at IS NOT NULL
         AND f.status_changed_at <= datetime('now', ?)`,
    )
    .all(`-${Math.max(0, Math.floor(days))} days`) as { id: number }[]).map((r) => r.id);
  let removed = 0;
  for (const id of ids) {
    deleteAttachmentFiles(id);
    removed += db.prepare("DELETE FROM feedback_attachments WHERE feedback_id = ?").run(id).changes;
  }
  return removed;
}

/** Veřejný seznam „co jsme upravili“ — hotové připomínky s odpovědí správce. */
export function getPublicFeedbackReplies(limit = 20): PublicFeedbackReply[] {
  const rows = getDb()
    .prepare(
      `SELECT id, category, public_reply, resolved_at,
              (SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id = feedback.id) AS votes
       FROM feedback
       WHERE status = 'done' AND public_reply != '' AND resolved_at IS NOT NULL
       ORDER BY resolved_at DESC, id DESC LIMIT ?`,
    )
    .all(limit) as { id: number; category: string; public_reply: string; resolved_at: string; votes: number }[];
  return rows.map((r) => ({
    id: r.id,
    category: getCategoryMeta(r.category).id,
    publicReply: r.public_reply,
    resolvedAt: r.resolved_at,
    votes: r.votes,
  }));
}

// Hlasovat jde jen o otevřených věcech; hotové a zamítnuté se uzavřou samy
const VOTABLE_SQL = "votable = 1 AND vote_title != '' AND status IN ('new', 'read', 'planned')";

/** Připomínky zveřejněné k hlasování, nejžádanější první. */
export function getVotableFeedback(limit = 30): VotableFeedback[] {
  const rows = getDb()
    .prepare(
      `SELECT id, category, status, vote_title,
              (SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id = feedback.id) AS votes
       FROM feedback WHERE ${VOTABLE_SQL}
       ORDER BY votes DESC, id DESC LIMIT ?`,
    )
    .all(limit) as { id: number; category: string; status: string; vote_title: string; votes: number }[];
  return rows.map((r) => ({
    id: r.id,
    category: getCategoryMeta(r.category).id,
    status: getStatusMeta(r.status).id,
    summary: r.vote_title,
    votes: r.votes,
  }));
}

/**
 * Přidá nebo odebere hlas. `null` = o téhle připomínce se hlasovat nedá
 * (neexistuje, není zveřejněná, nebo je už vyřízená).
 *
 * Hlas je vázaný na náhodný kód prohlížeče, ne na člověka — kdo si smaže
 * data prohlížeče, může hlasovat znovu. Bez účtů to jinak nejde; hlasování
 * je proto orientační a správce to ví (stojí to v nápovědě v Nastavení).
 */
export function setVote(id: number, voterToken: string, vote: boolean): number | null {
  if (!VOTER_TOKEN_PATTERN.test(voterToken)) return null;
  const db = getDb();
  const open = db.prepare(`SELECT id FROM feedback WHERE id = ? AND ${VOTABLE_SQL}`).get(id);
  if (!open) return null;
  const voter = hashSecret(`vote:${voterToken}`);
  if (vote) db.prepare("INSERT OR IGNORE INTO feedback_votes (feedback_id, voter_hash) VALUES (?, ?)").run(id, voter);
  else db.prepare("DELETE FROM feedback_votes WHERE feedback_id = ? AND voter_hash = ?").run(id, voter);
  const { cnt } = db.prepare("SELECT COUNT(*) AS cnt FROM feedback_votes WHERE feedback_id = ?").get(id) as { cnt: number };
  return cnt;
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
    entry.attachments.length ? `📎 ${entry.attachments.length} ${entry.attachments.length === 1 ? "obrázek" : "obrázky"}` : "",
    entry.appVersion ? `v${escapeHtml(entry.appVersion)}` : "",
  ].filter(Boolean).join(" · ");

  return [
    `💬 <b>Nová připomínka</b>`,
    `${cat.emoji} ${escapeHtml(cat.label)} · ${author}`,
    "",
    escapeHtml(text),
    ...(entry.context ? ["", `<code>${escapeHtml(entry.context)}</code>`] : []),
    ...(where ? ["", where] : []),
    "",
    `<i>Spravovat: Nastavení → Připomínky</i>`,
  ].join("\n");
}
