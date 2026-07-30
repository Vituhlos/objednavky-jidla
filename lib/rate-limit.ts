import { getDb } from "./db";

// When the window for `key` expires, or null if nothing is being counted.
// Lets callers tell the user *when* to come back instead of just refusing.
export function getRateLimitReset(key: string): number | null {
  const row = getDb()
    .prepare("SELECT reset_at FROM rate_limits WHERE key = ?")
    .get(key) as { reset_at: number } | undefined;
  if (!row || row.reset_at <= Date.now()) return null;
  return row.reset_at;
}

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const db = getDb();
  const now = Date.now();

  return db.transaction(() => {
    // opportunistic cleanup of expired entries
    db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);

    const row = db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as
      | { count: number; reset_at: number }
      | undefined;

    if (!row) {
      db.prepare(
        "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)"
      ).run(key, now + windowMs);
      return true;
    }

    if (row.count >= max) return false;

    db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    return true;
  })();
}
