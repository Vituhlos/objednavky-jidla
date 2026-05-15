import type Database from "better-sqlite3";
import { getDb } from "./db";

export function checkRateLimit(key: string, max: number, windowMs: number, db?: Database.Database): boolean {
  const database = db ?? getDb();
  const now = Date.now();

  return database.transaction(() => {
    database.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);

    const row = database.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as
      | { count: number; reset_at: number }
      | undefined;

    if (!row) {
      database.prepare(
        "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)"
      ).run(key, now + windowMs);
      return true;
    }

    if (row.count >= max) return false;

    database.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    return true;
  })();
}
