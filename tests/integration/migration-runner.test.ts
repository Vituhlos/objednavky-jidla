import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../lib/migrations";
import { TENANT_MIGRATIONS } from "../../lib/tenant-db";

describe("runMigrations", () => {
  it("aplikuje všechny migrace na prázdnou DB", () => {
    const db = new Database(":memory:");
    runMigrations(db, TENANT_MIGRATIONS);

    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[]
    ).map((r) => r.name);

    expect(tables).toContain("users");
    expect(tables).toContain("orders");
    expect(tables).toContain("order_rows");
    expect(tables).toContain("departments");
    expect(tables).toContain("sessions");
    expect(tables).toContain("rate_limits");
    expect(tables).toContain("_migrations");
    db.close();
  });

  it("je idempotentní — druhý běh nic nepřidá ani nezpůsobí chybu", () => {
    const db = new Database(":memory:");
    runMigrations(db, TENANT_MIGRATIONS);
    const versionsBefore = (
      db
        .prepare("SELECT version FROM _migrations ORDER BY version")
        .all() as { version: number }[]
    ).map((r) => r.version);

    runMigrations(db, TENANT_MIGRATIONS); // druhý běh

    const versionsAfter = (
      db
        .prepare("SELECT version FROM _migrations ORDER BY version")
        .all() as { version: number }[]
    ).map((r) => r.version);
    expect(versionsAfter).toEqual(versionsBefore);
    db.close();
  });

  it("aplikuje pouze chybějící migrace na částečně migrovanou DB", () => {
    const db = new Database(":memory:");
    const subset = TENANT_MIGRATIONS.slice(0, 7); // jen prvních 7
    runMigrations(db, subset);
    const partialVersions = (
      db.prepare("SELECT version FROM _migrations").all() as { version: number }[]
    ).map((r) => r.version);
    expect(partialVersions).toHaveLength(7);
    expect(partialVersions).not.toContain(8); // rate_limits ještě není

    runMigrations(db, TENANT_MIGRATIONS); // zbytek
    const allVersions = (
      db.prepare("SELECT version FROM _migrations ORDER BY version").all() as { version: number }[]
    ).map((r) => r.version);
    expect(allVersions).toContain(8); // rate_limits přidány
    expect(allVersions.length).toBe(TENANT_MIGRATIONS.length);
    db.close();
  });

  it("verze migrací jsou unikátní a vzestupně seřazené", () => {
    const versions = TENANT_MIGRATIONS.map((m) => m.version);
    const unique = new Set(versions);
    expect(unique.size).toBe(versions.length);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1]);
    }
  });

  it("každá migrace má neprázdné jméno", () => {
    for (const m of TENANT_MIGRATIONS) {
      expect(m.name.length).toBeGreaterThan(0);
    }
  });
});
