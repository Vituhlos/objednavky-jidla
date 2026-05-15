import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenant-db";
import { createTenantPasswordResetToken } from "@/lib/tenant-auth";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const body = await req.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true });

  const db = getTenantDb(tenantSlug);
  const user = db
    .prepare("SELECT id, first_name, email FROM users WHERE email = ? AND active = 1")
    .get(email) as { id: number; first_name: string; email: string } | undefined;

  if (user) {
    const token = createTenantPasswordResetToken(tenantSlug, user.id);
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const resetUrl = `${origin}/t/${tenantSlug}/reset-hesla?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl, user.first_name);
    } catch (err) {
      console.error("Password reset email failed:", err);
    }
  }

  // Always ok — don't reveal whether email exists
  return NextResponse.json({ ok: true });
}
