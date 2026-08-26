import type Database from "better-sqlite3";
import { hashPassword } from "./password";

function bootstrapFirstAdmin(db: Database.Database): void {
  const adminExists = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
  if (adminExists) return;

  const email = process.env.ADMIN_EMAIL?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) return;

  const emailNormalized = email.toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL nemá platný formát e-mailové adresy.");
  }

  // Výpočet proběhne až po ověření, že správce chybí, aby každý start neplatil
  // cenu scryptu a hlavně nikdy znovu nepřepsal již změněné heslo.
  const passwordHash = hashPassword(password);

  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()) return;
    if (db.prepare("SELECT 1 FROM users WHERE email_normalized = ?").get(emailNormalized)) {
      throw new Error("ADMIN_EMAIL už používá účet bez role správce.");
    }

    const name = process.env.ADMIN_NAME?.trim() || "Správce";
    const userId = Number(
      db
        .prepare(
          "INSERT INTO users (email, email_normalized, email_verified_at, password_hash, name, role) VALUES (?, ?, datetime('now'), ?, ?, 'admin')"
        )
        .run(email, emailNormalized, passwordHash, name).lastInsertRowid
    );
    const personId = Number(
      db.prepare("INSERT INTO people (name, department_id) VALUES (?, NULL)").run(name)
        .lastInsertRowid
    );
    db.prepare("INSERT INTO user_people (user_id, person_id) VALUES (?, ?)").run(
      userId,
      personId
    );
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
      "auth_bootstrap_user_id",
      String(userId)
    );
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, '1')").run(
      "auth_bootstrap_password_unchanged"
    );
    db.prepare(
      "INSERT INTO audit_log (action, person_name, details) VALUES ('user_register', ?, ?)"
    ).run(name, `bootstrap správce #${userId}`);
  })();
}

export function migrateAuth(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      email             TEXT    NOT NULL,
      email_normalized  TEXT    NOT NULL UNIQUE,
      email_verified_at TEXT,
      password_hash     TEXT,
      name              TEXT    NOT NULL,
      role              TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      status            TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      last_login_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS user_identities (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider  TEXT    NOT NULL CHECK (provider = 'google'),
      subject   TEXT    NOT NULL,
      linked_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, subject)
    );

    CREATE TABLE IF NOT EXISTS user_people (
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, person_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash          TEXT    NOT NULL UNIQUE,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      last_seen_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      idle_expires_at     TEXT    NOT NULL,
      absolute_expires_at TEXT    NOT NULL,
      persistent          INTEGER NOT NULL DEFAULT 0 CHECK (persistent IN (0, 1)),
      user_agent          TEXT
    );

    CREATE TABLE IF NOT EXISTS login_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose    TEXT    NOT NULL CHECK (purpose IN ('reset', 'verify')),
      token_hash TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      used_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS guest_invites (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash        TEXT    NOT NULL UNIQUE,
      inviter_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      expires_at        TEXT    NOT NULL,
      used_at           TEXT,
      revoked_at        TEXT,
      created_person_id INTEGER REFERENCES people(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_tokens_user_id ON login_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_guest_invites_inviter_user_id ON guest_invites(inviter_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_people_person_id ON user_people(person_id);
  `);

  bootstrapFirstAdmin(db);
}
