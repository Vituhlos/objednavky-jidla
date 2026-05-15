import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  createTestTenantDb,
  seedUser,
  seedOrder,
  seedOrderRow,
  seedSession,
} from "../helpers/db";

describe("Tenant isolation — KRITICKÉ", () => {
  let limaDb: Database.Database;
  let novakDb: Database.Database;

  beforeEach(() => {
    limaDb = createTestTenantDb();
    novakDb = createTestTenantDb();

    const limaUserId = seedUser(limaDb, { email: "jan@lima.cz", role: "user" });
    const limaOrderId = seedOrder(limaDb, "2026-05-14");
    for (let i = 0; i < 5; i++) seedOrderRow(limaDb, limaOrderId, `Lima osoba ${i}`);

    const novakUserId = seedUser(novakDb, { email: "jan@novak.cz", role: "user" });
    const novakOrderId = seedOrder(novakDb, "2026-05-14");
    for (let i = 0; i < 3; i++) seedOrderRow(novakDb, novakOrderId, `Novak osoba ${i}`);

    // Uložíme userId pro použití v testech přes closures
    void limaUserId;
    void novakUserId;
  });

  afterEach(() => {
    limaDb.close();
    novakDb.close();
  });

  it("LIMA DB má 5 řádků, NOVAK DB má 3 řádky — data jsou izolovaná", () => {
    const limaCount = (
      limaDb.prepare("SELECT COUNT(*) as n FROM order_rows").get() as { n: number }
    ).n;
    const novakCount = (
      novakDb.prepare("SELECT COUNT(*) as n FROM order_rows").get() as { n: number }
    ).n;
    expect(limaCount).toBe(5);
    expect(novakCount).toBe(3);
  });

  it("uživatelé v LIMA nejsou viditelní z NOVAK a naopak", () => {
    const limaEmails = (
      limaDb.prepare("SELECT email FROM users").all() as { email: string }[]
    ).map((u) => u.email);
    const novakEmails = (
      novakDb.prepare("SELECT email FROM users").all() as { email: string }[]
    ).map((u) => u.email);

    expect(limaEmails).toContain("jan@lima.cz");
    expect(limaEmails).not.toContain("jan@novak.cz");
    expect(novakEmails).toContain("jan@novak.cz");
    expect(novakEmails).not.toContain("jan@lima.cz");
  });

  it("LIMA session token neexistuje v NOVAK DB", () => {
    const limaUser = limaDb
      .prepare("SELECT id FROM users LIMIT 1")
      .get() as { id: number };
    const limaToken = seedSession(limaDb, limaUser.id);

    const inNovak = novakDb
      .prepare("SELECT id FROM sessions WHERE token = ?")
      .get(limaToken);
    expect(inNovak).toBeUndefined();
  });

  it("NOVAK session token neexistuje v LIMA DB", () => {
    const novakUser = novakDb
      .prepare("SELECT id FROM users LIMIT 1")
      .get() as { id: number };
    const novakToken = seedSession(novakDb, novakUser.id);

    const inLima = limaDb
      .prepare("SELECT id FROM sessions WHERE token = ?")
      .get(novakToken);
    expect(inLima).toBeUndefined();
  });

  it("cross-tenant lookup: session LIMA nenajde uživatele v NOVAK DB", () => {
    const limaUser = limaDb
      .prepare("SELECT id FROM users LIMIT 1")
      .get() as { id: number };
    const limaToken = seedSession(limaDb, limaUser.id);

    // Simulace getTenantSessionUser volané s novakDb místo limaDb
    const crossResult = novakDb
      .prepare(
        `SELECT u.id FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
      )
      .get(limaToken);
    expect(crossResult).toBeUndefined();
  });

  it("agregace: součet order_rows přes dvě DB je správný", () => {
    const limaCount = (
      limaDb.prepare("SELECT COUNT(*) as n FROM order_rows").get() as { n: number }
    ).n;
    const novakCount = (
      novakDb.prepare("SELECT COUNT(*) as n FROM order_rows").get() as { n: number }
    ).n;
    expect(limaCount + novakCount).toBe(8); // 5 + 3
  });

  it("getTenantDb odmítne neplatné slugy před jakoukoliv file operací", async () => {
    // Dynamický import aby test cache neovlivnil jiné testy přes module-level Map
    const { getTenantDb } = await import("../../lib/tenant-db");
    expect(() => getTenantDb("../etc/passwd")).toThrow("Invalid tenant slug");
    expect(() => getTenantDb("")).toThrow("Invalid tenant slug");
    expect(() => getTenantDb("Velke Pismeno")).toThrow("Invalid tenant slug");
    expect(() => getTenantDb("slug with spaces")).toThrow("Invalid tenant slug");
    expect(() => getTenantDb("slug_underscore")).toThrow("Invalid tenant slug");
  });
});
