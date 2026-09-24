import fs from "fs";
import { type NextRequest } from "next/server";
import { requireSettingsPin } from "@/lib/api-auth";
import { getAttachmentFile } from "@/lib/feedback-attachments";

export const dynamic = "force-dynamic";

/**
 * Screenshot k připomínce — jen pro správce s PINem (hlavička x-settings-pin).
 * Připomínky jsou soukromé a na obrázku může být cokoli z obrazovky autora.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = requireSettingsPin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!/^\d{1,10}$/.test(id)) return new Response("Nenalezeno.", { status: 404 });
  const file = getAttachmentFile(Number(id));
  if (!file) return new Response("Nenalezeno.", { status: 404 });

  return new Response(fs.readFileSync(file.filePath), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
