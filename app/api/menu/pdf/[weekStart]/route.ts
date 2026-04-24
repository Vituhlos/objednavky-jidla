import { type NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  const { weekStart } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }
  const filePath = path.join(process.cwd(), "data", "pdfs", `${weekStart}.pdf`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="jidelnicek-${weekStart}.pdf"`,
    },
  });
}
