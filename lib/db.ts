import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { migrateAuth } from "./auth/schema";

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
  try { db.exec("ALTER TABLE closures ADD COLUMN note TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE closures ADD COLUMN icon TEXT NOT NULL DEFAULT ''"); } catch {}

  // ── Strávníci ──────────────────────────────────────────────────────────────
  //
  // Do téhle chvíle byl člověk jen text v řádku objednávky, jiný pro každý den.
  // `people` z něj dělá stálou entitu, na kterou jde navázat historii, účet
  // nebo telefonní číslo.
  //
  // Jméno **není** jedinečné. Dva kolegové se můžou jmenovat stejně a systém
  // je nikdy nesmí spojit — sloučení je vždy vědomý krok správce.
  db.prepare(`
    CREATE TABLE IF NOT EXISTS people (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL,
      department_id      INTEGER REFERENCES departments(id),
      guest_of_person_id INTEGER REFERENCES people(id),
      active             INTEGER NOT NULL DEFAULT 1,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // `person_name` v řádku zůstává jako otisk jména v době objednávky. Bez něj
  // by přejmenování nebo smazání strávníka přepsalo loňské objednávky.
  try { db.exec("ALTER TABLE order_rows ADD COLUMN person_id INTEGER REFERENCES people(id)"); } catch {}

  // Performance indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_rows_order_id ON order_rows(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
    CREATE INDEX IF NOT EXISTS idx_menu_items_day_week ON menu_items(week_start, day);
    CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_order_rows_person_id ON order_rows(person_id);
    CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
  `);

  backfillPeople(db);
  migrateAuth(db);

  // Add department column to pizza_order_rows (idempotent)
  try { db.prepare("ALTER TABLE pizza_order_rows ADD COLUMN department TEXT NOT NULL DEFAULT ''").run(); } catch {}
  try { db.exec("ALTER TABLE pizza_order_rows ADD COLUMN person_id INTEGER REFERENCES people(id)"); } catch {}
  db.exec("CREATE INDEX IF NOT EXISTS idx_pizza_order_rows_person_id ON pizza_order_rows(person_id)");

  // Historické pizza řádky nejdou bezpečně přiřadit jen podle textového jména.
  // Nejednoznačné NULL proto zůstává upravitelné pouze správcem.
}

/**
 * Založí strávníky z historických jmen a napojí na ně existující řádky.
 *
 * Běží při každém startu, ale zabere jen na řádcích, které ještě `person_id`
 * nemají — takže je bezpečné ji pustit opakovaně.
 *
 * **Klíčem je dvojice (jméno, oddělení), ne samotné jméno.** „Petr Novák“
 * v Konstrukci a „Petr Novák“ v Dílně vzniknou jako dva strávníci. U jednoho
 * člověka, který mezi odděleními přešel, je to duplicita — tu správce sloučí.
 * Opačná volba by ale spojila dva různé lidi, a to je chyba, kterou už nikdo
 * nerozplete. Rozdělené jde spojit, spojené ne.
 */
export function backfillPeople(db: import("better-sqlite3").Database): void {
  const pending = db
    .prepare("SELECT COUNT(*) AS n FROM order_rows WHERE person_id IS NULL AND TRIM(person_name) <> ''")
    .get() as { n: number };
  if (pending.n === 0) return;

  const pairs = db
    .prepare(`
      SELECT TRIM(person_name) AS name, department
      FROM order_rows
      WHERE person_id IS NULL AND TRIM(person_name) <> ''
      GROUP BY TRIM(person_name), department
    `)
    .all() as { name: string; department: string }[];

  const findDept = db.prepare("SELECT id FROM departments WHERE name = ?");
  const findPerson = db.prepare(
    "SELECT id FROM people WHERE name = ? AND (department_id IS ? OR department_id = ?)"
  );
  const insertPerson = db.prepare("INSERT INTO people (name, department_id) VALUES (?, ?)");
  const linkRows = db.prepare(
    "UPDATE order_rows SET person_id = ? WHERE person_id IS NULL AND TRIM(person_name) = ? AND department = ?"
  );

  db.transaction(() => {
    for (const { name, department } of pairs) {
      // Oddělení mohlo být mezitím smazané nebo přejmenované — pak zůstane null
      // a správce strávníka zařadí ručně.
      const dept = findDept.get(department) as { id: number } | undefined;
      const deptId = dept?.id ?? null;

      const existing = findPerson.get(name, deptId, deptId) as { id: number } | undefined;
      const personId = existing?.id ?? Number(insertPerson.run(name, deptId).lastInsertRowid);

      linkRows.run(personId, name, department);
    }
  })();
}
