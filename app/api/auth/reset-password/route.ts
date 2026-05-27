import { NextRequest, NextResponse } from "next/server";
import { validatePasswordResetToken, consumePasswordResetToken, setUserPasswordFromReset } from "@/lib/users";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`reset:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů. Zkuste to za chvíli." }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (!token || !password) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Heslo musí mít alespoň 6 znaků." }, { status: 400 });
  }

  const userId = validatePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Odkaz je neplatný nebo vypršel." }, { status: 400 });
  }

  try {
    setUserPasswordFromReset(userId, password);
    consumePasswordResetToken(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Nepodařilo se obnovit heslo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
