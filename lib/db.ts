import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "stros.db");

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!instance) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    instance = new Database(DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    migrate(instance);
  }
  return instance;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      week_label  TEXT,
      day         TEXT    NOT NULL,
      type        TEXT    NOT NULL,
      code        TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      price       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL UNIQUE,
      status      TEXT    NOT NULL DEFAULT 'draft',
      extra_email TEXT,
      sent_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS order_rows (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id               INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      department             TEXT    NOT NULL,
      sort_order             INTEGER NOT NULL DEFAULT 0,
      person_name            TEXT    NOT NULL DEFAULT '',
      soup_item_id           INTEGER REFERENCES menu_items(id),
      main_item_id           INTEGER REFERENCES menu_items(id),
      roll_count             INTEGER NOT NULL DEFAULT 0,
      bread_dumpling_count   INTEGER NOT NULL DEFAULT 0,
      potato_dumpling_count  INTEGER NOT NULL DEFAULT 0,
      ketchup_count          INTEGER NOT NULL DEFAULT 0,
      tatarka_count          INTEGER NOT NULL DEFAULT 0,
      bbq_count              INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pizza_items (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      code  INTEGER NOT NULL,
      name  TEXT    NOT NULL,
      price INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pizza_orders (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      date    TEXT    NOT NULL UNIQUE,
      status  TEXT    NOT NULL DEFAULT 'draft',
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pizza_order_rows (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id      INTEGER NOT NULL REFERENCES pizza_orders(id) ON DELETE CASCADE,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      person_name   TEXT    NOT NULL DEFAULT '',
      pizza_item_id INTEGER REFERENCES pizza_items(id),
      count         INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Add week_start column to existing databases (idempotent)
  try { db.exec("ALTER TABLE menu_items ADD COLUMN week_start TEXT"); } catch {}
  // Add note column to order_rows (idempotent)
  try { db.exec("ALTER TABLE order_rows ADD COLUMN note TEXT NOT NULL DEFAULT ''"); } catch {}
  // Add meal count + second meal columns (idempotent)
  try { db.exec("ALTER TABLE order_rows ADD COLUMN meal_count INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE order_rows ADD COLUMN main_item_id_2 INTEGER REFERENCES menu_items(id)"); } catch {}
  try { db.exec("ALTER TABLE order_rows ADD COLUMN meal_count_2 INTEGER NOT NULL DEFAULT 1"); } catch {}
  // Add second soup + dynamic extra meals JSON (idempotent)
  try { db.exec("ALTER TABLE order_rows ADD COLUMN soup_item_id_2 INTEGER REFERENCES menu_items(id)"); } catch {}
  try { db.exec("ALTER TABLE order_rows ADD COLUMN extra_meals TEXT NOT NULL DEFAULT '[]'"); } catch {}
  // Migrate old main_item_id_2 into extra_meals JSON where not yet migrated
  try {
    db.exec(`UPDATE order_rows SET extra_meals = json_array(json_object('itemId', main_item_id_2, 'count', COALESCE(meal_count_2, 1))) WHERE main_item_id_2 IS NOT NULL AND extra_meals = '[]'`);
  } catch {}

  // Departments table (dynamic, replaces hardcoded DEPARTMENTS constant)
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      label       TEXT    NOT NULL,
      email_label TEXT    NOT NULL,
      accent      TEXT    NOT NULL DEFAULT 'blue',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO departments (name, label, email_label, accent, sort_order) VALUES
      ('Konstrukce',  'Konstrukce',          'Konstrukce',          'blue',  0),
      ('Dílna',       'Dílna',               'Dílna',               'rust',  1),
      ('Kanceláře',   'Kanceláře / obchod',  'Kanceláře (obchod)',  'green', 2);
  `);

  // Rate limits table (replaces in-memory Map)
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key      TEXT    PRIMARY KEY,
      count    INTEGER NOT NULL DEFAULT 0,
      reset_at INTEGER NOT NULL
    );
  `);

  // Audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ts          TEXT    NOT NULL DEFAULT (datetime('now')),
      action      TEXT    NOT NULL,
      order_id    INTEGER,
      department  TEXT,
      person_name TEXT,
      details     TEXT
    );
  `);

  // User accounts
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      first_name    TEXT    NOT NULL,
      last_name     TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      token      TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  try { db.exec("ALTER TABLE order_rows ADD COLUMN user_id INTEGER REFERENCES users(id)"); } catch {}
  try { db.exec("ALTER TABLE pizza_order_rows ADD COLUMN user_id INTEGER REFERENCES users(id)"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN default_department TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN email_order_confirmation INTEGER NOT NULL DEFAULT 0"); } catch {}

  // Password reset tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Indexes for frequently queried columns (idempotent)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_rows_order_id ON order_rows(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
    CREATE INDEX IF NOT EXISTS idx_menu_items_day_week ON menu_items(week_start, day);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
  `);
}
