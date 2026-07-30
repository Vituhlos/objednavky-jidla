import { getDb } from "./db";
import { toLocalISODate } from "./time";
import { DEFAULT_CLOSURE_ICON } from "./closure-icons";

export { DEFAULT_CLOSURE_ICON, CLOSURE_ICON_GROUPS } from "./closure-icons";

// A closure = continuous range of days when LIMA does not cook (dovolená, svátky,
// rekonstrukce…). Independent of the menu — can be entered weeks ahead, before any
// menu PDF for that period exists.
export interface Closure {
  id: number;
  startDate: string; // YYYY-MM-DD, inclusive
  endDate: string;   // YYYY-MM-DD, inclusive
  label: string;     // např. "Celozávodní dovolená"
  note: string;      // optional extra sentence shown in the heads-up banner
  icon: string;      // emoji chosen by the operator; DEFAULT_CLOSURE_ICON when empty
}

function mapRow(row: Record<string, unknown>): Closure {
  return {
    id: row.id as number,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    label: (row.label as string) ?? "",
    note: (row.note as string) ?? "",
    icon: (row.icon as string) || DEFAULT_CLOSURE_ICON,
  };
}

export function getClosures(): Closure[] {
  const rows = getDb()
    .prepare("SELECT * FROM closures ORDER BY start_date ASC, end_date ASC")
    .all() as Record<string, unknown>[];
  return rows.map(mapRow);
}

// The authority on what a valid closure is. The settings form mirrors this check for
// instant feedback, but the rule lives here — a silently swapped range (what this
// used to do) hides a typo instead of reporting it, and overlapping closures make
// getClosureForDate() return whichever row happens to come first.
export function validateClosure(startDate: string, endDate: string, ignoreId?: number): string | null {
  if (!startDate || !endDate) return "Vyplňte oba termíny.";
  if (startDate > endDate) return "Datum „Do“ je dřív než „Od“.";
  const clash = getClosures().find(
    (c) => c.id !== ignoreId && startDate <= c.endDate && endDate >= c.startDate
  );
  if (clash) return `Překrývá se s již zadaným zavřením „${clash.label || "Dovolená"}“.`;
  return null;
}

export function addClosure(startDate: string, endDate: string, label: string, note = "", icon = DEFAULT_CLOSURE_ICON): Closure {
  const problem = validateClosure(startDate, endDate);
  if (problem) throw new Error(problem);
  const [from, to] = [startDate, endDate];
  const db = getDb();
  const result = db
    .prepare("INSERT INTO closures (start_date, end_date, label, note, icon) VALUES (?, ?, ?, ?, ?)")
    .run(from, to, label.trim(), note.trim(), icon.trim() || DEFAULT_CLOSURE_ICON);
  return mapRow(
    db.prepare("SELECT * FROM closures WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>
  );
}

export function updateClosure(
  id: number,
  fields: { startDate: string; endDate: string; label: string; note: string; icon: string }
): Closure {
  // ignoreId: a closure must be allowed to overlap *itself* when only its label,
  // note or icon changes — otherwise every edit would fail its own overlap check.
  const problem = validateClosure(fields.startDate, fields.endDate, id);
  if (problem) throw new Error(problem);
  const db = getDb();
  db.prepare(
    "UPDATE closures SET start_date = ?, end_date = ?, label = ?, note = ?, icon = ? WHERE id = ?"
  ).run(
    fields.startDate,
    fields.endDate,
    fields.label.trim(),
    fields.note.trim(),
    fields.icon.trim() || DEFAULT_CLOSURE_ICON,
    id
  );
  return mapRow(db.prepare("SELECT * FROM closures WHERE id = ?").get(id) as Record<string, unknown>);
}

export function deleteClosure(id: number): void {
  getDb().prepare("DELETE FROM closures WHERE id = ?").run(id);
}

// The closure covering `iso`, if any — used to label the "zavřeno" banner.
export function getClosureForDate(iso: string): Closure | null {
  const row = getDb()
    .prepare("SELECT * FROM closures WHERE ? BETWEEN start_date AND end_date ORDER BY start_date ASC LIMIT 1")
    .get(iso) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

// The next closure starting after `afterISO`, but only if it begins within
// `withinDays` — a shutdown three months out isn't news yet.
export function getUpcomingClosure(afterISO: string, withinDays = 14): Closure | null {
  const [y, m, d] = afterISO.split("-").map(Number);
  const limit = new Date(y, m - 1, d + withinDays);
  const limitISO = toLocalISODate(limit);
  const row = getDb()
    .prepare("SELECT * FROM closures WHERE start_date > ? AND start_date <= ? ORDER BY start_date ASC LIMIT 1")
    .get(afterISO, limitISO) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

const MAX_EXPANDED_DAYS = 400; // guard against a typo'd end date expanding forever

// Every weekday (Po–Pá) covered by any closure, as ISO dates. Weekends are skipped —
// the app has no notion of ordering on them.
export function getClosureDates(): string[] {
  const dates = new Set<string>();
  for (const c of getClosures()) {
    const [y, m, d] = c.startDate.split("-").map(Number);
    const cursor = new Date(y, m - 1, d);
    for (let i = 0; i < MAX_EXPANDED_DAYS; i++) {
      const iso = toLocalISODate(cursor);
      if (iso > c.endDate) break;
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) dates.add(iso);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return [...dates].sort();
}
