import { describe, it, expect } from "vitest";
import { createTestTenantDb } from "../helpers/db";
import { checkRateLimit } from "../../lib/rate-limit";

describe("checkRateLimit", () => {
  it("povolí pokusy do limitu", () => {
    const db = createTestTenantDb();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("login:test:ip:user@test.cz", 5, 60_000, db)).toBe(true);
    }
    db.close();
  });

  it("zablokuje pokus přes limit", () => {
    const db = createTestTenantDb();
    for (let i = 0; i < 5; i++) {
      checkRateLimit("login:block:ip:user@test.cz", 5, 60_000, db);
    }
    expect(checkRateLimit("login:block:ip:user@test.cz", 5, 60_000, db)).toBe(false);
    db.close();
  });

  it("různé klíče mají samostatné čítače", () => {
    const db = createTestTenantDb();
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key:A", 5, 60_000, db);
    }
    expect(checkRateLimit("key:A", 5, 60_000, db)).toBe(false);
    expect(checkRateLimit("key:B", 5, 60_000, db)).toBe(true); // key:B začíná od 0
    db.close();
  });

  it("po vypršení okna se čítač resetuje", () => {
    const db = createTestTenantDb();
    // Vyčerpáme limit s oknem v minulosti (1 ms)
    for (let i = 0; i < 5; i++) {
      checkRateLimit("expiry:test", 5, 1, db);
    }
    expect(checkRateLimit("expiry:test", 5, 1, db)).toBe(false);

    // Počkáme aby window expiroval
    // SQLite DELETE WHERE reset_at < now se spustí při příštím volání — simulujeme přímo
    const now = Date.now() + 10; // trocha do budoucnosti
    db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);

    // Po expiraci nový pokus projde
    expect(checkRateLimit("expiry:test", 5, 60_000, db)).toBe(true);
    db.close();
  });

  it("limit 1 — druhý pokus je okamžitě zamítnut", () => {
    const db = createTestTenantDb();
    expect(checkRateLimit("strict:limit", 1, 60_000, db)).toBe(true);
    expect(checkRateLimit("strict:limit", 1, 60_000, db)).toBe(false);
    db.close();
  });
});
