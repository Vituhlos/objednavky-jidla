export interface ParsedMenuItem {
  day: string;
  type: "Polévka" | "Jídlo";
  code: string;
  name: string;
  allergens: string;
}

export interface MenuSanity {
  ok: boolean;           // false = výsledek je podezřelý, nedoporučuje se tiše uložit
  warnings: string[];    // lidsky čitelné popisy toho, co nesedí
  daysFound: string[];   // které dny se podařilo načíst, např. ["Po","Út","St"]
  mealCount: number;     // počet jídel (typ "Jídlo", bez polévek)
  soupCount: number;     // počet polévek
}

export interface ParseResult {
  weekLabel: string | null;
  weekStart: string | null;
  items: ParsedMenuItem[];
  rawTextPreview: string;
  tmpPdfName?: string;
  sanity: MenuSanity;
}

// Očekávané pracovní dny v jídelníčku LIMA (Po–Pá).
const EXPECTED_DAYS = ["Po", "Út", "St", "Čt", "Pá"];

// Sanity check na VÝSLEDEK parsování. Nekontroluje tvar dat (od toho je
// TypeScript), ale jestli výsledek dává smysl jako jídelníček — tj. jestli se
// parser tiše nerozbil na změně formátu PDF. Cílem je selhat NAHLAS, ne uložit
// prázdno/torzo a zjistit to až v appce.
export function checkMenuSanity(
  items: ParsedMenuItem[],
  weekStart: string | null
): MenuSanity {
  const warnings: string[] = [];

  // Které dny se reálně objevily (bez ohledu na pořadí).
  const daysFound = EXPECTED_DAYS.filter((d) => items.some((it) => it.day === d));
  const meals = items.filter((it) => it.type === "Jídlo" && it.name !== "Zavřeno");
  const soups = items.filter((it) => it.type === "Polévka");

  // 1) Nepřečetl se začátek/datum týdne → nejde spolehlivě zařadit do kalendáře.
  if (!weekStart) {
    warnings.push("Nepodařilo se přečíst datum týdne z PDF (řádek „Týden …“).");
  }

  // 2) Chybí celé dny. Pár dní zavřeno je OK, ale když jsou < 3, něco je špatně.
  const missingDays = EXPECTED_DAYS.filter((d) => !daysFound.includes(d));
  if (daysFound.length < 3) {
    warnings.push(
      `Načetly se jen ${daysFound.length} dny (${daysFound.join(", ") || "žádný"}). ` +
      `Chybí: ${missingDays.join(", ")}. Čekám aspoň 3 z 5.`
    );
  } else if (missingDays.length > 0) {
    warnings.push(`Chybí některé dny: ${missingDays.join(", ")}. (Může jít o zavřeno.)`);
  }

  // 3) Den bez jediného jídla = parser nejspíš ztratil řádky uprostřed.
  for (const d of daysFound) {
    const mealsThatDay = meals.filter((it) => it.day === d).length;
    if (mealsThatDay === 0) {
      warnings.push(`Den ${d} nemá žádné jídlo — parser možná přeskočil řádky.`);
    }
  }

  // 4) Podezřele málo jídel celkem. LIMA mívá ~5 jídel/den × ~5 dní.
  //    Pod ~8 položek za celý týden je skoro jistě torzo.
  if (meals.length < 8) {
    warnings.push(`Načteno jen ${meals.length} jídel za celý týden — to je podezřele málo.`);
  }

  // 5) Žádné polévky napříč týdnem je taky varovný signál (LIMA je vždy má).
  if (soups.length === 0) {
    warnings.push("Nenačetla se ani jedna polévka — zkontrolujte formát PDF.");
  }

  // 6) Položky bez názvu = chyba extrakce.
  const emptyNames = items.filter((it) => it.name.trim() === "").length;
  if (emptyNames > 0) {
    warnings.push(`${emptyNames} položek nemá název.`);
  }

  // "ok" je pravda jen když nic nehoří. Měkká varování (chybějící den kvůli
  // zavřeno) sama o sobě ok neshazují — shazují ho jen tvrdé signály.
  const hardFail =
    meals.length < 8 ||
    daysFound.length < 3 ||
    soups.length === 0 ||
    emptyNames > 0;

  return {
    ok: !hardFail,
    warnings,
    daysFound,
    mealCount: meals.length,
    soupCount: soups.length,
  };
}

const DEN_MAP: Record<string, string> = {
  Pondělí: "Po",
  Úterý: "Út",
  Středa: "St",
  Čtvrtek: "Čt",
  Pátek: "Pá",
};

const SKIP_RE: RegExp[] = [
  /^Bufet Lima/,
  /^Jídelní lístek/,
  /^Týden /,
  /^Alergeny/,
  /^Saláty a kompoty/,
  /^Studené omáčky/,
  /^Knedlíky/,
  /^Dobrou chuť/,
  /^Změna v jídelním/,
  /^info@/,
  /^\d{3} \d{3}/,
  /^\d+g:/,
  /^Tatarka|^Kečup|^BBQ/,
];

function shouldSkip(line: string): boolean {
  return SKIP_RE.some((re) => re.test(line));
}

// Extract allergen numbers from end of line, e.g. "(1a/b,3,7)" → "1,3,7"
// Also handles broken PDFs where opening "(" is missing: "1a/b,3,7)"
function normalizeName(s: string): string {
  return s.trim().replace(/\s{2,}/g, " ");
}

function extractAllergens(text: string): { name: string; allergens: string } {
  const m = text.match(/\s*\(([\d,/a-z]+)\)\s*$/i)
           ?? text.match(/\s+([\d][,/\da-z]*)\)\s*$/i);
  if (!m) return { name: normalizeName(text), allergens: "" };
  const raw = m[1].split(",").map((s) => {
    const num = parseInt(s.trim(), 10);
    return !isNaN(num) && num >= 1 && num <= 14 ? num : null;
  }).filter((n): n is number => n !== null);
  const unique = [...new Set(raw)].sort((a, b) => a - b);
  return {
    name: normalizeName(text.slice(0, text.length - m[0].length)),
    allergens: unique.join(","),
  };
}

// Merge continuation lines back into single logical items.
// A new item starts with a day name, "A"/"B" soup code, or digit meal code.
function joinContinuationLines(lines: string[]): string[] {
  const result: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const isNew =
      line in DEN_MAP ||
      /^[AB]\s+\S/.test(line) ||
      /^\d+\s+\S/.test(line) ||
      shouldSkip(line) ||
      line.includes("Zavřeno");
    if (isNew || result.length === 0) {
      result.push(line);
    } else {
      result[result.length - 1] += " " + line;
    }
  }
  return result;
}

// "Týden 30.3. - 3. 4. 2026" → "30.3.-3.4.2026"
function extractWeekLabel(rawText: string): string | null {
  const m = rawText.match(/Týden\s+([\d.]+\s*[-–]\s*[\d. ]+\d{4})/);
  if (!m) return null;
  return m[1].replace(/\s+/g, "").replace(/[–]/g, "-");
}

// Podporuje dvě varianty:
//   "30.3.-3.4.2026"  — různé měsíce, start má den i měsíc
//   "4.-8.5.2026"     — stejný měsíc, start má jen den (měsíc se bere z konce)
function parseWeekStart(weekLabel: string): string | null {
  const year = weekLabel.match(/(\d{4})$/);
  if (!year) return null;
  const y = parseInt(year[1], 10);

  // Formát A: startDen.startMesic.-...
  const fullStart = weekLabel.match(/^(\d{1,2})\.(\d{1,2})\./);
  if (fullStart) {
    const d = new Date(y, parseInt(fullStart[2], 10) - 1, parseInt(fullStart[1], 10));
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Formát B: startDen.-endDen.endMesic.rok — měsíc start == měsíc end (nebo o 1 méně)
  const endPart = weekLabel.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const dayOnly = weekLabel.match(/^(\d{1,2})\.-/);
  if (dayOnly && endPart) {
    const startDay = parseInt(dayOnly[1], 10);
    const endDay = parseInt(endPart[1], 10);
    let startMonth = parseInt(endPart[2], 10);
    if (startDay > endDay) startMonth = startMonth <= 1 ? 12 : startMonth - 1;
    const startYear = startMonth === 12 && endPart[2] === "1" ? y - 1 : y;
    const d = new Date(startYear, startMonth - 1, startDay);
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return null;
}

// Single-word Czech přílohy that LIMA sometimes separates with commas instead
// of slashes when offering a garnish alternative, e.g. "knedlík, zelí, špenát".
const PRILOHA_ALT_WORDS = new Set([
  "zelí", "špenát", "rýže", "kaše", "krokety", "hranolky",
  "bramboráčky", "bramboráky", "těstoviny", "polenta", "bulgur",
  "brambory", "knedlík",
]);

// Convert trailing comma-separated příloha alternatives to slash form so that
// splitVariants handles them uniformly.
// "Pečeně, bramborový knedlík, zelí, špenát" → "Pečeně, bramborový knedlík, zelí/ špenát"
function normalizeCommaAlts(name: string): string {
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length < 3) return name;
  let i = parts.length - 1;
  while (i >= 1 && PRILOHA_ALT_WORDS.has(parts[i].toLowerCase())) i--;
  const trailingCount = parts.length - 1 - i;
  if (trailingCount < 2) return name;
  return parts.slice(0, i + 1).join(", ") + ", " + parts.slice(i + 1).join("/ ");
}

// Recursively split "/" variants into separate items.
//
// Two patterns handled:
//
// 1. COMMA before slash → garnish/side variant (all parts after last comma):
//    "ptáček, rýže/ houskový knedlík"
//      → ["ptáček, rýže", "ptáček, houskový knedlík"]
//    "Katův šleh, rýže/ hranolky/ bramboráčky"
//      → ["Katův šleh, rýže", "Katův šleh, hranolky", "Katův šleh, bramboráčky"]
//
// 2. NO comma before slash → adjective/noun variant (e.g. "vepřový/ kuřecí řízek"):
//    left adjective + shared noun are reconstructed from context:
//    "Smažený vepřový/ kuřecí řízek, kaše"
//      → ["Smažený vepřový řízek, kaše", "Smažený kuřecí řízek, kaše"]
//    Applying recursively also handles:
//    "Smažený vepřový/ kuřecí řízek, kaše/ salát"
//      → 4 items (all combinations)
function splitVariants(text: string): string[] {
  if (!text.includes("/")) return [text];

  const firstSlash = text.indexOf("/");
  const baseEnd = text.lastIndexOf(",", firstSlash);

  if (baseEnd !== -1) {
    // Comma before slash → all variants are self-contained completions after the comma
    const base = text.slice(0, baseEnd).trim();
    const variantsPart = text.slice(baseEnd + 1).trim();
    const rawParts = variantsPart.split("/").map((v) => v.trim()).filter(Boolean);
    if (rawParts.length < 2) return [text];
    // Suffix po posledním lomítku (např. ", dip" v "grenaille/mačkané brambory, dip")
    // patří ke všem variantám, ne jen té poslední.
    let suffix = "";
    const lastPart = rawParts[rawParts.length - 1];
    const suffixComma = lastPart.indexOf(",");
    if (suffixComma !== -1) {
      suffix = lastPart.slice(suffixComma);
      rawParts[rawParts.length - 1] = lastPart.slice(0, suffixComma).trim();
    }
    return rawParts.flatMap((v) => splitVariants(`${base}, ${v}${suffix}`));
  }

  // No comma before slash → adjective/noun variant
  // "Smažený vepřový/ kuřecí řízek, kaše"
  //   stem     = "Smažený "
  //   leftAdj  = "vepřový"
  //   rightPhr = "kuřecí řízek" (until next comma)
  //   shared   = " řízek"        (everything after first word of rightPhr)
  //   remainder= ", kaše"
  const beforeSlash = text.slice(0, firstSlash);
  const lastSpaceBefore = beforeSlash.lastIndexOf(" ");
  const stem = lastSpaceBefore === -1 ? "" : beforeSlash.slice(0, lastSpaceBefore + 1);
  const leftAdj = lastSpaceBefore === -1 ? beforeSlash : beforeSlash.slice(lastSpaceBefore + 1);

  const afterSlash = text.slice(firstSlash + 1).trimStart();
  const nextComma = afterSlash.indexOf(",");
  const rightPhrase = nextComma === -1 ? afterSlash : afterSlash.slice(0, nextComma);
  const remainder = nextComma === -1 ? "" : afterSlash.slice(nextComma);

  // Shared suffix = words after first word of rightPhrase
  // e.g. "kuřecí řízek" → rightFirst="kuřecí", shared=" řízek"
  const firstSpaceInRight = rightPhrase.indexOf(" ");
  const sharedSuffix =
    firstSpaceInRight === -1 ? "" : rightPhrase.slice(firstSpaceInRight);

  const item1 = (stem + leftAdj + sharedSuffix + remainder).trim();
  const item2 = (stem + rightPhrase + remainder).trim();

  return [...splitVariants(item1), ...splitVariants(item2)];
}

function expandVariants(
  code: string,
  name: string,
  allergens: string
): Array<{ code: string; name: string; allergens: string }> {
  return splitVariants(name).map((n) => ({ code, name: n, allergens }));
}

export function parseMenuText(rawText: string): ParseResult {
  const weekLabel = extractWeekLabel(rawText);
  const weekStart = weekLabel ? parseWeekStart(weekLabel) : null;
  const lines = joinContinuationLines(rawText.split("\n"));
  const items: ParsedMenuItem[] = [];
  let currentDay: string | null = null;

  for (const line of lines) {
    if (shouldSkip(line)) continue;

    if (line in DEN_MAP) {
      currentDay = DEN_MAP[line];
      continue;
    }

    if (!currentDay) continue;

    if (line.includes("Zavřeno")) {
      items.push({ day: currentDay, type: "Jídlo", code: "-", name: "Zavřeno", allergens: "" });
      continue;
    }

    let m = line.match(/^([AB])\s+(.+)$/);
    if (m) {
      const { name, allergens } = extractAllergens(m[2]);
      // Soups don't have variants worth splitting
      items.push({ day: currentDay, type: "Polévka", code: m[1], name, allergens });
      continue;
    }

    m = line.match(/^(\d+)\s+(.+)$/);
    if (m) {
      const { name: cleaned, allergens } = extractAllergens(m[2]);
      const expanded = expandVariants(m[1], normalizeCommaAlts(cleaned), allergens);
      for (const variant of expanded) {
        items.push({ day: currentDay, type: "Jídlo", code: variant.code, name: variant.name, allergens: variant.allergens });
      }
    }
  }

  return {
    weekLabel,
    weekStart,
    items,
    rawTextPreview: rawText.slice(0, 1000),
    sanity: checkMenuSanity(items, weekStart),
  };
}
