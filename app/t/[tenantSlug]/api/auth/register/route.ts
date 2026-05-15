import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenant-db";
import { getGlobalDb } from "@/lib/global-db";
import { hashPassword, COOKIE_NAME } from "@/lib/auth";
import { createTenantSession } from "@/lib/tenant-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const REGISTER_MAX = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hodina

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });

  const { email, firstName, lastName, password, joinCode } = body as Record<string, string>;

  if (!email?.trim() || !firstName?.trim() || !lastName?.trim() || !password || !joinCode?.trim()) {
    return NextResponse.json({ error: "Vyplňte všechna pole." }, { status: 400 });
  }

  // Rate limit per-IP — max 5 registrací za hodinu
  const db = getTenantDb(tenantSlug);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rlKey = `register:${tenantSlug}:${ip}`;
  if (!checkRateLimit(rlKey, REGISTER_MAX, REGISTER_WINDOW_MS, db)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů. Zkuste to za hodinu." }, { status: 429 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Neplatná e-mailová adresa." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Heslo musí mít alespoň 6 znaků." }, { status: 400 });
  }

  // Verify join code against global DB
  const tenant = getGlobalDb()
    .prepare("SELECT slug FROM tenants WHERE slug = ? AND join_code = ? AND active = 1")
    .get(tenantSlug, joinCode.trim().toUpperCase()) as { slug: string } | undefined;
  if (!tenant) {
    return NextResponse.json({ error: "Neplatný registrační kód." }, { status: 403 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingActive = db.prepare("SELECT id FROM users WHERE email = ? AND active = 1").get(normalizedEmail);
  if (existingActive) {
    return NextResponse.json({ error: "Tento e-mail je již registrovaný." }, { status: 409 });
  }

  const existingInactive = db
    .prepare("SELECT id, role FROM users WHERE email = ? AND active = 0")
    .get(normalizedEmail) as { id: number; role: string } | undefined;

  let userId: number;
  let role: string;
  if (existingInactive) {
    role = existingInactive.role;
    db.prepare(
      "UPDATE users SET first_name = ?, last_name = ?, password_hash = ?, active = 1 WHERE id = ?"
    ).run(firstName.trim(), lastName.trim(), hashPassword(password), existingInactive.id);
    userId = existingInactive.id;
  } else {
    const { count } = db.prepare("SELECT COUNT(*) as count FROM users WHERE active = 1").get() as { count: number };
    role = count === 0 ? "admin" : "user";
    const result = db
      .prepare("INSERT INTO users (email, first_name, last_name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
      .run(normalizedEmail, firstName.trim(), lastName.trim(), hashPassword(password), role);
    userId = result.lastInsertRowid as number;
  }

  const token = createTenantSession(tenantSlug, userId);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
