import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { registerCredentialsUser, createEmailVerificationToken, getUserByEmail } from "@/lib/users";
import { sendVerifyEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Rate limit per IP — 5 pokusů / 15 min
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů. Zkuste to za chvíli." }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const password = String(body.password ?? "");
  const defaultDepartment = body.defaultDepartment ? String(body.defaultDepartment) : undefined;

  if (!email || !firstName || !lastName || !password) {
    return NextResponse.json({ error: "Vyplň všechna pole." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Neplatná e-mailová adresa." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Heslo musí mít alespoň 6 znaků." }, { status: 400 });
  }

  try {
    const { id, role } = registerCredentialsUser({ email, firstName, lastName, password, defaultDepartment });
    logAudit({ action: "login_success", details: `register: ${email}` });

    // Odeslat ověřovací e-mail (best-effort — když SMTP není nastaveno, registrace se nepřeruší)
    try {
      const token = createEmailVerificationToken(id);
      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";
      const proto = h.get("x-forwarded-proto") ?? "http";
      const verifyUrl = `${proto}://${host}/api/auth/verify-email?token=${token}`;
      await sendVerifyEmail(email, verifyUrl, firstName);
    } catch (err) {
      console.error("[auth/register] sendVerifyEmail failed:", err);
    }

    return NextResponse.json({ ok: true, role, emailSent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Registrace selhala.";
    const status = msg.includes("registrovaný") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
