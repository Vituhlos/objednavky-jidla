import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "stros.db");

let instance: Database.Database | null = null;

/** Složka s databází — v Dockeru mountovaný volume, patří sem i další trvalá data. */
export function getDataDir(): string {
  return path.dirname(DB_PATH);
}

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

/**
 * Přidá sloupec do existující databáze. U už zmigrované databáze SQLite hlásí
 * „duplicate column name" — to je očekávaný stav a přechází se mlčky. Cokoli
 * jiného je skutečná chyba: start kvůli ní nepadá (jako dosud), ale jde do logu.
 */
function addColumn(db: Database.Database, sql: string): void {
  try {
    db.exec(sql);
  } catch (err) {
    const message = (err as Error).message;
    if (!/duplicate column name/i.test(message)) console.error(`[db] Migrace selhala (${sql}):`, message);
  }
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
  addColumn(db, "ALTER TABLE menu_items ADD COLUMN week_start TEXT");
  // Add note column to order_rows (idempotent)
  addColumn(db, "ALTER TABLE order_rows ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  // Add meal count + second meal columns (idempotent)
  addColumn(db, "ALTER TABLE order_rows ADD COLUMN meal_count INTEGER NOT NULL DEFAULT 1");
  addColumn(db, "ALTER TABLE order_rows ADD COLUMN main_item_id_2 INTEGER REFERENCES menu_items(id)");
  addColumn(db, "ALTER TABLE order_rows ADD COLUMN meal_count_2 INTEGER NOT NULL DEFAULT 1");
  // Add second soup + dynamic extra meals JSON (idempotent)
  addColumn(db, "ALTER TABLE order_rows ADD COLUMN soup_item_id_2 INTEGER REFERENCES menu_items(id)");
  addColumn(db, "ALTER TABLE order_rows ADD COLUMN extra_meals TEXT NOT NULL DEFAULT '[]'");
  // Migrate old main_item_id_2 into extra_meals JSON where not yet migrated
  try {
    db.exec(`UPDATE order_rows SET extra_meals = json_array(json_object('itemId', main_item_id_2, 'count', COALESCE(meal_count_2, 1))) WHERE main_item_id_2 IS NOT NULL AND extra_meals = '[]'`);
  } catch (err) {
    console.error("[db] Migrace extra_meals selhala:", (err as Error).message);
  }

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
  addColumn(db, "ALTER TABLE telegram_subscriptions ADD COLUMN notify_reminder INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "ALTER TABLE telegram_subscriptions ADD COLUMN notify_morning_menu INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "ALTER TABLE telegram_subscriptions ADD COLUMN notify_order_sent INTEGER NOT NULL DEFAULT 1");
  addColumn(db, "ALTER TABLE telegram_subscriptions ADD COLUMN notify_menu_imported INTEGER NOT NULL DEFAULT 1");
  addColumn(db, "ALTER TABLE telegram_subscriptions ADD COLUMN personal_reminder_time TEXT DEFAULT NULL");
  addColumn(db, "ALTER TABLE telegram_subscriptions ADD COLUMN personal_morning_menu_time TEXT DEFAULT NULL");
  // Upozornění na nové připomínky — jen pro adminy a jen když si ho sami zapnou.
  addColumn(db, "ALTER TABLE telegram_subscriptions ADD COLUMN notify_feedback INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "ALTER TABLE order_rows ADD COLUMN push_endpoint TEXT");
  addColumn(db, "ALTER TABLE menu_items ADD COLUMN allergens TEXT NOT NULL DEFAULT ''");

  db.prepare(`
    CREATE TABLE IF NOT EXISTS menu_day_closed (
      week_start TEXT NOT NULL,
      day        TEXT NOT NULL,
      PRIMARY KEY (week_start, day)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS closures (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL,
      label      TEXT NOT NULL DEFAULT '',
      note       TEXT NOT NULL DEFAULT '',
      icon       TEXT NOT NULL DEFAULT ''
    )
  `).run();
  // note + icon were added after closures shipped — idempotent for existing databases
  addColumn(db, "ALTER TABLE closures ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  addColumn(db, "ALTER TABLE closures ADD COLUMN icon TEXT NOT NULL DEFAULT ''");

  // Připomínky k aplikaci. Záměrně bez IP adresy a celého user-agentu —
  // appka nemá účty a autor má zůstat dohledatelný jen pokud se sám podepíše.
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      category     TEXT    NOT NULL,
      message      TEXT    NOT NULL,
      author_name  TEXT    NOT NULL DEFAULT '',
      page         TEXT    NOT NULL DEFAULT '',
      device       TEXT    NOT NULL DEFAULT '',
      status       TEXT    NOT NULL DEFAULT 'new',
      admin_note   TEXT    NOT NULL DEFAULT '',
      public_reply TEXT    NOT NULL DEFAULT '',
      resolved_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
  `);
  // Doplněno během vývoje připomínek — idempotentní i pro už založené tabulky.
  // secret_hash: SHA-256 tajného kódu, přes který autor vidí stav své připomínky.
  addColumn(db, "ALTER TABLE feedback ADD COLUMN secret_hash TEXT NOT NULL DEFAULT ''");
  // context: technický údaj z chybové stránky (kód chyby), app_version: verze u autora
  addColumn(db, "ALTER TABLE feedback ADD COLUMN context TEXT NOT NULL DEFAULT ''");
  addColumn(db, "ALTER TABLE feedback ADD COLUMN app_version TEXT NOT NULL DEFAULT ''");
  // Kdy se naposledy změnil stav — podle toho se po 90 dnech mažou screenshoty vyřízených
  addColumn(db, "ALTER TABLE feedback ADD COLUMN status_changed_at TEXT");
  // Správce připomínku výslovně zveřejní k hlasování; veřejně jde jen jeho shrnutí
  addColumn(db, "ALTER TABLE feedback ADD COLUMN votable INTEGER NOT NULL DEFAULT 0");
  // Krátký název k hlasování — odpověď autorovi („Díky, podíváme se…“) se na to nehodí
  addColumn(db, "ALTER TABLE feedback ADD COLUMN vote_title TEXT NOT NULL DEFAULT ''");
  // Úkol na GitHubu, který k připomínce vznikl (dohledá se podle značky v textu úkolu)
  addColumn(db, "ALTER TABLE feedback ADD COLUMN github_issue INTEGER");
  addColumn(db, "ALTER TABLE feedback ADD COLUMN github_issue_state TEXT NOT NULL DEFAULT ''");
  // Veřejnost připomínky určuje kategorie (PUBLIC_CATEGORIES); hidden = správce ji
  // z „Připomínek ostatních“ skryl (nevhodný obsah, duplicita).
  addColumn(db, "ALTER TABLE feedback ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
  // Návrh napsaný správcem v Nastavení — není od uživatele, nemá tajný kód autora
  addColumn(db, "ALTER TABLE feedback ADD COLUMN is_proposal INTEGER NOT NULL DEFAULT 0");
  // Sloučená duplicita: id připomínky, do které se sloučila (hlasy se přesunuly tam)
  addColumn(db, "ALTER TABLE feedback ADD COLUMN merged_into INTEGER");

  // Hlasy „chci taky“. voter_hash = SHA-256 náhodného kódu z prohlížeče —
  // jeden hlas na prohlížeč a věc; IP se neukládá.
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback_votes (
      feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      voter_hash  TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (feedback_id, voter_hash)
    );
  `);
  // 👍 = 1, 👎 = -1. Hlasy z doby „chci taky“ jsou všechny 👍.
  addColumn(db, "ALTER TABLE feedback_votes ADD COLUMN value INTEGER NOT NULL DEFAULT 1");

  // Screenshoty k připomínkám. Soubory leží v <data>/feedback-attachments,
  // tady je jen evidence. Řádky mizí s připomínkou (CASCADE), soubory maže kód.
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback_attachments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      file_name   TEXT    NOT NULL UNIQUE,
      mime        TEXT    NOT NULL,
      size        INTEGER NOT NULL,
      width       INTEGER NOT NULL,
      height      INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_attachments_feedback ON feedback_attachments(feedback_id);
  `);

  // Performance indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_rows_order_id ON order_rows(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
    CREATE INDEX IF NOT EXISTS idx_menu_items_day_week ON menu_items(week_start, day);
    CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
  `);

  // Add department column to pizza_order_rows (idempotent)
  addColumn(db, "ALTER TABLE pizza_order_rows ADD COLUMN department TEXT NOT NULL DEFAULT ''");
}
