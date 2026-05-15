import { describe, it, expect } from "vitest";
import { createTestTenantDb, seedOrder, seedOrderRow } from "../helpers/db";

describe("Orders — DB constraints", () => {
  it("objednávka pro stejné datum nelze vložit dvakrát (UNIQUE constraint)", () => {
    const db = createTestTenantDb();
    db.prepare("INSERT INTO orders (date, status) VALUES ('2026-05-14', 'draft')").run();
    expect(() => {
      db.prepare(
        "INSERT INTO orders (date, status) VALUES ('2026-05-14', 'draft')"
      ).run();
    }).toThrow();
    db.close();
  });

  it("smazání objednávky kaskádově smaže order_rows (ON DELETE CASCADE)", () => {
    const db = createTestTenantDb();
    const orderId = seedOrder(db, "2026-05-14");
    seedOrderRow(db, orderId, "Jan Novák");
    seedOrderRow(db, orderId, "Petr Horak");

    expect(
      (
        db
          .prepare("SELECT COUNT(*) as n FROM order_rows WHERE order_id = ?")
          .get(orderId) as { n: number }
      ).n
    ).toBe(2);

    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);

    expect(
      (
        db
          .prepare("SELECT COUNT(*) as n FROM order_rows WHERE order_id = ?")
          .get(orderId) as { n: number }
      ).n
    ).toBe(0);
    db.close();
  });

  it("INSERT OR REPLACE pro objednávku zachová stejné id (upsert pattern)", () => {
    const db = createTestTenantDb();
    db.prepare("INSERT INTO orders (date, status) VALUES ('2026-05-15', 'draft')").run();
    const before = db
      .prepare("SELECT id FROM orders WHERE date = '2026-05-15'")
      .get() as { id: number };

    // Druhý INSERT s INSERT OR IGNORE — nezmění nic
    db.prepare(
      "INSERT OR IGNORE INTO orders (date, status) VALUES ('2026-05-15', 'draft')"
    ).run();

    const after = db
      .prepare("SELECT id FROM orders WHERE date = '2026-05-15'")
      .get() as { id: number };
    expect(after.id).toBe(before.id);

    const count = (
      db.prepare("SELECT COUNT(*) as n FROM orders").get() as { n: number }
    ).n;
    expect(count).toBe(1);
    db.close();
  });

  it("status přechod draft → sent lze provést jen jednou (UPDATE WHERE status = draft)", () => {
    const db = createTestTenantDb();
    seedOrder(db, "2026-05-14");
    const orderId = (
      db
        .prepare("SELECT id FROM orders WHERE date = '2026-05-14'")
        .get() as { id: number }
    ).id;

    // První přechod na sent
    const r1 = db
      .prepare("UPDATE orders SET status = 'sent' WHERE id = ? AND status = 'draft'")
      .run(orderId);
    expect(r1.changes).toBe(1);

    // Druhý pokus — nic nezmění (atomic guard)
    const r2 = db
      .prepare("UPDATE orders SET status = 'sent' WHERE id = ? AND status = 'draft'")
      .run(orderId);
    expect(r2.changes).toBe(0);
    db.close();
  });
});
