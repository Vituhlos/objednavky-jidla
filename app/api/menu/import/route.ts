import pdfParse from "pdf-parse";
import { type NextRequest, NextResponse } from "next/server";
import { parseMenuText } from "@/lib/parse-menu";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
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

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText = "";
  try {
    const result = await pdfParse(buffer);
    rawText = result.text;
  } catch (e) {
    return NextResponse.json(
      {
        error: `Nepodařilo se přečíst PDF. Zkontrolujte, že soubor není poškozený. (${e instanceof Error ? e.message : "Neznámá chyba"})`,
      },
      { status: 422 }
    );
  }

  const parsed = parseMenuText(rawText);

  if (parsed.items.length === 0) {
    return NextResponse.json(
      {
        error:
          "Z PDF se nepodařilo načíst žádná jídla. Zkontrolujte, zda jde o správný soubor jídelníčku LIMA.",
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
    tmpPdfName = `tmp_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(pdfsDir, tmpPdfName), buffer);
  } catch {
    // Non-fatal — PDF storage is best-effort
  }

  return NextResponse.json({ ...parsed, tmpPdfName });
}
