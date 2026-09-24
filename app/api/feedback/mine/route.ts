import { type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-auth";
import { getOwnFeedback, ownFeedbackRequestSchema } from "@/lib/feedback";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

/**
 * „Moje připomínky“: stav a odpověď k připomínkám, ke kterým má prohlížeč
 * tajný kód z odeslání. POST, ne GET — kódy nemají co dělat v URL, logu
 * proxy ani v historii prohlížeče.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }
  // Zkoušení kódů naslepo nemá šanci (192 bitů), limit hlídá jen zátěž
  if (!checkRateLimit(`feedback-mine:${getClientIp(req)}`, 120, 60 * 60 * 1000)) {
    return Response.json({ ok: false, error: "Příliš mnoho požadavků." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }
  const parsed = ownFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });

  return Response.json(
    { ok: true, items: getOwnFeedback(parsed.data.items) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
