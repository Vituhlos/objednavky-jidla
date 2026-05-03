import { NextRequest, NextResponse } from "next/server";
import { validatePasswordResetToken, consumePasswordResetToken, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json() as { token?: string; password?: string };
  const { token, password } = body;

  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const userId = validatePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "Odkaz pro obnovení hesla je neplatný nebo vypršel." },
      { status: 400 }
    );
  }

  const db = getDb();
  consumePasswordResetToken(token);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);

  return NextResponse.json({ ok: true });
}
