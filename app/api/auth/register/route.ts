import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, createSession, COOKIE_NAME } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů. Zkuste to za chvíli." }, { status: 429 });
  }
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
  const normalizedEmail = email.trim().toLowerCase();

  const existingActive = db.prepare("SELECT id FROM users WHERE email = ? AND active = 1").get(normalizedEmail);
  if (existingActive) {
    return NextResponse.json({ error: "Tento e-mail je již registrovaný." }, { status: 409 });
  }

  const existingInactive = db.prepare("SELECT id FROM users WHERE email = ? AND active = 0").get(normalizedEmail) as { id: number } | undefined;

  let userId: number;
  let role: string;
  if (existingInactive) {
    const existing = db.prepare("SELECT role FROM users WHERE id = ?").get(existingInactive.id) as { role: string };
    role = existing.role;
    db.prepare(
      "UPDATE users SET first_name = ?, last_name = ?, password_hash = ?, active = 1 WHERE id = ?"
    ).run(firstName.trim(), lastName.trim(), hashPassword(password), existingInactive.id);
    userId = existingInactive.id;
  } else {
    const { count } = db.prepare("SELECT COUNT(*) as count FROM users WHERE active = 1").get() as { count: number };
    role = count === 0 ? "admin" : "user";
    const result = db.prepare(
      "INSERT INTO users (email, first_name, last_name, password_hash, role) VALUES (?, ?, ?, ?, ?)"
    ).run(normalizedEmail, firstName.trim(), lastName.trim(), hashPassword(password), role);
    userId = result.lastInsertRowid as number;
  }

  const token = createSession(userId);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
