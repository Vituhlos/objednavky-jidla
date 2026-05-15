import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenant-db";
import { validateTenantPasswordResetToken } from "@/lib/tenant-auth";
import { hashPassword } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const body = await req.json().catch(() => null) as { token?: string; password?: string } | null;
  if (!body?.token || !body?.password) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { token, password } = body;
  if (password.length < 6) {
    return NextResponse.json({ error: "Heslo musí mít alespoň 6 znaků." }, { status: 400 });
  }

  const userId = validateTenantPasswordResetToken(tenantSlug, token);
  if (!userId) {
    return NextResponse.json({ error: "Odkaz je neplatný nebo vypršel." }, { status: 400 });
  }

  getTenantDb(tenantSlug)
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(hashPassword(password), userId);

  return NextResponse.json({ ok: true });
}
