import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-auth";
import { withdrawOwnFeedback, withdrawRequestSchema } from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Autor stáhne svou připomínku (křížek v „Moje připomínky“). Oprávnění
 * dokazuje tajný kód z odeslání, který má jen jeho prohlížeč.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0 || declared > 1024) {
    return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }
  if (!checkRateLimit(`feedback-withdraw:${getClientIp(req)}`, 30, 60 * 60 * 1000)) {
    return Response.json({ ok: false, error: "Teď toho stahuješ hodně najednou. Zkus to za chvíli." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }
  const parsed = withdrawRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });

  const result = withdrawOwnFeedback(parsed.data.id, parsed.data.token);
  if (result === "not-found") {
    return Response.json({ ok: false, error: "Tuhle připomínku už stáhnout nejde." }, { status: 404 });
  }
  if (result === "closed") {
    return Response.json({ ok: false, error: "Vyřízenou připomínku už stáhnout nejde." }, { status: 409 });
  }
  revalidatePath("/pripominky");
  return Response.json({ ok: true });
}
