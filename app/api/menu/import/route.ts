import { type NextRequest, NextResponse } from "next/server";
import { parseMenuText } from "@/lib/parse-menu";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAppSession } from "@/lib/auth";
import { extractStructuredText } from "@/lib/pdf-extract";
import path from "path";
import fs from "fs";

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
