import fs from "fs";
import { type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getOrderPdfPath } from "@/lib/orders";
import { getAppSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session) return new Response("Přihlášení vyžadováno", { status: 401 });
  return params.then(({ id }) => {
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return new Response("Bad request", { status: 400 });

    const pdfPath = getOrderPdfPath(orderId);
    if (!fs.existsSync(pdfPath)) {
      return new Response("PDF nenalezeno", { status: 404 });
    }

    const db = getDb();
    const row = db.prepare("SELECT date FROM orders WHERE id = ?").get(orderId) as { date: string } | undefined;
    if (!row) return new Response("Objednávka nenalezena", { status: 404 });

    const download = req.nextUrl.searchParams.get("download") === "1";
    const filename = `Objednavka_LIMA_${row.date}.pdf`;
    const buffer = fs.readFileSync(pdfPath);

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  });
}
