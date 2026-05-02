import { getDb } from "./db";
import { getPragueISODate } from "./time";

export interface DepartmentInfo {
  id: number;
  name: string;
  label: string;
  emailLabel: string;
  accent: string;
  sortOrder: number;
  active: boolean;
}

function mapRow(r: Record<string, unknown>): DepartmentInfo {
  return {
    id: r.id as number,
    name: r.name as string,
    label: r.label as string,
    emailLabel: r.email_label as string,
    accent: r.accent as string,
    sortOrder: r.sort_order as number,
    active: (r.active as number) === 1,
  };
}

export function getDepartments(): DepartmentInfo[] {
  return (
    getDb()
      .prepare("SELECT * FROM departments WHERE active = 1 ORDER BY sort_order, id")
      .all() as Record<string, unknown>[]
  ).map(mapRow);
}

export function getDepartmentByName(name: string): DepartmentInfo | null {
  const r = getDb()
    .prepare("SELECT * FROM departments WHERE name = ?")
    .get(name) as Record<string, unknown> | undefined;
  return r ? mapRow(r) : null;
}

export function addDepartment(data: {
  name: string;
  label: string;
  emailLabel: string;
  accent: string;
}): DepartmentInfo {
  const db = getDb();
  const { m } = db.prepare("SELECT COALESCE(MAX(sort_order), -1) as m FROM departments").get() as { m: number };
  const result = db
    .prepare("INSERT INTO departments (name, label, email_label, accent, sort_order) VALUES (?, ?, ?, ?, ?)")
    .run(data.name.trim(), data.label.trim(), data.emailLabel.trim(), data.accent, m + 1);
  return mapRow(
    db.prepare("SELECT * FROM departments WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>
  );
}

export function updateDepartment(
  id: number,
  data: Partial<{ label: string; emailLabel: string; accent: string }>
): DepartmentInfo {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.label !== undefined) { fields.push("label = ?"); values.push(data.label.trim()); }
  if (data.emailLabel !== undefined) { fields.push("email_label = ?"); values.push(data.emailLabel.trim()); }
  if (data.accent !== undefined) { fields.push("accent = ?"); values.push(data.accent); }
  if (fields.length > 0) {
    db.prepare(`UPDATE departments SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  }
  return mapRow(db.prepare("SELECT * FROM departments WHERE id = ?").get(id) as Record<string, unknown>);
}

export function deleteDepartment(id: number): void {
  const db = getDb();
  const dept = db.prepare("SELECT name FROM departments WHERE id = ?").get(id) as { name: string } | undefined;
  if (!dept) throw new Error("Oddělení nenalezeno.");
  const today = getPragueISODate();
  const { n } = db.prepare(
    `SELECT COUNT(*) as n FROM order_rows r
     JOIN orders o ON o.id = r.order_id
     WHERE r.department = ? AND o.date = ? AND o.status = 'draft'`
  ).get(dept.name, today) as { n: number };
  if (n > 0) throw new Error("Nelze smazat oddělení s dnešními objednávkami.");
  db.prepare("UPDATE departments SET active = 0 WHERE id = ?").run(id);
}

export function reorderDepartments(orderedIds: number[]): void {
  const db = getDb();
  db.transaction(() => {
    orderedIds.forEach((id, i) => {
      db.prepare("UPDATE departments SET sort_order = ? WHERE id = ?").run(i, id);
    });
  })();
}
