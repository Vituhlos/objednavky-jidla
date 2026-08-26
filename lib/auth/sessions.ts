import { getDb } from "../db";
import { logAudit } from "../audit";
import { AuthError } from "./errors";
import { hashToken, newToken } from "./tokens";

export const SESSION_COOKIE = "kantyna_session";

const IDLE_MS = 8 * 60 * 60 * 1000;
const ABSOLUTE_MS = 24 * 60 * 60 * 1000;
const PERSISTENT_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const PERSISTENT_ABSOLUTE_MS = 180 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;

export interface SessionInfo {
  sessionId: number;
  userId: number;
  role: "admin" | "user";
  personIds: number[];
}

export interface SessionRow {
  id: number;
  createdAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  persistent: boolean;
  userAgent: string | null;
}

interface StoredSession {
  id: number;
  userId: number;
  role: "admin" | "user";
  status: "active" | "blocked";
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  persistent: number;
}

function formatUtc(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function parseUtc(value: string): number | null {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isTokenShapeValid(token: string): boolean {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

function requireId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} není platné.`);
}

export function getSessionCookieOptions(persistent: boolean, expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    ...(persistent ? { expires: new Date(expiresAt) } : {}),
  };
}

export function createSession(
  userId: number,
  opts: { persistent: boolean; userAgent?: string }
): { token: string; expiresAt: string } {
  requireId(userId, "Uživatel");
  if (!opts || typeof opts !== "object" || typeof opts.persistent !== "boolean") {
    throw new Error("Nastavení sezení není platné.");
  }

  const db = getDb();
  const user = db
    .prepare("SELECT name, role, status FROM users WHERE id = ?")
    .get(userId) as
    | { name: string; role: "admin" | "user"; status: "active" | "blocked" }
    | undefined;
  if (!user) throw new AuthError("NEPRIHLASEN", "Účet nelze přihlásit.");
  if (user.status !== "active") {
    throw new AuthError("BLOKOVAN", "Tento účet je zablokovaný. Obraťte se na správce.");
  }
  if (!db.prepare("SELECT 1 FROM user_people WHERE user_id = ? LIMIT 1").get(userId)) {
    throw new AuthError("NEPRIHLASEN", "Účet nemá přiřazeného strávníka.");
  }

  const now = Date.now();
  const idleMs = opts.persistent ? PERSISTENT_IDLE_MS : IDLE_MS;
  const absoluteMs = opts.persistent ? PERSISTENT_ABSOLUTE_MS : ABSOLUTE_MS;
  const absoluteExpiresAt = formatUtc(now + absoluteMs);
  const { token, hash } = newToken();
  const userAgent =
    typeof opts.userAgent === "string" ? opts.userAgent.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 500) : null;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO sessions (
        user_id, token_hash, created_at, last_seen_at, idle_expires_at,
        absolute_expires_at, persistent, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      hash,
      formatUtc(now),
      formatUtc(now),
      formatUtc(now + idleMs),
      absoluteExpiresAt,
      opts.persistent ? 1 : 0,
      userAgent
    );
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
  })();

  logAudit({ action: "user_login", personName: user.name, details: `uživatel #${userId}` });
  return { token, expiresAt: absoluteExpiresAt };
}

export function readSession(token: string): SessionInfo | null {
  if (!isTokenShapeValid(token)) return null;

  const db = getDb();
  const row = db
    .prepare(`
      SELECT
        s.id,
        s.user_id AS userId,
        u.role,
        u.status,
        s.last_seen_at AS lastSeenAt,
        s.idle_expires_at AS idleExpiresAt,
        s.absolute_expires_at AS absoluteExpiresAt,
        s.persistent
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .get(hashToken(token)) as StoredSession | undefined;
  if (!row) return null;

  // Řádek blokovaného účtu se ponechá jen jako serverový důkaz pro klidnou
  // hlášku v guardu. Platné sezení z něj nikdy nevznikne.
  if (row.status !== "active") return null;

  const now = Date.now();
  const idleExpiresAt = parseUtc(row.idleExpiresAt);
  const absoluteExpiresAt = parseUtc(row.absoluteExpiresAt);
  const lastSeenAt = parseUtc(row.lastSeenAt);
  if (
    idleExpiresAt === null ||
    absoluteExpiresAt === null ||
    lastSeenAt === null ||
    now >= idleExpiresAt ||
    now >= absoluteExpiresAt
  ) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
    return null;
  }

  const people = db
    .prepare("SELECT person_id FROM user_people WHERE user_id = ? ORDER BY person_id")
    .all(row.userId) as { person_id: number }[];
  if (people.length === 0) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
    return null;
  }

  if (now - lastSeenAt >= TOUCH_INTERVAL_MS) {
    const idleMs = row.persistent === 1 ? PERSISTENT_IDLE_MS : IDLE_MS;
    const nextIdle = Math.min(now + idleMs, absoluteExpiresAt);
    db.prepare("UPDATE sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?").run(
      formatUtc(now),
      formatUtc(nextIdle),
      row.id
    );
  }

  return {
    sessionId: row.id,
    userId: row.userId,
    role: row.role,
    personIds: people.map((person) => person.person_id),
  };
}

export function revokeSession(token: string): void {
  if (!isTokenShapeValid(token)) return;
  const db = getDb();
  const row = db
    .prepare(`
      SELECT s.id, s.user_id AS userId, u.name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .get(hashToken(token)) as { id: number; userId: number; name: string } | undefined;
  if (!row) return;

  db.prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
  logAudit({ action: "user_logout", personName: row.name, details: `uživatel #${row.userId}` });
}

export function revokeAllSessions(userId: number, exceptSessionId?: number): void {
  requireId(userId, "Uživatel");
  if (exceptSessionId !== undefined) requireId(exceptSessionId, "Sezení");

  if (exceptSessionId === undefined) {
    getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  } else {
    getDb().prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(
      userId,
      exceptSessionId
    );
  }
}

export function listSessions(userId: number): SessionRow[] {
  requireId(userId, "Uživatel");
  pruneExpiredSessions();
  const rows = getDb()
    .prepare(`
      SELECT
        id,
        created_at AS createdAt,
        last_seen_at AS lastSeenAt,
        idle_expires_at AS idleExpiresAt,
        absolute_expires_at AS absoluteExpiresAt,
        persistent,
        user_agent AS userAgent
      FROM sessions
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(userId) as (Omit<SessionRow, "persistent"> & { persistent: number })[];
  return rows.map((row) => ({ ...row, persistent: row.persistent === 1 }));
}

export function pruneExpiredSessions(): void {
  getDb()
    .prepare(`
      DELETE FROM sessions
      WHERE julianday(absolute_expires_at) <= julianday('now')
         OR (
           julianday(idle_expires_at) <= julianday('now')
           AND user_id IN (SELECT id FROM users WHERE status = 'active')
         )
    `)
    .run();
}

export function isBlockedSessionToken(token: string): boolean {
  if (!isTokenShapeValid(token)) return false;
  return !!getDb()
    .prepare(`
      SELECT 1
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND u.status = 'blocked'
        AND julianday(s.absolute_expires_at) > julianday('now')
    `)
    .get(hashToken(token));
}
