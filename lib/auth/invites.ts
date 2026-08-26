import { getDb } from "../db";
import { logAudit } from "../audit";
import { hashToken, newToken } from "./tokens";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_GUESTS = 3;
const MAX_PENDING_INVITES = 5;

export interface InviteInfo {
  id: number;
  inviterUserId: number;
  inviterName: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdPersonId: number | null;
}

interface InviteRow {
  id: number;
  inviterUserId: number;
  inviterName: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdPersonId: number | null;
}

const SELECT_INVITE = `
  SELECT
    i.id,
    i.inviter_user_id AS inviterUserId,
    u.name AS inviterName,
    i.created_at AS createdAt,
    i.expires_at AS expiresAt,
    i.used_at AS usedAt,
    i.revoked_at AS revokedAt,
    i.created_person_id AS createdPersonId
  FROM guest_invites i
  JOIN users u ON u.id = i.inviter_user_id
`;

function requireId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} není platné.`);
}

function isTokenShapeValid(token: string): boolean {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

function inviterPeople(inviterUserId: number): Array<{
  id: number;
  guestOfPersonId: number | null;
}> {
  return getDb()
    .prepare(`
      SELECT p.id, p.guest_of_person_id AS guestOfPersonId
      FROM user_people up
      JOIN people p ON p.id = up.person_id
      WHERE up.user_id = ? AND p.active = 1
      ORDER BY p.id
    `)
    .all(inviterUserId) as Array<{ id: number; guestOfPersonId: number | null }>;
}

function rootInviterPersonId(inviterUserId: number): number {
  const user = getDb()
    .prepare("SELECT status FROM users WHERE id = ?")
    .get(inviterUserId) as { status: "active" | "blocked" } | undefined;
  if (!user || user.status !== "active") throw new Error("Pozvat hosta může jen aktivní účet.");

  const people = inviterPeople(inviterUserId);
  if (people.length === 0) throw new Error("Účet nemá přiřazeného aktivního strávníka.");
  if (people.some((person) => person.guestOfPersonId !== null)) {
    throw new Error("Host nemůže zvát další hosty.");
  }
  if (people.length !== 1) {
    // Více kořenových strávníků by nedávalo jednoznačnou odpověď, pod koho
    // host patří. Automatická volba by mohla vytvořit chybnou odpovědnost.
    throw new Error("Účet nemá jednoznačného strávníka pro pozvání hosta.");
  }
  return people[0].id;
}

function countPendingInvites(inviterUserId: number): number {
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) AS n
      FROM guest_invites
      WHERE inviter_user_id = ?
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND julianday(expires_at) > julianday('now')
    `)
    .get(inviterUserId) as { n: number };
  return row.n;
}

export function countActiveGuests(inviterUserId: number): number {
  requireId(inviterUserId, "Uživatel");
  const row = getDb()
    .prepare(`
      SELECT COUNT(DISTINCT guest.id) AS n
      FROM people guest
      WHERE guest.active = 1
        AND guest.guest_of_person_id IN (
          SELECT person_id FROM user_people WHERE user_id = ?
        )
    `)
    .get(inviterUserId) as { n: number };
  return row.n;
}

export function createInvite(inviterUserId: number): { token: string; expiresAt: string } {
  requireId(inviterUserId, "Uživatel");
  const db = getDb();
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  db.transaction(() => {
    rootInviterPersonId(inviterUserId);
    if (countActiveGuests(inviterUserId) >= MAX_ACTIVE_GUESTS) {
      throw new Error("Účet už má nejvyšší povolený počet tří aktivních hostů.");
    }
    if (countPendingInvites(inviterUserId) >= MAX_PENDING_INVITES) {
      throw new Error("Účet už má pět čekajících pozvánek.");
    }
    db.prepare(
      "INSERT INTO guest_invites (token_hash, inviter_user_id, expires_at) VALUES (?, ?, ?)"
    ).run(hash, inviterUserId, expiresAt);
  })();

  logAudit({ action: "invite_create", details: `pozval uživatel #${inviterUserId}` });
  return { token, expiresAt };
}

export function getInvite(token: string): InviteInfo | null {
  if (!isTokenShapeValid(token)) return null;
  const row = getDb()
    .prepare(`
      ${SELECT_INVITE}
      WHERE i.token_hash = ?
        AND i.used_at IS NULL
        AND i.revoked_at IS NULL
        AND julianday(i.expires_at) > julianday('now')
        AND u.status = 'active'
    `)
    .get(hashToken(token)) as InviteRow | undefined;
  return row ?? null;
}

export function consumeInvite(token: string, createdPersonId: number): void {
  if (!isTokenShapeValid(token)) throw new Error("Pozvánka není platná.");
  requireId(createdPersonId, "Strávník");

  const db = getDb();
  let inviterUserId = 0;
  db.transaction(() => {
    const invite = db
      .prepare(`
        SELECT id, inviter_user_id AS inviterUserId
        FROM guest_invites
        WHERE token_hash = ?
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND julianday(expires_at) > julianday('now')
      `)
      .get(hashToken(token)) as { id: number; inviterUserId: number } | undefined;
    if (!invite) throw new Error("Pozvánka není platná.");
    inviterUserId = invite.inviterUserId;

    const inviterPersonId = rootInviterPersonId(invite.inviterUserId);
    if (countActiveGuests(invite.inviterUserId) >= MAX_ACTIVE_GUESTS) {
      throw new Error("Účet už má nejvyšší povolený počet tří aktivních hostů.");
    }
    const person = db
      .prepare(`
        SELECT p.guest_of_person_id AS guestOfPersonId,
               EXISTS(SELECT 1 FROM user_people up WHERE up.person_id = p.id) AS hasAccount
        FROM people p
        WHERE p.id = ? AND p.active = 1
      `)
      .get(createdPersonId) as { guestOfPersonId: number | null; hasAccount: number } | undefined;
    if (!person || person.hasAccount !== 1) {
      throw new Error("Pozvánku lze přiřadit jen novému aktivnímu účtu.");
    }
    if (createdPersonId === inviterPersonId || person.guestOfPersonId !== null) {
      throw new Error("Pozvánku nelze přiřadit tomuto strávníkovi.");
    }

    db.prepare("UPDATE people SET guest_of_person_id = ? WHERE id = ?").run(
      inviterPersonId,
      createdPersonId
    );
    const result = db
      .prepare(
        "UPDATE guest_invites SET used_at = datetime('now'), created_person_id = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL"
      )
      .run(createdPersonId, invite.id);
    if (result.changes !== 1) throw new Error("Pozvánka není platná.");
  })();

  logAudit({
    action: "invite_use",
    details: `pozvánka uživatele #${inviterUserId}, strávník #${createdPersonId}`,
  });
}

export function revokeInvite(inviteId: number, actorUserId: number): void {
  requireId(inviteId, "Pozvánka");
  requireId(actorUserId, "Uživatel");
  const db = getDb();
  const invite = db
    .prepare(
      "SELECT inviter_user_id AS inviterUserId, used_at AS usedAt, revoked_at AS revokedAt FROM guest_invites WHERE id = ?"
    )
    .get(inviteId) as
    | { inviterUserId: number; usedAt: string | null; revokedAt: string | null }
    | undefined;
  if (!invite || invite.inviterUserId !== actorUserId) {
    throw new Error("Pozvánku nelze zrušit.");
  }
  if (invite.revokedAt !== null) return;
  if (invite.usedAt !== null) throw new Error("Použitou pozvánku už nelze zrušit.");

  db.prepare("UPDATE guest_invites SET revoked_at = datetime('now') WHERE id = ?").run(inviteId);
  logAudit({ action: "invite_revoke", details: `pozvánka #${inviteId}, uživatel #${actorUserId}` });
}

export function listInvites(inviterUserId: number): InviteInfo[] {
  requireId(inviterUserId, "Uživatel");
  return getDb()
    .prepare(`${SELECT_INVITE} WHERE i.inviter_user_id = ? ORDER BY i.created_at DESC, i.id DESC`)
    .all(inviterUserId) as InviteRow[];
}
