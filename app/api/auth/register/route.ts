import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, createSession, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });

  const { email, firstName, lastName, password } = body as Record<string, string>;

  if (!email?.trim() || !firstName?.trim() || !lastName?.trim() || !password) {
    return NextResponse.json({ error: "Vyplňte všechna pole." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Neplatná e-mailová adresa." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Heslo musí mít alespoň 6 znaků." }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "Tento e-mail je již registrovaný." }, { status: 409 });
  }

  const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  const role = count === 0 ? "admin" : "user";

  const result = db.prepare(
    "INSERT INTO users (email, first_name, last_name, password_hash, role) VALUES (?, ?, ?, ?, ?)"
  ).run(email.trim().toLowerCase(), firstName.trim(), lastName.trim(), hashPassword(password), role);

  const token = createSession(result.lastInsertRowid as number);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
