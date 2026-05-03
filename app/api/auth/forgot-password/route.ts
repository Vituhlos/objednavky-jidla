import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRateLimit(`forgot:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: true }); // silent — don't reveal rate limiting
  }

  const body = await req.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true });

  const db = getDb();
  const user = db.prepare(
    "SELECT id, first_name, email FROM users WHERE email = ? AND active = 1"
  ).get(email) as { id: number; first_name: string; email: string } | undefined;

  if (user) {
    const token = createPasswordResetToken(user.id);
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const resetUrl = `${origin}/reset-hesla?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl, user.first_name);
    } catch (err) {
      console.error("Password reset email failed:", err);
    }
  }

  // Always return ok — don't reveal whether the email exists
  return NextResponse.json({ ok: true });
}
