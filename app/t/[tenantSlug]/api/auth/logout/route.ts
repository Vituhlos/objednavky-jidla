import { NextResponse } from "next/server";
import { deleteTenantSession, COOKIE_NAME } from "@/lib/tenant-auth";
import { cookies } from "next/headers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) deleteTenantSession(tenantSlug, token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
