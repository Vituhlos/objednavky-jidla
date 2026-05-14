import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrations";
import type { Migration } from "./migrations";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

const cache = new Map<string, Database.Database>();

export function getTenantDb(slug: string): Database.Database {
  if (!SLUG_RE.test(slug)) throw new Error(`Invalid tenant slug: "${slug}"`);
  let db = cache.get(slug);
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(path.join(DATA_DIR, `${slug}.db`));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db, TENANT_MIGRATIONS);
    cache.set(slug, db);
  }
  return db;
}

export const TENANT_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          week_label TEXT,
          day        TEXT    NOT NULL,
          type       TEXT    NOT NULL,
          code       TEXT    NOT NULL,
          name       TEXT    NOT NULL,
          price      INTEGER NOT NULL DEFAULT 0
        )
      `).run();
      db.prepare(`
        CREATE TABLE IF NOT EXISTS orders (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          date        TEXT    NOT NULL UNIQUE,
          status      TEXT    NOT NULL DEFAULT 'draft',
          extra_email TEXT,
          sent_at     TEXT
        )
      `).run();
      db.prepare(`
        CREATE TABLE IF NOT EXISTS order_rows (
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id              INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          department            TEXT    NOT NULL,
          sort_order            INTEGER NOT NULL DEFAULT 0,
          person_name           TEXT    NOT NULL DEFAULT '',
          soup_item_id          INTEGER REFERENCES menu_items(id),
          main_item_id          INTEGER REFERENCES menu_items(id),
          roll_count            INTEGER NOT NULL DEFAULT 0,
          bread_dumpling_count  INTEGER NOT NULL DEFAULT 0,
          potato_dumpling_count INTEGER NOT NULL DEFAULT 0,
          ketchup_count         INTEGER NOT NULL DEFAULT 0,
          tatarka_count         INTEGER NOT NULL DEFAULT 0,
          bbq_count             INTEGER NOT NULL DEFAULT 0
        )
      `).run();
      db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL DEFAULT ''
        )
      `).run();
    },
  },
  {
    version: 2,
    name: "menu_items_week_start",
    up: (db) => {
      try { db.prepare("ALTER TABLE menu_items ADD COLUMN week_start TEXT").run(); } catch {}
    },
  },
  {
    version: 3,
    name: "order_rows_note",
    up: (db) => {
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN note TEXT NOT NULL DEFAULT ''").run(); } catch {}
    },
  },
  {
    version: 4,
    name: "order_rows_meal_count",
    up: (db) => {
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN meal_count INTEGER NOT NULL DEFAULT 1").run(); } catch {}
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN main_item_id_2 INTEGER REFERENCES menu_items(id)").run(); } catch {}
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN meal_count_2 INTEGER NOT NULL DEFAULT 1").run(); } catch {}
    },
  },
  {
    version: 5,
    name: "order_rows_extra_meals",
    up: (db) => {
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN soup_item_id_2 INTEGER REFERENCES menu_items(id)").run(); } catch {}
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN extra_meals TEXT NOT NULL DEFAULT '[]'").run(); } catch {}
    },
  },
  {
    version: 6,
    name: "migrate_extra_meals_json",
    up: (db) => {
      try {
        db.prepare(`
          UPDATE order_rows
          SET    extra_meals = json_array(json_object('itemId', main_item_id_2, 'count', COALESCE(meal_count_2, 1)))
          WHERE  main_item_id_2 IS NOT NULL AND extra_meals = '[]'
        `).run();
      } catch {}
    },
  },
  {
    version: 7,
    name: "departments",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS departments (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL UNIQUE,
          label       TEXT    NOT NULL,
          email_label TEXT    NOT NULL,
          accent      TEXT    NOT NULL DEFAULT 'blue',
          sort_order  INTEGER NOT NULL DEFAULT 0,
          active      INTEGER NOT NULL DEFAULT 1
        )
      `).run();
      const ins = db.prepare(
        "INSERT OR IGNORE INTO departments (name, label, email_label, accent, sort_order) VALUES (?, ?, ?, ?, ?)"
      );
      ins.run("Konstrukce", "Konstrukce", "Konstrukce", "blue", 0);
      ins.run("Dílna", "Dílna", "Dílna", "rust", 1);
      ins.run("Kanceláře", "Kanceláře / obchod", "Kanceláře (obchod)", "green", 2);
    },
  },
  {
    version: 8,
    name: "rate_limits",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key      TEXT    PRIMARY KEY,
          count    INTEGER NOT NULL DEFAULT 0,
          reset_at INTEGER NOT NULL
        )
      `).run();
    },
  },
  {
    version: 9,
    name: "audit_log",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          ts          TEXT    NOT NULL DEFAULT (datetime('now')),
          action      TEXT    NOT NULL,
          order_id    INTEGER,
          department  TEXT,
          person_name TEXT,
          details     TEXT
        )
      `).run();
    },
  },
  {
    version: 10,
    name: "users_sessions",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT    NOT NULL UNIQUE,
          first_name    TEXT    NOT NULL,
          last_name     TEXT    NOT NULL,
          password_hash TEXT    NOT NULL,
          role          TEXT    NOT NULL DEFAULT 'user',
          created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
          active        INTEGER NOT NULL DEFAULT 1
        )
      `).run();
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sessions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id),
          token      TEXT    NOT NULL UNIQUE,
          expires_at TEXT    NOT NULL,
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
    },
  },
  {
    version: 11,
    name: "order_rows_user_id",
    up: (db) => {
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN user_id INTEGER REFERENCES users(id)").run(); } catch {}
    },
  },
  {
    version: 12,
    name: "users_extra_columns",
    up: (db) => {
      try { db.prepare("ALTER TABLE users ADD COLUMN default_department TEXT").run(); } catch {}
      try { db.prepare("ALTER TABLE users ADD COLUMN email_order_confirmation INTEGER NOT NULL DEFAULT 0").run(); } catch {}
    },
  },
  {
    version: 13,
    name: "menu_items_allergens",
    up: (db) => {
      try { db.prepare("ALTER TABLE menu_items ADD COLUMN allergens TEXT NOT NULL DEFAULT ''").run(); } catch {}
    },
  },
  {
    version: 14,
    name: "password_reset_tokens",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token      TEXT    NOT NULL UNIQUE,
          expires_at TEXT    NOT NULL,
          used       INTEGER NOT NULL DEFAULT 0,
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
    },
  },
  {
    version: 15,
    name: "push_subscriptions",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          endpoint   TEXT    NOT NULL UNIQUE,
          p256dh     TEXT    NOT NULL,
          auth       TEXT    NOT NULL,
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
    },
  },
  {
    version: 16,
    name: "telegram_subscriptions",
    up: (db) => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS telegram_subscriptions (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id         TEXT    NOT NULL UNIQUE,
          first_name      TEXT    NOT NULL DEFAULT '',
          username        TEXT    NOT NULL DEFAULT '',
          is_admin        INTEGER NOT NULL DEFAULT 0,
          notify_reminder INTEGER NOT NULL DEFAULT 0,
          registered_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
    },
  },
  {
    version: 17,
    name: "telegram_notification_columns",
    up: (db) => {
      try { db.prepare("ALTER TABLE telegram_subscriptions ADD COLUMN notify_morning_menu INTEGER NOT NULL DEFAULT 0").run(); } catch {}
      try { db.prepare("ALTER TABLE telegram_subscriptions ADD COLUMN notify_order_sent INTEGER NOT NULL DEFAULT 1").run(); } catch {}
      try { db.prepare("ALTER TABLE telegram_subscriptions ADD COLUMN notify_menu_imported INTEGER NOT NULL DEFAULT 1").run(); } catch {}
    },
  },
  {
    version: 18,
    name: "order_rows_push_endpoint",
    up: (db) => {
      try { db.prepare("ALTER TABLE order_rows ADD COLUMN push_endpoint TEXT").run(); } catch {}
    },
  },
  {
    version: 19,
    name: "indexes",
    up: (db) => {
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_order_rows_order_id ON order_rows(order_id)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_menu_items_day_week ON menu_items(week_start, day)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token)`).run();
    },
  },
];
