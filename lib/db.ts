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

  // Push subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint   TEXT    NOT NULL UNIQUE,
      p256dh     TEXT    NOT NULL,
      auth       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Telegram subscriptions (multi-user bot)
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_subscriptions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id         TEXT    NOT NULL UNIQUE,
      first_name      TEXT    NOT NULL DEFAULT '',
      username        TEXT    NOT NULL DEFAULT '',
      is_admin        INTEGER NOT NULL DEFAULT 0,
      notify_reminder INTEGER NOT NULL DEFAULT 0,
      registered_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  try { db.exec("ALTER TABLE telegram_subscriptions ADD COLUMN notify_reminder INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE telegram_subscriptions ADD COLUMN notify_morning_menu INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE telegram_subscriptions ADD COLUMN notify_order_sent INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE telegram_subscriptions ADD COLUMN notify_menu_imported INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE telegram_subscriptions ADD COLUMN personal_reminder_time TEXT DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE telegram_subscriptions ADD COLUMN personal_morning_menu_time TEXT DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE order_rows ADD COLUMN push_endpoint TEXT"); } catch {}
  try { db.exec("ALTER TABLE menu_items ADD COLUMN allergens TEXT NOT NULL DEFAULT ''"); } catch {}

  // Auth users — centralizovaný profil; provider/subject je pro backward compat OIDC,
  // ale Credentials i Google používají accounts tabulku níže pro multi-provider linking.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      provider      TEXT    NOT NULL DEFAULT 'credentials',
      subject       TEXT    NOT NULL DEFAULT '',
      email         TEXT,
      name          TEXT,
      avatar_url    TEXT,
      role          TEXT    NOT NULL DEFAULT 'user',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, subject)
    );
  `);
  // Sloupce pro Credentials provider + profilové údaje
  try { db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN default_department TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1"); } catch {}

  // Account linking — jeden user, vícero providerů (Credentials, Google, ...)
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider             TEXT    NOT NULL,
      provider_account_id  TEXT    NOT NULL,
      created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (provider, provider_account_id)
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
  `);

  // Migrate existing users.provider/subject → accounts řádek
  try {
    db.exec(`
      INSERT OR IGNORE INTO accounts (user_id, provider, provider_account_id)
      SELECT id, provider, subject FROM users WHERE provider != '' AND subject != '';
    `);
  } catch {}

  // Email verification tokens (link v emailu — platí 24h)
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Password reset tokens (link v emailu — platí 1h)
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

  // Vlastnictví objednávkových řádků
  try { db.exec("ALTER TABLE order_rows ADD COLUMN user_id INTEGER REFERENCES users(id)"); } catch {}
  try { db.exec("ALTER TABLE pizza_order_rows ADD COLUMN user_id INTEGER REFERENCES users(id)"); } catch {}

  db.prepare(`
    CREATE TABLE IF NOT EXISTS menu_day_closed (
      week_start TEXT NOT NULL,
      day        TEXT NOT NULL,
      PRIMARY KEY (week_start, day)
    )
  `).run();

  // Performance indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_rows_order_id ON order_rows(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
    CREATE INDEX IF NOT EXISTS idx_menu_items_day_week ON menu_items(week_start, day);
    CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
  `);

  // Add department column to pizza_order_rows (idempotent)
  try { db.prepare("ALTER TABLE pizza_order_rows ADD COLUMN department TEXT NOT NULL DEFAULT ''").run(); } catch {}
}
