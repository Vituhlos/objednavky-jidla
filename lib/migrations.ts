import Database from "better-sqlite3";

export type Migration = {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
};

export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  const applied = new Set<number>(
    (db.prepare("SELECT version FROM _migrations").all() as { version: number }[]).map(
      (r) => r.version
    )
  );

  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((m) => !applied.has(m.version));

  for (const m of pending) {
    db.transaction(() => {
      m.up(db);
      db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(
        m.version,
        m.name
      );
    })();
  }
}
