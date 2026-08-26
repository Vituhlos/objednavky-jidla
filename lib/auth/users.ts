import { getDb } from "../db";
import { logAudit } from "../audit";
import { hasAccount } from "../people";
import { hashPassword, verifyPassword } from "./password";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  status: "active" | "blocked";
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  providers: string[];
  personIds: number[];
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  status: "active" | "blocked";
  emailVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface RegistrationInput {
  email: string;
  name: string;
  departmentId: number | null;
  claimPersonId?: number;
}

class UserInputError extends Error {}

const SELECT_USER = `
  SELECT
    id,
    email,
    name,
    role,
    status,
    email_verified_at AS emailVerifiedAt,
    created_at AS createdAt,
    last_login_at AS lastLoginAt
  FROM users
`;

// Platný otisk neznámého hesla drží dobu chybné odpovědi stejnou i pro adresu,
// která v databázi není. Hodnota není tajemství a nikdy nepatří účtu.
const DUMMY_PASSWORD_HASH =
  "scrypt$17$8$1$AAAAAAAAAAAAAAAAAAAAAA==$dksUA1L27ByEsUKX5S2ymwrix0pFkhoU/2Ds50iC9Zk=";

function requireId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} není platné.`);
}

function normalizeEmail(email: string): { display: string; normalized: string } {
  const display = typeof email === "string" ? email.trim() : "";
  if (
    display.length === 0 ||
    display.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(display)
  ) {
    throw new UserInputError("Zadejte platnou e-mailovou adresu.");
  }
  return { display, normalized: display.toLowerCase() };
}

function normalizeName(name: string): string {
  const normalized = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!normalized) throw new UserInputError("Jméno nesmí být prázdné.");
  if (normalized.length > 200) throw new UserInputError("Jméno je příliš dlouhé.");
  return normalized;
}

function validateSubject(subject: string): string {
  const normalized = typeof subject === "string" ? subject.trim() : "";
  if (!normalized || normalized.length > 255) {
    throw new UserInputError("Identita Google není platná.");
  }
  return normalized;
}

function validateRegistrationInput(input: RegistrationInput): {
  email: string;
  emailNormalized: string;
  name: string;
  departmentId: number | null;
  claimPersonId?: number;
} {
  if (!input || typeof input !== "object") throw new UserInputError("Registraci nelze dokončit.");

  const { display, normalized } = normalizeEmail(input.email);
  const name = normalizeName(input.name);
  const departmentId = input.departmentId;
  if (departmentId !== null) requireId(departmentId, "Oddělení");
  if (input.claimPersonId !== undefined) requireId(input.claimPersonId, "Strávník");

  const db = getDb();
  if (
    departmentId !== null &&
    !db.prepare("SELECT 1 FROM departments WHERE id = ? AND active = 1").get(departmentId)
  ) {
    throw new UserInputError("Vybrané oddělení není aktivní.");
  }

  return {
    email: display,
    emailNormalized: normalized,
    name,
    departmentId,
    claimPersonId: input.claimPersonId,
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT_UNIQUE")
  );
}

function createPersonLink(
  userId: number,
  name: string,
  departmentId: number | null,
  claimPersonId?: number
): number {
  const db = getDb();
  if (claimPersonId !== undefined) {
    const person = db.prepare("SELECT id FROM people WHERE id = ?").get(claimPersonId);
    if (!person) throw new UserInputError("Vybraný strávník neexistuje.");
    if (hasAccount(claimPersonId)) {
      throw new UserInputError("Vybraný strávník už má vlastní účet.");
    }
    db.prepare("UPDATE people SET active = 1 WHERE id = ?").run(claimPersonId);
    db.prepare("INSERT INTO user_people (user_id, person_id) VALUES (?, ?)").run(
      userId,
      claimPersonId
    );
    return claimPersonId;
  }

  const personId = Number(
    db.prepare("INSERT INTO people (name, department_id) VALUES (?, ?)").run(name, departmentId)
      .lastInsertRowid
  );
  db.prepare("INSERT INTO user_people (user_id, person_id) VALUES (?, ?)").run(
    userId,
    personId
  );
  return personId;
}

function toAuthUser(row: UserRow): AuthUser {
  const db = getDb();
  const providers = db
    .prepare("SELECT provider FROM user_identities WHERE user_id = ? ORDER BY provider")
    .all(row.id) as { provider: string }[];
  const people = db
    .prepare("SELECT person_id FROM user_people WHERE user_id = ? ORDER BY person_id")
    .all(row.id) as { person_id: number }[];

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    emailVerified: row.emailVerifiedAt !== null,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    providers: providers.map((item) => item.provider),
    personIds: people.map((item) => item.person_id),
  };
}

function getUserRowById(id: number): UserRow | null {
  const row = getDb().prepare(`${SELECT_USER} WHERE id = ?`).get(id) as UserRow | undefined;
  return row ?? null;
}

function ensureAdminRemains(row: UserRow, message: string): void {
  if (row.role !== "admin" || row.status !== "active") return;
  const other = getDb()
    .prepare("SELECT 1 FROM users WHERE role = 'admin' AND status = 'active' AND id <> ? LIMIT 1")
    .get(row.id);
  if (!other) throw new Error(message);
}

export function createUserWithPassword(input: {
  email: string;
  name: string;
  password: string;
  departmentId: number | null;
  claimPersonId?: number;
}): { userId: number; personId: number } {
  const normalized = validateRegistrationInput(input);

  // Scrypt proběhne i pro duplicitní e-mail, aby čas odpovědi neprozradil,
  // zda už je adresa registrovaná.
  const passwordHash = hashPassword(input.password);
  const db = getDb();

  try {
    const created = db.transaction(() => {
      const userId = Number(
        db
          .prepare(
            "INSERT INTO users (email, email_normalized, password_hash, name) VALUES (?, ?, ?, ?)"
          )
          .run(
            normalized.email,
            normalized.emailNormalized,
            passwordHash,
            normalized.name
          ).lastInsertRowid
      );
      const personId = createPersonLink(
        userId,
        normalized.name,
        normalized.departmentId,
        normalized.claimPersonId
      );
      return { userId, personId };
    })();

    logAudit({
      action: "user_register",
      personName: normalized.name,
      details: `uživatel #${created.userId}`,
    });
    return created;
  } catch (error) {
    if (error instanceof UserInputError) throw error;
    if (isUniqueConstraint(error)) throw new Error("Registraci se nepodařilo dokončit.");
    throw error;
  }
}

export function createUserFromGoogle(input: {
  email: string;
  name: string;
  subject: string;
  departmentId: number | null;
  claimPersonId?: number;
}): { userId: number; personId: number } {
  const normalized = validateRegistrationInput(input);
  const subject = validateSubject(input.subject);
  const db = getDb();

  // Po prvním bezpečném propojení je stabilním klíčem subject, ne proměnlivý e-mail.
  const linked = db
    .prepare("SELECT user_id AS userId FROM user_identities WHERE provider = 'google' AND subject = ?")
    .get(subject) as { userId: number } | undefined;
  if (linked) {
    const person = db
      .prepare("SELECT person_id AS personId FROM user_people WHERE user_id = ? ORDER BY person_id LIMIT 1")
      .get(linked.userId) as { personId: number } | undefined;
    if (!person) throw new Error("Účet nemá přiřazeného strávníka.");
    return { userId: linked.userId, personId: person.personId };
  }

  if (db.prepare("SELECT 1 FROM users WHERE email_normalized = ?").get(normalized.emailNormalized)) {
    throw new Error("Účet už existuje. Propojení s Googlem potvrďte heslem.");
  }

  try {
    const created = db.transaction(() => {
      const userId = Number(
        db
          .prepare(
            "INSERT INTO users (email, email_normalized, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
          )
          .run(normalized.email, normalized.emailNormalized, normalized.name).lastInsertRowid
      );
      db.prepare(
        "INSERT INTO user_identities (user_id, provider, subject) VALUES (?, 'google', ?)"
      ).run(userId, subject);
      const personId = createPersonLink(
        userId,
        normalized.name,
        normalized.departmentId,
        normalized.claimPersonId
      );
      return { userId, personId };
    })();

    logAudit({
      action: "user_register",
      personName: normalized.name,
      details: `uživatel #${created.userId} přes Google`,
    });
    return created;
  } catch (error) {
    if (error instanceof UserInputError) throw error;
    if (isUniqueConstraint(error)) throw new Error("Registraci se nepodařilo dokončit.");
    throw error;
  }
}

export function getUserByEmail(email: string): AuthUser | null {
  let normalized: string;
  try {
    normalized = normalizeEmail(email).normalized;
  } catch {
    return null;
  }
  const row = getDb()
    .prepare(`${SELECT_USER} WHERE email_normalized = ?`)
    .get(normalized) as UserRow | undefined;
  return row ? toAuthUser(row) : null;
}

export function getUserById(id: number): AuthUser | null {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const row = getUserRowById(id);
  return row ? toAuthUser(row) : null;
}

export function listUsers(): AuthUser[] {
  const rows = getDb()
    .prepare(`${SELECT_USER} ORDER BY name COLLATE NOCASE, id`)
    .all() as UserRow[];
  return rows.map(toAuthUser);
}

export function authenticateWithPassword(email: string, plain: string): AuthUser | null {
  let normalized: string | null = null;
  try {
    normalized = normalizeEmail(email).normalized;
  } catch {}

  const row = normalized
    ? (getDb()
        .prepare("SELECT id, password_hash AS passwordHash FROM users WHERE email_normalized = ?")
        .get(normalized) as { id: number; passwordHash: string | null } | undefined)
    : undefined;
  const verified = verifyPassword(plain, row?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!row || !row.passwordHash || !verified) {
    logAudit({ action: "user_login_failed", details: "neplatné přihlašovací údaje" });
    return null;
  }
  return getUserById(row.id);
}

export function verifyUserPassword(userId: number, plain: string): boolean {
  const row = Number.isSafeInteger(userId)
    ? (getDb()
        .prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ?")
        .get(userId) as { passwordHash: string | null } | undefined)
    : undefined;
  return verifyPassword(plain, row?.passwordHash ?? DUMMY_PASSWORD_HASH) && !!row?.passwordHash;
}

export function setUserStatus(id: number, status: "active" | "blocked"): void {
  requireId(id, "Uživatel");
  if (status !== "active" && status !== "blocked") throw new Error("Stav účtu není platný.");

  const row = getUserRowById(id);
  if (!row) throw new Error("Uživatel neexistuje.");
  if (row.status === status) return;
  if (status === "blocked") {
    ensureAdminRemains(row, "Posledního aktivního správce nelze zablokovat.");
  }

  getDb().transaction(() => {
    getDb().prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
    if (status === "blocked") {
      // Řádek zůstane do absolutního stropu jen kvůli rozlišení BLOKOVAN;
      // prošlá nečinnost zabrání jeho oživení po případném odblokování.
      getDb()
        .prepare("UPDATE sessions SET idle_expires_at = datetime('now') WHERE user_id = ?")
        .run(id);
    }
  })();
  logAudit({
    action: status === "blocked" ? "user_block" : "user_unblock",
    personName: row.name,
    details: `uživatel #${id}`,
  });
}

export function setUserRole(id: number, role: "admin" | "user"): void {
  requireId(id, "Uživatel");
  if (role !== "admin" && role !== "user") throw new Error("Role účtu není platná.");

  const row = getUserRowById(id);
  if (!row) throw new Error("Uživatel neexistuje.");
  if (row.role === role) return;
  if (role === "user") {
    ensureAdminRemains(row, "Poslednímu aktivnímu správci nelze odebrat roli.");
  }

  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  logAudit({
    action: "user_role_change",
    personName: row.name,
    details: `uživatel #${id}: ${row.role} → ${role}`,
  });
}

export function deleteUser(id: number): void {
  requireId(id, "Uživatel");
  const row = getUserRowById(id);
  if (!row) throw new Error("Uživatel neexistuje.");
  ensureAdminRemains(row, "Posledního aktivního správce nelze smazat.");

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      "UPDATE people SET active = 0 WHERE id IN (SELECT person_id FROM user_people WHERE user_id = ?)"
    ).run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  })();
  logAudit({ action: "user_delete", personName: row.name, details: `uživatel #${id}` });
}

export function changePassword(
  userId: number,
  newPlain: string,
  exceptSessionId?: number
): void {
  requireId(userId, "Uživatel");
  if (exceptSessionId !== undefined) requireId(exceptSessionId, "Sezení");
  const passwordHash = hashPassword(newPlain);
  const row = getUserRowById(userId);
  if (!row) throw new Error("Uživatel neexistuje.");

  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    if (exceptSessionId === undefined) {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    } else {
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(
        userId,
        exceptSessionId
      );
    }
    db.prepare(
      "UPDATE settings SET value = '0' WHERE key = 'auth_bootstrap_password_unchanged' AND (SELECT value FROM settings WHERE key = 'auth_bootstrap_user_id') = ?"
    ).run(String(userId));
  })();
  logAudit({ action: "password_change", personName: row.name, details: `uživatel #${userId}` });
}

export function linkGoogleIdentity(userId: number, subject: string): void {
  requireId(userId, "Uživatel");
  const normalizedSubject = validateSubject(subject);
  const row = getUserRowById(userId);
  if (!row) throw new Error("Uživatel neexistuje.");

  const existing = getDb()
    .prepare("SELECT user_id AS userId FROM user_identities WHERE provider = 'google' AND subject = ?")
    .get(normalizedSubject) as { userId: number } | undefined;
  if (existing?.userId === userId) return;
  if (existing) throw new Error("Tato identita Google už patří jinému účtu.");

  getDb()
    .prepare("INSERT INTO user_identities (user_id, provider, subject) VALUES (?, 'google', ?)")
    .run(userId, normalizedSubject);
  logAudit({ action: "google_link", personName: row.name, details: `uživatel #${userId}` });
}

export function markEmailVerified(userId: number): void {
  requireId(userId, "Uživatel");
  const row = getUserRowById(userId);
  if (!row) throw new Error("Uživatel neexistuje.");
  if (row.emailVerifiedAt !== null) return;

  getDb().prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(userId);
  logAudit({ action: "email_verify", personName: row.name, details: `uživatel #${userId}` });
}

export function isBootstrapPasswordUnchanged(): boolean {
  const row = getDb()
    .prepare(`
      SELECT 1
      FROM settings flag
      JOIN settings owner ON owner.key = 'auth_bootstrap_user_id'
      JOIN users u ON u.id = CAST(owner.value AS INTEGER)
      WHERE flag.key = 'auth_bootstrap_password_unchanged' AND flag.value = '1'
    `)
    .get();
  return !!row;
}
