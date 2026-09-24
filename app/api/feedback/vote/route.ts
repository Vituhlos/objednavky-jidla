import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-auth";
import { setVote } from "@/lib/feedback";
import { VOTER_TOKEN_PATTERN } from "@/lib/feedback-meta";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.number().int().positive(),
  voter: z.string().regex(VOTER_TOKEN_PATTERN),
  vote: z.boolean(),
});

/**
 * Hlas „chci taky“ u připomínky zveřejněné k hlasování.
 *
 * Limit na IP je velkorysý schválně: celá firma často chodí ven přes jednu
 * adresu. Zastaví skript, ne kolegy. Jeden hlas na prohlížeč hlídá databáze.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0 || declared > 1024) {
    return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }
  if (!checkRateLimit(`feedback-vote:${getClientIp(req)}`, 200, 60 * 60 * 1000)) {
    return Response.json({ ok: false, error: "Teď toho hlasuješ hodně najednou. Zkus to za chvíli." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "Neplatný požadavek." }, { status: 400 });

  const votes = setVote(parsed.data.id, parsed.data.voter, parsed.data.vote);
  if (votes === null) {
    return Response.json({ ok: false, error: "O tomhle se už hlasovat nedá." }, { status: 404 });
  }
  revalidatePath("/pripominky");
  return Response.json({ ok: true, votes });
}
