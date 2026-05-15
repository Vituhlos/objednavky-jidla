import { NextRequest, NextResponse } from "next/server";
import { getGlobalDb } from "@/lib/global-db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { createSuperAdminSession, SA_COOKIE_NAME } from "@/lib/tenant-auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });

  const { email, password, bootstrapPassword } = body;

  const db = getGlobalDb();
  const adminCount = (db.prepare("SELECT COUNT(*) as c FROM super_admins").get() as { c: number }).c;

  // Bootstrap mode — create first super admin
  if (adminCount === 0 && bootstrapPassword) {
    if (!email?.trim() || bootstrapPassword.length < 8) {
      return NextResponse.json({ error: "E-mail a heslo (min. 8 znaků) jsou povinné." }, { status: 400 });
    }
    const result = db.prepare(
      "INSERT INTO super_admins (email, password_hash) VALUES (?, ?)"
    ).run(email.trim().toLowerCase(), hashPassword(bootstrapPassword));
    const token = createSuperAdminSession(result.lastInsertRowid as number);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SA_COOKIE_NAME, token, {
      httpOnly: true, sameSite: "lax",
      secure: req.headers.get("x-forwarded-proto") === "https",
      path: "/", maxAge: 8 * 60 * 60, // 8 hours
    });
    return res;
  }

  // Normal login
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Vyplňte e-mail a heslo." }, { status: 400 });
  }
  const admin = db
    .prepare("SELECT * FROM super_admins WHERE email = ?")
    .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

  if (!admin || !verifyPassword(password, admin.password_hash as string)) {
    return NextResponse.json({ error: "Nesprávný e-mail nebo heslo." }, { status: 401 });
  }

  const token = createSuperAdminSession(admin.id as number);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SA_COOKIE_NAME, token, {
    httpOnly: true, sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https",
    path: "/", maxAge: 8 * 60 * 60,
  });
  return res;
}
