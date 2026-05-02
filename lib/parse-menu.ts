export interface ParsedMenuItem {
  day: string;
  type: "Polévka" | "Jídlo";
  code: string;
  name: string;
}

export interface ParseResult {
  weekLabel: string | null;
  weekStart: string | null;
  items: ParsedMenuItem[];
  rawTextPreview: string;
  tmpPdfName?: string;
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

// Strip allergen codes from end of line, e.g. "(1a/b,3,7)" or "(1a,3,7,9)"
function stripAlergeny(text: string): string {
  return text.replace(/\s*\([\d,/ab]+\)\s*$/i, "").trim();
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

// "30.3.-3.4.2026" → ISO date of the Monday of that week
// Normalises to Monday so PDFs starting on Tue/Wed still match the week correctly.
function parseWeekStart(weekLabel: string): string | null {
  const dayMonth = weekLabel.match(/^(\d{1,2})\.(\d{1,2})\./);
  const year = weekLabel.match(/(\d{4})$/);
  if (!dayMonth || !year) return null;
  const d = new Date(
    parseInt(year[1], 10),
    parseInt(dayMonth[2], 10) - 1,
    parseInt(dayMonth[1], 10)
  );
  const dow = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    const parts = variantsPart
      .split("/")
      .map((v) => v.trim())
      .filter(Boolean);
    if (parts.length < 2) return [text];
    return parts.flatMap((v) => splitVariants(`${base}, ${v}`));
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
  name: string
): Array<{ code: string; name: string }> {
  return splitVariants(name).map((n) => ({ code, name: n }));
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
      items.push({ day: currentDay, type: "Jídlo", code: "-", name: "Zavřeno" });
      continue;
    }

    let m = line.match(/^([AB])\s+(.+)$/);
    if (m) {
      const cleaned = stripAlergeny(m[2]);
      // Soups don't have variants worth splitting
      items.push({ day: currentDay, type: "Polévka", code: m[1], name: cleaned });
      continue;
    }

    m = line.match(/^(\d+)\s+(.+)$/);
    if (m) {
      const cleaned = stripAlergeny(m[2]);
      const expanded = expandVariants(m[1], normalizeCommaAlts(cleaned));
      for (const variant of expanded) {
        items.push({ day: currentDay, type: "Jídlo", code: variant.code, name: variant.name });
      }
    }
  }

  return {
    weekLabel,
    weekStart,
    items,
    rawTextPreview: rawText.slice(0, 1000),
  };
}
