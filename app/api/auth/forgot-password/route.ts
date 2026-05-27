import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserByEmail, createPasswordResetToken } from "@/lib/users";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů. Zkuste to za chvíli." }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Neplatná e-mailová adresa." }, { status: 400 });
  }

  const user = getUserByEmail(email);
  // Vždy vracíme úspěch (neprozrazujeme, jestli účet existuje — proti enumeration attack)
  if (user && user.active && user.passwordHash) {
    try {
      const token = createPasswordResetToken(user.id);
      const h = await headers();
      const authUrl = process.env.AUTH_URL?.replace(/\/$/, "");
      const baseUrl = authUrl || (() => {
        const host = h.get("host") ?? "localhost:3000";
        const proto = h.get("x-forwarded-proto") ?? "http";
        return `${proto}://${host}`;
      })();
      const resetUrl = `${baseUrl}/reset-hesla?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl, user.firstName || "");
    } catch (err) {
      console.error("[auth/forgot] sendPasswordResetEmail failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
