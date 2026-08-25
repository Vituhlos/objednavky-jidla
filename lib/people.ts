import { getDb } from "./db";
import { logAudit } from "./audit";

export interface Person {
  id: number;
  name: string;
  departmentId: number | null;
  departmentName: string | null;
  guestOfPersonId: number | null;
  guestOfName: string | null;
  active: boolean;
  /** Kolik řádků objednávek na strávníka odkazuje. */
  orderCount: number;
  /** Datum poslední objednávky, nebo `null` když žádnou nemá. */
  lastOrderDate: string | null;
}

const SELECT_PEOPLE = `
  SELECT
    p.id,
    p.name,
    p.department_id                            AS departmentId,
    d.label                                    AS departmentName,
    p.guest_of_person_id                       AS guestOfPersonId,
    g.name                                     AS guestOfName,
    p.active,
    COUNT(r.id)                                AS orderCount,
    MAX(o.date)                                AS lastOrderDate
  FROM people p
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN people      g ON g.id = p.guest_of_person_id
  LEFT JOIN order_rows  r ON r.person_id = p.id
  LEFT JOIN orders      o ON o.id = r.order_id
`;

type PersonRow = Omit<Person, "active"> & { active: number };

function toPerson(row: PersonRow): Person {
  return { ...row, active: row.active === 1 };
}

export function getPeople(): Person[] {
  const rows = getDb()
    .prepare(`${SELECT_PEOPLE} GROUP BY p.id ORDER BY p.active DESC, p.name COLLATE NOCASE`)
    .all() as PersonRow[];
  return rows.map(toPerson);
}

export function getPerson(id: number): Person | null {
  const row = getDb()
    .prepare(`${SELECT_PEOPLE} WHERE p.id = ? GROUP BY p.id`)
    .get(id) as PersonRow | undefined;
  return row ? toPerson(row) : null;
}

/**
 * Strávníci se stejným jménem, kteří **nemají účet** — kandidáti na sloučení.
 *
 * Nabízí se při registraci ve stylu „nejsi to náhodou ty?“. Vrací jen sirotky
 * z historie, takže se dva registrovaní lidé nikdy nepotkají (viz R4).
 */
export function findMergeCandidates(name: string, excludePersonId?: number): Person[] {
  return getPeople().filter(
    (p) =>
      p.id !== excludePersonId &&
      p.name.localeCompare(name, "cs", { sensitivity: "base" }) === 0 &&
      !hasAccount(p.id)
  );
}

export interface DuplicateGroup {
  /** Jméno, pod kterým se skupina zobrazí. */
  label: string;
  /**
   * `same-department` — stejné jméno i oddělení. Migrace i `findOrCreatePerson`
   * klíčují právě na tuhle dvojici, takže dva záznamy znamenají dva různé
   * **zápisy téhož člověka**: překlep, chybějící háček, mezera navíc.
   *
   * `cross-department` — totéž jméno ve víc odděleních. Tohle appka rozhodnout
   * neumí: buď někdo přešel jinam, nebo jsou to dva různí lidé. Jen upozorní.
   */
  kind: "same-department" | "cross-department";
  people: Person[];
}

// NFD rozloží „á“ na „a“ + háček; rozsah U+0300–U+036F je pak smaže.
const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Najde strávníky, kteří můžou být týž člověk zapsaný dvakrát.
 *
 * Vzniká to samo: kdo objednává z mobilu, občas vynechá háčky. Při dvaceti
 * lidech se to najde okem, při pětasedmdesáti ne — proto to hledá appka.
 *
 * **Odděluje ale dvě různě silné stopy.** Shoda jména i oddělení je skoro
 * jistota. Shoda jen jména napříč odděleními jistota není — a slepit dohromady
 * dva různé lidi je horší chyba než nechat jednoho člověka rozděleného, protože
 * rozdělené jde spojit, spojené ne. Proto se to druhé nikdy nenabízí jako návrh,
 * jen jako otázka pro člověka.
 */
export function findDuplicateGroups(): DuplicateGroup[] {
  const byName = new Map<string, Person[]>();
  for (const person of getPeople()) {
    const key = normalizeName(person.name);
    if (!key) continue;
    const list = byName.get(key);
    if (list) list.push(person);
    else byName.set(key, [person]);
  }

  const groups: DuplicateGroup[] = [];
  for (const sameName of byName.values()) {
    if (sameName.length < 2) continue;

    const byDept = new Map<number | null, Person[]>();
    for (const person of sameName) {
      const list = byDept.get(person.departmentId);
      if (list) list.push(person);
      else byDept.set(person.departmentId, [person]);
    }

    for (const cluster of byDept.values()) {
      if (cluster.length > 1) {
        groups.push({ label: cluster[0].name, kind: "same-department", people: cluster });
      }
    }

    // Napříč odděleními stačí jeden zástupce za oddělení — ten s nejdelší
    // historií. Ostatní varianty téhož jména už řeší skupina výše.
    if (byDept.size > 1) {
      const representatives = [...byDept.values()].map((cluster) =>
        cluster.reduce((best, p) => (p.orderCount > best.orderCount ? p : best))
      );
      groups.push({
        label: representatives[0].name,
        kind: "cross-department",
        people: representatives,
      });
    }
  }

  // Jistoty nahoru — s nimi se dá rovnou něco udělat.
  return groups.sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "same-department" ? -1 : 1) ||
      a.label.localeCompare(b.label, "cs")
  );
}

/**
 * Má strávník navázaný účet?
 *
 * Tabulka `user_people` vznikne až s účty (fáze 2). Do té doby jsou všichni
 * strávníci sirotci a funkce vrací `false` — pravidlo R4 tak platí od začátku
 * a začne zabírat samo, jakmile účty přibudou.
 */
export function hasAccount(personId: number): boolean {
  const db = getDb();
  const table = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user_people'")
    .get();
  if (!table) return false;
  return !!db.prepare("SELECT 1 FROM user_people WHERE person_id = ?").get(personId);
}

/**
 * Najde strávníka podle jména a oddělení, jinak ho založí.
 *
 * Volá se při zápisu jména do řádku objednávky. Klíčem je dvojice jméno +
 * oddělení, stejně jako v migraci — překlep tedy založí nového strávníka
 * a správce ho pak sloučí. To je záměr: raději dva záznamy k sloučení než
 * dva lidé slepení dohromady.
 */
export function findOrCreatePerson(name: string, departmentName: string): number | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const db = getDb();
  const dept = db.prepare("SELECT id FROM departments WHERE name = ?").get(departmentName) as
    | { id: number }
    | undefined;
  const deptId = dept?.id ?? null;

  const existing = db
    .prepare(
      "SELECT id FROM people WHERE name = ? AND (department_id IS ? OR department_id = ?) AND active = 1"
    )
    .get(trimmed, deptId, deptId) as { id: number } | undefined;
  if (existing) return existing.id;

  return Number(
    db.prepare("INSERT INTO people (name, department_id) VALUES (?, ?)").run(trimmed, deptId)
      .lastInsertRowid
  );
}

export function renamePerson(id: number, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Jméno nesmí být prázdné.");

  const before = getPerson(id);
  if (!before) throw new Error("Strávník neexistuje.");
  if (before.name === trimmed) return;

  getDb().prepare("UPDATE people SET name = ? WHERE id = ?").run(trimmed, id);

  // Historické objednávky si drží otisk jména, takže se mění jen ty budoucí.
  logAudit({
    action: "person_rename",
    personName: trimmed,
    details: `${before.name} → ${trimmed}`,
  });
}

export function setPersonActive(id: number, active: boolean): void {
  const person = getPerson(id);
  if (!person) throw new Error("Strávník neexistuje.");

  getDb().prepare("UPDATE people SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  logAudit({
    action: active ? "person_activate" : "person_deactivate",
    personName: person.name,
  });
}

export function setPersonDepartment(id: number, departmentId: number | null): void {
  getDb().prepare("UPDATE people SET department_id = ? WHERE id = ?").run(departmentId, id);
}

/**
 * Přesune historii ze `sourceId` na `targetId` a zdroj smaže.
 *
 * **Pravidlo R4: zdroj nesmí mít účet.** Tím je technicky nemožné spojit dva
 * registrované lidi — nejhorší možný omyl je špatně přiřazená historie sirotka,
 * což jde napravit. Rozdělené jde spojit, spojené ne.
 */
export function mergePeople(sourceId: number, targetId: number): void {
  if (sourceId === targetId) throw new Error("Nelze sloučit strávníka sám se sebou.");

  const source = getPerson(sourceId);
  const target = getPerson(targetId);
  if (!source || !target) throw new Error("Strávník neexistuje.");

  if (hasAccount(sourceId)) {
    throw new Error(
      `„${source.name}“ má vlastní účet. Sloučit lze jen strávníka bez účtu — jinak by se spojili dva různí lidé.`
    );
  }

  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE order_rows SET person_id = ? WHERE person_id = ?").run(targetId, sourceId);
    db.prepare("UPDATE people SET guest_of_person_id = ? WHERE guest_of_person_id = ?").run(
      targetId,
      sourceId
    );
    db.prepare("DELETE FROM people WHERE id = ?").run(sourceId);
  })();

  logAudit({
    action: "person_merge",
    personName: target.name,
    details: `${source.name} (${source.orderCount} objednávek) → ${target.name}`,
  });
}

export function deletePerson(id: number): void {
  const person = getPerson(id);
  if (!person) return;

  if (person.orderCount > 0) {
    throw new Error(
      `„${person.name}“ má ${person.orderCount} objednávek v historii. Místo smazání ho označ jako neaktivního.`
    );
  }
  if (hasAccount(id)) throw new Error(`„${person.name}“ má vlastní účet.`);

  getDb().prepare("DELETE FROM people WHERE id = ?").run(id);
  logAudit({ action: "person_delete", personName: person.name });
}
