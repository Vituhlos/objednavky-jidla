import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenant-db";
import { verifyPassword, COOKIE_NAME } from "@/lib/auth";
import { createTenantSession } from "@/lib/tenant-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minut
const AUTH_ERROR = "Nesprávný e-mail nebo heslo.";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });

  const { email, password } = body as Record<string, string>;
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Vyplňte e-mail a heslo." }, { status: 400 });
  }

  const db = getTenantDb(tenantSlug);

  // Rate limit per-IP + per-email — max 5 pokusů za 15 minut
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rlKey = `login:${tenantSlug}:${ip}:${email.trim().toLowerCase()}`;
  if (!checkRateLimit(rlKey, LOGIN_MAX, LOGIN_WINDOW_MS, db)) {
    return NextResponse.json({ error: AUTH_ERROR }, { status: 429 });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE email = ? AND active = 1")
    .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

  if (!user || !verifyPassword(password, user.password_hash as string)) {
    return NextResponse.json({ error: AUTH_ERROR }, { status: 401 });
  }

  const token = createTenantSession(tenantSlug, user.id as number);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
