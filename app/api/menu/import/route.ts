import { getDocumentProxy } from "unpdf";
import { type NextRequest, NextResponse } from "next/server";
import { parseMenuText } from "@/lib/parse-menu";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAppSession } from "@/lib/auth";
import path from "path";
import fs from "fs";

// pdfjs-dist (via unpdf) gives text items without newlines — reconstruct line
// breaks from Y-position changes and visual gaps between items, matching the
// output format that pdf-parse used to produce.
async function extractStructuredText(buf: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(buf);
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, { x: number; w: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round((item as { transform: number[] }).transform[5] * 2) / 2;
      const x = (item as { transform: number[] }).transform[4];
      const w = (item as { width?: number }).width ?? 0;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x, w, str: item.str });
    }
    for (const y of [...byY.keys()].sort((a, b) => b - a)) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      let line = items[0].str;
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const curr = items[i];
        line += (curr.x - (prev.x + prev.w) > 1 ? " " : "") + curr.str;
      }
      lines.push(line);
    }
  }
  return lines.join("\n");
}

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Přístup odmítnut." }, { status: 403 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRateLimit(`pdf-import:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Příliš mnoho nahraných souborů. Zkuste to za hodinu." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Nepodařilo se přečíst nahraný soubor." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Soubor nebyl nalezen." }, { status: 400 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "Soubor je příliš velký (max 10 MB)." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText = "";
  try {
    rawText = await extractStructuredText(new Uint8Array(buffer));
  } catch (e) {
    return NextResponse.json(
      {
        error: `Nepodařilo se přečíst PDF. Zkontrolujte, že soubor není poškozený. (${e instanceof Error ? e.message : "Neznámá chyba"})`,
      },
      { status: 422 }
    );
  }

  const parsed = parseMenuText(rawText);

  // Tvrdé selhání: parser vrátil prázdno NEBO torzo (málo dní/jídel, žádná
  // polévka, položky bez názvu…). Radši import zahodíme, než abychom tiše
  // uložili rozbitý jídelníček a zjistili to až v appce.
  if (!parsed.sanity.ok) {
    return NextResponse.json(
      {
        error:
          parsed.items.length === 0
            ? "Z PDF se nepodařilo načíst žádná jídla. Zkontrolujte, zda jde o správný soubor jídelníčku LIMA."
            : "Jídelníček se načetl jen částečně — výsledek vypadá neúplně. " +
              "Zkontrolujte PDF nebo zda LIMA nezměnila formát.",
        warnings: parsed.sanity.warnings,
        daysFound: parsed.sanity.daysFound,
        mealCount: parsed.sanity.mealCount,
        soupCount: parsed.sanity.soupCount,
        rawTextPreview: parsed.rawTextPreview,
      },
      { status: 422 }
    );
  }

  // Save PDF to a temporary file so it can be stored after confirmation
  let tmpPdfName: string | undefined;
  try {
    const pdfsDir = path.join(process.cwd(), "data", "pdfs");
    fs.mkdirSync(pdfsDir, { recursive: true });
    tmpPdfName = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
    fs.writeFileSync(path.join(pdfsDir, tmpPdfName), buffer);
  } catch {
    // Non-fatal — PDF storage is best-effort
  }

  return NextResponse.json({ ...parsed, tmpPdfName });
}
