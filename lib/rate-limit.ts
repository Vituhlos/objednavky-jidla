import { getDb } from "./db";

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const db = getDb();
  const now = Date.now();

  return db.transaction(() => {
    const row = db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as
      | { count: number; reset_at: number }
      | undefined;

    if (!row || now > row.reset_at) {
      db.prepare(
        "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at"
      ).run(key, now + windowMs);
      return true;
    }

    if (row.count >= max) return false;

    db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    return true;
  })();
}
